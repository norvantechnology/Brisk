import {
  InvoiceStatus,
  JobStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  TraderPaymentRequestStatus,
  TraderPaymentRequestType,
  type TraderPaymentRequest,
} from '@prisma/client';
import type Stripe from 'stripe';
import { prisma } from '../../config/database';
import { getCurrencyMeta } from '../../services/currency.service';
import { type ChargeDetails, getChargeDetails, paymentMethodFromCharge } from '../../services/stripe.service';
import { emitPaymentRequestPaid } from '../../sockets/realtime';
import { buildJobPaymentBreakdown } from '../jobs/job-payment-state';
import { formatDisplayDay } from '../jobs/jobs.service';
import { NotFoundError } from '../../utils/errors';

const PAYABLE_STATUSES: TraderPaymentRequestStatus[] = [
  TraderPaymentRequestStatus.SENT,
  TraderPaymentRequestStatus.PENDING,
];

const TYPE_TITLES: Record<TraderPaymentRequestType, string> = {
  FULL_JOB: 'Job Payment',
  SITE_VISIT_FEE: 'Site Visit Fee',
  PARTIAL: 'Installment',
};

const money = (value: Prisma.Decimal | number | null | undefined): number =>
  value == null ? 0 : Number(value);

const isPayable = (r: Pick<TraderPaymentRequest, 'status'>) => PAYABLE_STATUSES.includes(r.status);

type RequestWithInvoice = TraderPaymentRequest & { invoice: { id: string } | null };

const serialize = (r: RequestWithInvoice, currencySymbol: string) => {
  const totalAmount = money(r.totalAmount);
  return {
    id: r.id,
    /** Same display ID as the trader app installment history. */
    transactionId: `TXN-${r.id.replace(/-/g, '').slice(-6).toUpperCase()}`,
    /** Pay via POST /payments/intent { invoiceId }. */
    invoiceId: r.invoice?.id ?? null,
    jobId: r.jobId,
    traderId: r.traderId,
    type: r.type,
    title: r.title?.trim() || r.description?.trim() || TYPE_TITLES[r.type],
    description: r.description,
    status: r.status,
    serviceCharge: money(r.serviceCharge),
    materialsTotal: money(r.materialsTotal),
    siteVisitFee: money(r.siteVisitFee),
    platformFee: money(r.platformFee),
    vatRate: money(r.vatRate),
    vatAmount: money(r.vatAmount),
    totalAmount,
    currencyCode: r.currencyCode,
    currencySymbol,
    formattedAmount: `${currencySymbol}${totalAmount.toFixed(2)}`,
    paymentMethod: r.paymentMethod,
    cardBrand: r.cardBrand,
    cardLast4: r.cardLast4,
    paidAt: r.paidAt,
    confirmedAt: r.paidAt,
    confirmedDateLabel: r.paidAt ? `Confirmed on ${formatDisplayDay(r.paidAt)}` : null,
    createdAt: r.createdAt,
    canPay: isPayable(r) && totalAmount > 0 && Boolean(r.invoice),
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const resolveInstallmentStatus = (jobAmount: number, paid: number, pending: number) => {
  if (jobAmount > 0 && paid >= jobAmount) return 'PAID';
  if (paid > 0) return 'PARTIALLY PAID';
  if (pending > 0) return 'PENDING';
  return 'UNPAID';
};

/**
 * Installment Payments screen — one call: job breakdown, totals (paid / due), every request
 * (progress timeline + Pay Now via `canPay`), PAID rows = transaction history.
 */
export const listJobPaymentRequests = async (customerId: string, jobId: string) => {
  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId },
    select: {
      id: true,
      status: true,
      traderId: true,
      serviceCharge: true,
      siteVisitFee: true,
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      offer: {
        select: {
          id: true,
          title: true,
          discountType: true,
          discountValue: true,
        },
      },
      booking: {
        select: {
          id: true,
          invoice: {
            select: {
              id: true,
              totalAmount: true,
              serviceCharge: true,
              platformFee: true,
              traderOfferDiscount: true,
              promoDiscount: true,
              payments: {
                where: { status: 'COMPLETED' },
                orderBy: { paidAt: 'desc' },
                take: 1,
                select: { id: true, amount: true, paidAt: true, stripePaymentIntentId: true, transactionRef: true },
              },
            },
          },
        },
      },
    },
  });
  if (!job) throw new NotFoundError('Job not found.');

  const [requests, quote, materials] = await Promise.all([
    prisma.traderPaymentRequest.findMany({
      where: { jobId, customerId, status: { not: TraderPaymentRequestStatus.CANCELLED } },
      orderBy: { createdAt: 'desc' },
      include: { invoice: { select: { id: true } } },
    }),
    job.traderId
      ? prisma.quote.findFirst({
          where: { jobId, traderId: job.traderId },
          orderBy: { createdAt: 'desc' },
          select: { quotedAmount: true, currencyCode: true },
        })
      : null,
    job.traderId
      ? prisma.jobMaterial.findMany({ where: { jobId, traderId: job.traderId }, select: { price: true } })
      : [],
  ]);

  const currencyCode = requests[0]?.currencyCode ?? quote?.currencyCode ?? 'EUR';
  const symbols = new Map<string, string>();
  for (const code of new Set([currencyCode, ...requests.map((r) => r.currencyCode)])) {
    symbols.set(code, (await getCurrencyMeta(code)).symbol);
  }
  const currencySymbol = symbols.get(currencyCode) ?? currencyCode;

  const pendingRequest = requests.find((r) => isPayable(r) && r.invoice?.id);
  const invoiceId = pendingRequest?.invoice?.id ?? null;
  const jobCategory = job.subcategory?.name || job.category?.name || 'Service';

  const quotePrice = quote ? money(quote.quotedAmount) : job.serviceCharge != null ? money(job.serviceCharge) : null;
  const materialsTotal = materials.reduce((s, m) => s + money(m.price), 0);
  const rawSiteVisitFee = money(job.siteVisitFee);
  const invoice = job.booking?.invoice;
  const platformFee = invoice?.platformFee != null ? money(invoice.platformFee) : 20;
  const offerDiscountVal = round2(money(invoice?.traderOfferDiscount) + money(invoice?.promoDiscount));
  const offerDiscount = offerDiscountVal > 0 ? -offerDiscountVal : 0;
  const offerLabel = job.offer
    ? (job.offer.discountType === 'PERCENTAGE'
        ? `Offer Applied (${job.offer.discountValue}% OFF)`
        : `Offer Applied (${currencySymbol}${money(job.offer.discountValue)} OFF)`)
    : (offerDiscountVal > 0 ? 'Offer Applied' : null);

  const breakdown =
    job.traderId && quotePrice != null
      ? buildJobPaymentBreakdown({
          quotePrice,
          materialsTotal,
          siteVisitFee: rawSiteVisitFee,
        })
      : null;

  const breakdownSiteVisitFee = rawSiteVisitFee > 0 ? -rawSiteVisitFee : 0;
  const totalPayment = breakdown
    ? breakdown.totalAmount
    : round2((quotePrice ?? 0) + breakdownSiteVisitFee + platformFee + offerDiscount);
  const totalJobAmount = totalPayment;

  const amountPaid = round2(
    requests.filter((r) => r.status === TraderPaymentRequestStatus.PAID).reduce((s, r) => s + money(r.totalAmount), 0)
  );
  const pendingAmount = round2(requests.filter(isPayable).reduce((s, r) => s + money(r.totalAmount), 0));
  const dueBalance = round2(Math.max(0, totalJobAmount - amountPaid));
  const hasPendingPartial = requests.some(
    (r) => r.type === TraderPaymentRequestType.PARTIAL && isPayable(r)
  );

  const breakdownData = {
    quotePrice: quotePrice ?? 0,
    siteVisitFee: breakdownSiteVisitFee,
    platformFee,
    offerDiscount,
    offerLabel,
    totalPayment,
    materialsTotal,
    vatRate: breakdown?.vatRate ?? 0.2,
    vatAmount: breakdown?.vatAmount ?? 0,
    totalAmount: totalPayment,
    serviceCharge: quotePrice ?? 0,
    currencyCode,
    currencySymbol,
  };

  const confirmedPayments = requests
    .filter((r) => r.status === TraderPaymentRequestStatus.PAID)
    .map((r) => {
      const sym = symbols.get(r.currencyCode) ?? r.currencyCode;
      const amt = money(r.totalAmount);
      const paidDate = r.paidAt ?? r.updatedAt;
      return {
        id: r.id,
        transactionId: `TXN-${r.id.replace(/-/g, '').slice(-6).toUpperCase()}`,
        type: r.type,
        title: r.title?.trim() || r.description?.trim() || TYPE_TITLES[r.type],
        description: r.description,
        amount: amt,
        currencyCode: r.currencyCode,
        currencySymbol: sym,
        formattedAmount: `${sym}${amt.toFixed(2)}`,
        status: 'CONFIRMED',
        paidAt: paidDate,
        confirmedAt: paidDate,
        confirmedDateLabel: paidDate ? `Confirmed on ${formatDisplayDay(paidDate)}` : null,
        paymentMethod: r.paymentMethod,
        cardBrand: r.cardBrand,
        cardLast4: r.cardLast4,
      };
    });

  const pendingPayments = requests
    .filter(isPayable)
    .map((r) => {
      const sym = symbols.get(r.currencyCode) ?? r.currencyCode;
      const amt = money(r.totalAmount);
      const title = r.title?.trim() || r.description?.trim() || TYPE_TITLES[r.type];
      return {
        id: r.id,
        invoiceId: r.invoice?.id ?? null,
        type: r.type,
        title: `${title} Pending`,
        rawTitle: title,
        description: r.description,
        amount: amt,
        currencyCode: r.currencyCode,
        currencySymbol: sym,
        formattedAmount: `${sym}${amt.toFixed(2)}`,
        status: 'PENDING',
        dueDate: r.createdAt,
        dueDateLabel: `Due: ${formatDisplayDay(r.createdAt)}`,
        canPay: isPayable(r) && amt > 0 && Boolean(r.invoice),
      };
    });

  // paymentProgress array as specified by Dipen
  const paidProgress = requests
    .filter((r) => r.status === TraderPaymentRequestStatus.PAID)
    .map((r) => {
      const isSiteVisit = r.type === TraderPaymentRequestType.SITE_VISIT_FEE;
      const paidDate = r.paidAt ?? r.updatedAt;
      const sym = symbols.get(r.currencyCode) ?? currencySymbol;
      return {
        title: r.title?.trim() || r.description?.trim() || TYPE_TITLES[r.type],
        description: paidDate ? `Confirmed on ${formatDisplayDay(paidDate)}` : (r.description?.trim() || 'Payment confirmed'),
        isCompleted: true,
        formattedAmount: isSiteVisit ? null : `${sym}${money(r.totalAmount).toFixed(2)}`,
        dueDate: null,
      };
    });

  if (!requests.some((r) => r.type === TraderPaymentRequestType.SITE_VISIT_FEE) && rawSiteVisitFee > 0) {
    const upfrontPaid = job.booking?.invoice?.payments?.[0];
    const visitDate = upfrontPaid?.paidAt ?? null;
    paidProgress.unshift({
      title: 'Site Visit Fee',
      description: visitDate ? `Confirmed on ${formatDisplayDay(visitDate)}` : 'Site visit fee confirmed',
      isCompleted: true,
      formattedAmount: null,
      dueDate: null,
    });
  }

  const pendingProgress = requests
    .filter(isPayable)
    .map((r) => {
      const sym = symbols.get(r.currencyCode) ?? currencySymbol;
      const rawTitle = r.title?.trim() || r.description?.trim() || TYPE_TITLES[r.type];
      const titleWithPending = rawTitle.toLowerCase().endsWith('pending') ? rawTitle : `${rawTitle} Pending`;
      return {
        title: titleWithPending,
        description: r.description?.trim() || 'Payment pending',
        isCompleted: false,
        formattedAmount: `${sym}${money(r.totalAmount).toFixed(2)}`,
        dueDate: r.createdAt.toISOString(),
      };
    });

  const paymentProgress = [...paidProgress, ...pendingProgress];

  // transactionHistory array as specified by Dipen
  const transactionHistory = requests
    .filter((r) => r.status === TraderPaymentRequestStatus.PAID)
    .map((r) => {
      const sym = symbols.get(r.currencyCode) ?? currencySymbol;
      const paidDate = r.paidAt ?? r.updatedAt;
      return {
        id: `TXN-${r.id.replace(/-/g, '').slice(-6).toUpperCase()}`,
        title: r.title?.trim() || r.description?.trim() || TYPE_TITLES[r.type],
        date: paidDate.toISOString(),
        formattedAmount: `${sym}${money(r.totalAmount).toFixed(2)}`,
      };
    });

  const upfrontPayment = job.booking?.invoice?.payments?.[0];
  if (upfrontPayment && money(upfrontPayment.amount) > 0) {
    transactionHistory.unshift({
      id: upfrontPayment.transactionRef ?? upfrontPayment.stripePaymentIntentId ?? `TXN-${upfrontPayment.id.slice(-6).toUpperCase()}`,
      title: 'Initial Deposit',
      date: upfrontPayment.paidAt ? upfrontPayment.paidAt.toISOString() : new Date().toISOString(),
      formattedAmount: `${currencySymbol}${money(upfrontPayment.amount).toFixed(2)}`,
    });
  }

  return {
    invoiceId,
    jobCategory,
    totalJobAmount,
    amountPaid,
    dueBalance,
    currencyCode,
    currencySymbol,
    breakdown: breakdownData,
    paymentProgress,
    transactionHistory,
    jobId: job.id,
    jobStatus: job.status,
    isPartPayment: requests.some((r) => r.type === TraderPaymentRequestType.PARTIAL),
    hasPendingPartial,
    flowType: hasPendingPartial ? 'INSTALLMENT_PAYMENT' : null,
    summary: {
      totalJobAmount,
      amountPaid,
      dueBalance,
      pendingAmount,
      paymentStatus: resolveInstallmentStatus(totalJobAmount, amountPaid, pendingAmount),
      currencyCode,
      currencySymbol,
    },
    confirmedPayments,
    pendingPayments,
    paymentRequests: requests.map((r) => serialize(r, symbols.get(r.currencyCode) ?? r.currencyCode)),
  };
};

/**
 * PAID transition inside a transaction. FULL_JOB also completes the job (PAYMENT_PENDING → COMPLETED)
 * and its linked invoice. Returns null if the request is no longer payable.
 */
export const markPaymentRequestPaid = async (
  tx: Prisma.TransactionClient,
  id: string,
  paid: {
    paidAt: Date;
    intentId: string | null;
    details: ChargeDetails | null;
    method: PaymentMethod | null;
  }
) => {
  const claimed = await tx.traderPaymentRequest.updateMany({
    where: { id, status: { in: PAYABLE_STATUSES } },
    data: {
      status: TraderPaymentRequestStatus.PAID,
      paidAt: paid.paidAt,
      ...(paid.intentId ? { stripePaymentIntentId: paid.intentId } : {}),
      cardBrand: paid.details?.cardBrand ?? null,
      cardLast4: paid.details?.cardLast4 ?? null,
      ...(paid.method ? { paymentMethod: paid.method } : {}),
    },
  });
  if (claimed.count === 0) return null;

  const request = await tx.traderPaymentRequest.findUniqueOrThrow({
    where: { id },
    include: { trader: { select: { userId: true } } },
  });
  let jobStatus: JobStatus | null = null;
  if (request.type === TraderPaymentRequestType.FULL_JOB) {
    const moved = await tx.job.updateMany({
      where: { id: request.jobId, status: JobStatus.PAYMENT_PENDING },
      data: { status: JobStatus.COMPLETED },
    });
    if (moved.count > 0) jobStatus = JobStatus.COMPLETED;
  } else if (request.type === TraderPaymentRequestType.PARTIAL) {
    const job = await tx.job.findUnique({
      where: { id: request.jobId },
      select: { status: true },
    });
    if (
      job &&
      job.status !== JobStatus.IN_PROGRESS &&
      job.status !== JobStatus.COMPLETED &&
      job.status !== JobStatus.CANCELLED
    ) {
      await tx.job.update({
        where: { id: request.jobId },
        data: { status: JobStatus.IN_PROGRESS },
      });
    }
    jobStatus = JobStatus.IN_PROGRESS;
  }
  await tx.invoice.updateMany({
    where: { paymentRequestId: id, status: InvoiceStatus.UNPAID },
    data: { status: InvoiceStatus.PAID },
  });
  await tx.payment.updateMany({
    where: { invoice: { paymentRequestId: id }, status: PaymentStatus.PENDING },
    data: { status: PaymentStatus.FAILED },
  });
  return { request, jobStatus };
};

type PaidPaymentRequest = NonNullable<Awaited<ReturnType<typeof markPaymentRequestPaid>>>;

export const emitPaymentRequestPaidEvent = (result: PaidPaymentRequest, paidAt: Date) =>
  emitPaymentRequestPaid({
    paymentRequestId: result.request.id,
    type: result.request.type,
    jobId: result.request.jobId,
    jobStatus: result.jobStatus,
    status: TraderPaymentRequestStatus.PAID,
    amount: money(result.request.totalAmount),
    currencyCode: result.request.currencyCode,
    customerId: result.request.customerId,
    traderId: result.request.traderId,
    traderUserId: result.request.trader.userId,
    at: paidAt.toISOString(),
  });

/** Idempotent PAID transition (confirm API + Stripe webhook). Returns false if already finalized. */
export const finalizePaymentRequest = async (
  id: string,
  intent: Stripe.PaymentIntent,
  charge?: ChargeDetails
): Promise<boolean> => {
  const details = charge ?? (await getChargeDetails(intent));
  const paidAt = new Date();
  const method = paymentMethodFromCharge(details);

  const result = await prisma.$transaction((tx) =>
    markPaymentRequestPaid(tx, id, { paidAt, intentId: intent.id, details, method })
  );
  if (!result) return false;

  emitPaymentRequestPaidEvent(result, paidAt);
  return true;
};
