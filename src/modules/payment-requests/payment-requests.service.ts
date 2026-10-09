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
import {
  type ChargeDetails,
  STRIPE_KIND_PAYMENT_REQUEST,
  buildClientPaymentConfig,
  ensureStripeCustomer,
  getChargeDetails,
  getStripe,
  paymentMethodFromCharge,
  retrieveSucceededIntent,
  toMinorUnits,
  toPaymentError,
} from '../../services/stripe.service';
import { emitPaymentRequestPaid } from '../../sockets/realtime';
import { buildJobPaymentBreakdown } from '../jobs/job-payment-state';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';

const PAYABLE_STATUSES: TraderPaymentRequestStatus[] = [
  TraderPaymentRequestStatus.SENT,
  TraderPaymentRequestStatus.PENDING,
];

/** Intents that can still be completed by the same PaymentSheet — reuse instead of creating another. */
const REUSABLE_INTENT_STATUSES: Stripe.PaymentIntent.Status[] = [
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
];

const TYPE_TITLES: Record<TraderPaymentRequestType, string> = {
  FULL_JOB: 'Job Payment',
  SITE_VISIT_FEE: 'Site Visit Fee',
  PARTIAL: 'Installment',
};

const money = (value: Prisma.Decimal | number | null | undefined): number =>
  value == null ? 0 : Number(value);

const isPayable = (r: Pick<TraderPaymentRequest, 'status'>) => PAYABLE_STATUSES.includes(r.status);

const serialize = (r: TraderPaymentRequest, currencySymbol: string) => {
  const totalAmount = money(r.totalAmount);
  return {
    id: r.id,
    /** Same display ID as the trader app installment history. */
    transactionId: `TXN-${r.id.replace(/-/g, '').slice(-6).toUpperCase()}`,
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
    canPay: isPayable(r) && totalAmount > 0,
  };
};

const serializeOne = async (r: TraderPaymentRequest) =>
  serialize(r, (await getCurrencyMeta(r.currencyCode)).symbol);

const getOwnedRequest = async (customerId: string, id: string) => {
  const request = await prisma.traderPaymentRequest.findFirst({ where: { id, customerId } });
  if (!request) throw new NotFoundError('Payment request not found.');
  return request;
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

/** Payment Details screen for a trader request — same `job` / `trader` blocks as GET /invoices/{id}. */
export const getPaymentRequest = async (customerId: string, id: string) => {
  const request = await getOwnedRequest(customerId, id);
  const [base, job, trader] = await Promise.all([
    serializeOne(request),
    prisma.job.findUnique({
      where: { id: request.jobId },
      select: {
        id: true,
        jobRef: true,
        title: true,
        status: true,
        quoteType: true,
        scheduledDate: true,
        timeSlot: true,
        addressLine: true,
        city: true,
        postcode: true,
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
      },
    }),
    prisma.trader.findUnique({
      where: { id: request.traderId },
      select: {
        id: true,
        businessName: true,
        avgRating: true,
        verificationStatus: true,
        profilePhotoUrl: true,
        _count: { select: { ratingsReceived: true } },
        user: { select: { fullName: true, profilePhotoUrl: true } },
      },
    }),
  ]);

  return {
    ...base,
    job,
    trader: trader
      ? {
          id: trader.id,
          businessName: trader.businessName,
          fullName: trader.user?.fullName ?? null,
          displayName: trader.businessName || trader.user?.fullName || null,
          profilePhotoUrl: trader.profilePhotoUrl || trader.user?.profilePhotoUrl || null,
          avgRating: Number(trader.avgRating ?? 0),
          reviewsCount: trader._count.ratingsReceived,
          isVerified: trader.verificationStatus === 'VERIFIED',
        }
      : null,
  };
};

/** Start (or resume) Stripe payment for a trader payment request — PaymentSheet config. */
export const createPaymentRequestIntent = async (customerId: string, id: string) => {
  const request = await getOwnedRequest(customerId, id);
  if (request.status === TraderPaymentRequestStatus.PAID) {
    throw new ConflictError('This payment request is already paid.', { code: 'ALREADY_PAID' });
  }
  if (!isPayable(request)) {
    throw new BadRequestError(`Payment request cannot be paid from status ${request.status}.`);
  }
  const amount = money(request.totalAmount);
  if (amount <= 0) throw new BadRequestError('Nothing to pay for this request.');

  try {
    const stripe = getStripe();
    const customerStripeId = await ensureStripeCustomer(customerId);
    const amountMinor = toMinorUnits(amount, request.currencyCode);
    const currency = request.currencyCode.toLowerCase();

    let intent: Stripe.PaymentIntent | null = null;
    if (request.stripePaymentIntentId) {
      const previous = await stripe.paymentIntents.retrieve(request.stripePaymentIntentId);
      if (previous.status === 'succeeded') {
        await finalizePaymentRequest(request.id, previous);
        throw new ConflictError('This payment request is already paid.', { code: 'ALREADY_PAID' });
      }
      if (previous.status === 'processing') {
        throw new ConflictError('Your payment is still processing. Please check again shortly.', {
          code: 'PAYMENT_PROCESSING',
        });
      }
      if (
        REUSABLE_INTENT_STATUSES.includes(previous.status) &&
        previous.amount === amountMinor &&
        previous.currency === currency
      ) {
        intent = previous;
      } else if (REUSABLE_INTENT_STATUSES.includes(previous.status)) {
        await stripe.paymentIntents.cancel(previous.id);
      }
    }

    if (!intent) {
      intent = await stripe.paymentIntents.create(
        {
          amount: amountMinor,
          currency,
          customer: customerStripeId,
          automatic_payment_methods: { enabled: true },
          description: `Brisk ${TYPE_TITLES[request.type]} — job ${request.jobId}`,
          metadata: {
            kind: STRIPE_KIND_PAYMENT_REQUEST,
            paymentRequestId: request.id,
            jobId: request.jobId,
            traderId: request.traderId,
            userId: customerId,
          },
        },
        { idempotencyKey: `payment-request-${request.id}-${request.stripePaymentIntentId ?? 'first'}` }
      );
      await prisma.traderPaymentRequest.update({
        where: { id: request.id },
        data: { stripePaymentIntentId: intent.id },
      });
    }

    return {
      paymentRequestId: request.id,
      type: request.type,
      amount,
      currencyCode: request.currencyCode,
      currencySymbol: (await getCurrencyMeta(request.currencyCode)).symbol,
      requiresPayment: true,
      ...(await buildClientPaymentConfig(customerStripeId, intent)),
    };
  } catch (error) {
    throw toPaymentError(error);
  }
};

/** Called after PaymentSheet success — verifies with Stripe, then marks the request PAID. */
export const confirmPaymentRequest = async (customerId: string, id: string) => {
  const request = await getOwnedRequest(customerId, id);
  if (request.status === TraderPaymentRequestStatus.PAID) return serializeOne(request);
  if (!isPayable(request)) {
    throw new BadRequestError(`Payment request cannot be paid from status ${request.status}.`);
  }
  if (!request.stripePaymentIntentId) {
    throw new BadRequestError('This payment was not started. Please tap Pay again.', {
      code: 'PAYMENT_INTENT_MISSING',
    });
  }

  try {
    const intent = await retrieveSucceededIntent(
      request.stripePaymentIntentId,
      money(request.totalAmount),
      request.currencyCode
    );
    await finalizePaymentRequest(request.id, intent);
  } catch (error) {
    throw toPaymentError(error);
  }
  return serializeOne(await getOwnedRequest(customerId, id));
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
