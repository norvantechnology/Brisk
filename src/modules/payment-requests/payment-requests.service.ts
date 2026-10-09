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
    title: r.description?.trim() || TYPE_TITLES[r.type],
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
    select: { id: true, status: true, traderId: true, serviceCharge: true, siteVisitFee: true },
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

  const quotePrice = quote ? money(quote.quotedAmount) : job.serviceCharge != null ? money(job.serviceCharge) : null;
  const breakdown =
    job.traderId && quotePrice != null
      ? buildJobPaymentBreakdown({
          quotePrice,
          materialsTotal: materials.reduce((s, m) => s + money(m.price), 0),
          siteVisitFee: money(job.siteVisitFee),
        })
      : null;

  const amountPaid = round2(
    requests.filter((r) => r.status === TraderPaymentRequestStatus.PAID).reduce((s, r) => s + money(r.totalAmount), 0)
  );
  const pendingAmount = round2(requests.filter(isPayable).reduce((s, r) => s + money(r.totalAmount), 0));
  const totalJobAmount = breakdown?.totalAmount ?? 0;

  return {
    jobId: job.id,
    jobStatus: job.status,
    isPartPayment: requests.some((r) => r.type === TraderPaymentRequestType.PARTIAL),
    summary: {
      totalJobAmount,
      amountPaid,
      dueBalance: round2(Math.max(0, totalJobAmount - amountPaid)),
      pendingAmount,
      paymentStatus: resolveInstallmentStatus(totalJobAmount, amountPaid, pendingAmount),
      currencyCode,
      currencySymbol,
    },
    breakdown: breakdown
      ? {
          quotePrice: breakdown.serviceCharge,
          materialsTotal: breakdown.materialsTotal,
          siteVisitFee: breakdown.siteVisitFee,
          platformFee: breakdown.platformFee,
          vatRate: breakdown.vatRate,
          vatAmount: breakdown.vatAmount,
          totalAmount: breakdown.totalAmount,
          currencyCode,
          currencySymbol,
        }
      : null,
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
