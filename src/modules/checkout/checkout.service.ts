import {
  DiscountType,
  InvoiceStatus,
  JobQuoteType,
  JobStatus,
  OfferClaimStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { computeInvoiceBreakdown } from '../jobs/jobs.service';
import type {
  ApplyPromoInput,
  ConfirmPaymentInput,
  CreatePaymentIntentInput,
  FailPaymentInput,
} from './checkout.validation';
import {
  emitInvoiceUpdated,
  emitPaymentCompleted,
  emitPaymentFailed,
} from '../../sockets/realtime';

const money = (value: Prisma.Decimal | number | null | undefined): number =>
  value == null ? 0 : Number(value);

const round2 = (n: number) => Math.round(n * 100) / 100;

const generateTransactionRef = () => `TXN-${randomBytes(4).toString('hex').toUpperCase()}`;

const computePromoDiscount = (
  baseAmount: number,
  discountType: DiscountType,
  discountValue: number
): number => {
  let discount = 0;
  switch (discountType) {
    case DiscountType.FLAT:
      discount = discountValue;
      break;
    case DiscountType.PERCENTAGE:
      discount = (baseAmount * discountValue) / 100;
      break;
    case DiscountType.FREE_SERVICE:
      discount = baseAmount;
      break;
    default:
      discount = 0;
  }
  return round2(Math.min(Math.max(discount, 0), baseAmount));
};

const invoiceOwnershipInclude = {
  booking: {
    include: {
      job: {
        include: {
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
          offer: {
            select: {
              id: true,
              title: true,
              discountType: true,
              discountValue: true,
              discountLabel: true,
              currencyCode: true,
            },
          },
          claim: { select: { id: true, status: true } },
          photos: { take: 1, orderBy: { createdAt: 'asc' as const } },
        },
      },
      trader: {
        select: {
          id: true,
          businessName: true,
          avgRating: true,
          topRated: true,
          verificationStatus: true,
          yearsExperience: true,
          profilePhotoUrl: true,
          _count: { select: { ratingsReceived: true } },
          user: { select: { fullName: true, profilePhotoUrl: true } },
        },
      },
      customer: {
        select: { id: true, fullName: true, email: true },
      },
    },
  },
  payments: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof invoiceOwnershipInclude }>;

const assertInvoiceOwner = (invoice: InvoiceWithRelations, userId: string) => {
  if (invoice.booking.customerId !== userId) {
    throw new ForbiddenError('You do not have access to this invoice.');
  }
};

const serializeInvoiceBreakdown = (invoice: {
  serviceCharge: Prisma.Decimal;
  traderOfferDiscount: Prisma.Decimal;
  promoDiscount: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  tax: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  currencyCode: string;
}) => ({
  serviceCharge: money(invoice.serviceCharge),
  traderOfferDiscount: money(invoice.traderOfferDiscount),
  promoDiscount: money(invoice.promoDiscount),
  platformFee: money(invoice.platformFee),
  tax: money(invoice.tax),
  totalAmount: money(invoice.totalAmount),
  currencyCode: invoice.currencyCode,
});

const buildLineItems = (
  invoice: {
    serviceCharge: Prisma.Decimal;
    traderOfferDiscount: Prisma.Decimal;
    promoDiscount: Prisma.Decimal;
    platformFee: Prisma.Decimal;
    tax: Prisma.Decimal;
  },
  purpose: 'SERVICE' | 'SITE_VISIT_FEE' = 'SERVICE'
) => {
  /** Labels empty — mobile owns display copy; keys identify the row. */
  const items: Array<{ key: string; label: string; amount: number; type: 'charge' | 'discount' | 'fee' }> = [
    {
      key: purpose === 'SITE_VISIT_FEE' ? 'siteVisitFee' : 'serviceCharge',
      label: '',
      amount: money(invoice.serviceCharge),
      type: 'charge',
    },
  ];
  if (money(invoice.platformFee) > 0) {
    items.push({
      key: 'platformFee',
      label: '',
      amount: money(invoice.platformFee),
      type: 'fee',
    });
  }
  if (money(invoice.traderOfferDiscount) > 0) {
    items.push({
      key: 'traderOfferDiscount',
      label: '',
      amount: -money(invoice.traderOfferDiscount),
      type: 'discount',
    });
  }
  if (money(invoice.promoDiscount) > 0) {
    items.push({
      key: 'promoDiscount',
      label: '',
      amount: -money(invoice.promoDiscount),
      type: 'discount',
    });
  }
  if (money(invoice.tax) > 0) {
    items.push({ key: 'tax', label: '', amount: money(invoice.tax), type: 'fee' });
  }
  return items;
};

const resolveInvoicePurpose = (job: {
  quoteType?: JobQuoteType | null;
  siteVisitRequested?: boolean;
}): 'SERVICE' | 'SITE_VISIT_FEE' =>
  job.quoteType === JobQuoteType.ONSITE || job.siteVisitRequested
    ? 'SITE_VISIT_FEE'
    : 'SERVICE';

const formatTimeSlotRange = (timeSlot?: string | null) => {
  // No static slot ranges — return the stored timeSlot value only.
  return timeSlot?.trim() || null;
};

const currencySymbol = (code: string) =>
  ({ EUR: '€', GBP: '£', USD: '$', INR: '₹' }[code] ?? code);

const formatMoneyLabel = (amount: number, currencyCode: string) =>
  `${currencySymbol(currencyCode)}${amount.toFixed(2)}`;

const buildPromoTitle = (input: {
  discountType: DiscountType;
  discountValue: number;
  currencyCode: string;
  offerTitle?: string | null;
  categoryName?: string | null;
}) => {
  if (input.offerTitle?.trim()) return input.offerTitle.trim();
  const cat = input.categoryName?.trim() || 'All Category';
  const sym = currencySymbol(input.currencyCode);
  if (input.discountType === DiscountType.PERCENTAGE) {
    return `${input.discountValue}% OFF ${cat}`;
  }
  if (input.discountType === DiscountType.FREE_SERVICE) {
    return `Free Service — ${cat}`;
  }
  return `${sym}${input.discountValue} Off ${cat}`;
};

/** Payment Details → Brisk Offers bottom sheet items (promo codes). */
const loadBriskOffersSheet = async (jobCategoryId?: string | null) => {
  const now = new Date();
  const codes = await prisma.promoCode.findMany({
    where: {
      active: true,
      validFrom: { lte: now },
      validUntil: { gte: now },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      offer: { select: { id: true, title: true } },
    },
    take: 50,
  });

  const categoryIds = Array.from(
    new Set(
      codes
        .flatMap((c) => (c.categoryScope ? c.categoryScope.split(',').map((s) => s.trim()) : []))
        .filter(Boolean)
    )
  );
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const items = codes.map((code) => {
    const scopeIds = code.categoryScope
      ? code.categoryScope.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const primaryCategoryId = scopeIds[0] ?? null;
    const categoryName = primaryCategoryId
      ? categoryNameById.get(primaryCategoryId) ?? null
      : null;
    const discountValue = money(code.discountValue);
    const title = buildPromoTitle({
      discountType: code.discountType,
      discountValue,
      currencyCode: code.currencyCode,
      offerTitle: code.offer?.title,
      categoryName,
    });
    const discountLabel =
      code.discountType === DiscountType.PERCENTAGE
        ? `${discountValue}% Off`
        : code.discountType === DiscountType.FREE_SERVICE
          ? 'Free'
          : `${currencySymbol(code.currencyCode)}${discountValue} Off`;

    return {
      id: code.id,
      title,
      code: code.code,
      couponCode: code.code,
      discountType: code.discountType,
      discountValue,
      discountLabel,
      currencyCode: code.currencyCode,
      categoryId: primaryCategoryId ?? '',
      categoryIds: scopeIds,
      categoryName: categoryName ?? (scopeIds.length ? '' : 'All'),
      categoryScope: code.categoryScope ?? '',
      validFrom: code.validFrom,
      validUntil: code.validUntil,
      offerId: code.offerId ?? '',
      appliesToJobCategory:
        !jobCategoryId ||
        scopeIds.length === 0 ||
        scopeIds.includes(jobCategoryId),
    };
  });

  // Prefer codes that apply to this job category first, then others for browsing.
  items.sort((a, b) => Number(b.appliesToJobCategory) - Number(a.appliesToJobCategory));

  const categoryFilters = [
    { key: 'ALL', label: 'All', categoryId: '' },
    ...categories.map((c) => ({ key: c.id, label: c.name, categoryId: c.id })),
  ];

  return {
    sheetTitle: '',
    searchPlaceholder: '',
    applyPath: '/invoices/{invoiceId}/apply-promo',
    categoryFilters,
    items,
    /** Alias — same list for mobile models that expect promoCodes */
    promoCodes: items,
  };
};

const serializeInvoice = (invoice: InvoiceWithRelations) => {
  const job = invoice.booking.job;
  const trader = invoice.booking.trader;
  const breakdown = serializeInvoiceBreakdown(invoice);
  const purpose = resolveInvoicePurpose(job);
  const serviceProvider =
    trader?.businessName || trader?.user?.fullName || null;
  const orderId = invoice.invoiceNumber || invoice.booking.bookingRef || invoice.id;
  const totalFormatted = formatMoneyLabel(breakdown.totalAmount, invoice.currencyCode);
  const slotRange = formatTimeSlotRange(job.timeSlot);
  const visitSlotLabel =
    job.scheduledDate && slotRange
      ? `${new Date(job.scheduledDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}, ${slotRange}`
      : job.scheduledDate
        ? new Date(job.scheduledDate).toISOString()
        : null;

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    orderId,
    status: invoice.status,
    bookingId: invoice.bookingId,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    purpose,
    screenTitle: '',
    ...breakdown,
    siteVisitFee: purpose === 'SITE_VISIT_FEE' ? breakdown.serviceCharge : 0,
    currencySymbol: currencySymbol(invoice.currencyCode),
    totalFormatted,
    payNowLabel: '',
    confirmPayLabel: '',
    feeNote: '',
    lineItems: buildLineItems(invoice, purpose),
    serviceSummary: {
      categoryName: job.category?.name ?? '',
      subcategoryName: job.subcategory?.name ?? '',
      title: job.title,
      orderId,
      jobRef: job.jobRef,
      serviceProvider: serviceProvider ?? '',
      scheduledDate: job.scheduledDate,
      timeSlot: job.timeSlot ?? '',
      timeSlotRange: slotRange ?? '',
      visitSlotLabel: visitSlotLabel ?? '',
    },
    booking: {
      id: invoice.booking.id,
      bookingRef: invoice.booking.bookingRef,
      status: invoice.booking.status,
      scheduledDate: invoice.booking.scheduledDate,
    },
    job: {
      id: job.id,
      jobRef: job.jobRef,
      title: job.title,
      description: job.description,
      status: job.status,
      quoteType: job.quoteType,
      siteVisitRequested: job.siteVisitRequested,
      siteVisitFee: job.siteVisitFee != null ? money(job.siteVisitFee) : null,
      scheduledDate: job.scheduledDate,
      timeSlot: job.timeSlot,
      durationLabel: job.durationLabel,
      addressLine: job.addressLine,
      city: job.city,
      postcode: job.postcode,
      category: job.category,
      subcategory: job.subcategory,
      offer: job.offer
        ? {
            id: job.offer.id,
            title: job.offer.title,
            discountType: job.offer.discountType,
            discountValue: money(job.offer.discountValue),
            discountLabel: job.offer.discountLabel,
            currencyCode: job.offer.currencyCode,
          }
        : null,
      offerApplied: Boolean(job.offer),
      coverPhotoUrl: job.photos[0]?.photoUrl ?? null,
    },
    trader: trader
      ? {
          id: trader.id,
          businessName: trader.businessName,
          fullName: trader.user?.fullName ?? null,
          displayName: trader.businessName || trader.user?.fullName || null,
          avgRating: Number(trader.avgRating ?? 0),
          reviewsCount: trader._count?.ratingsReceived ?? 0,
          topRated: trader.topRated,
          isVerified: trader.verificationStatus === 'VERIFIED',
          yearsExperience: trader.yearsExperience ?? 0,
          profilePhotoUrl:
            trader.profilePhotoUrl ?? trader.user?.profilePhotoUrl ?? null,
        }
      : null,
    paymentMethods: [
      { key: 'APPLE_PAY', label: 'Pay with Apple Pay', enabled: true },
      { key: 'GOOGLE_PAY', label: 'Pay with Google Pay', enabled: true },
      { key: 'CARD', label: 'Credit/Debit Card', provider: 'stripe', enabled: true },
    ],
    billingTypes: [
      { key: 'INDIVIDUAL', label: 'Individual/Personal Billing' },
      { key: 'COMPANY', label: 'Company Billing' },
    ],
    paymentStatus: invoice.payments[0]?.status ?? null,
    latestPaymentId: invoice.payments[0]?.id ?? null,
    /** True when a promo discount is on the invoice (re-apply still allowed while UNPAID). */
    promoApplied: money(invoice.promoDiscount) > 0,
  };
};

const buildReceipt = async (paymentId: string, userId: string) => {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    include: {
      invoice: {
        include: invoiceOwnershipInclude,
      },
    },
  });
  if (!payment) throw new NotFoundError('Payment not found.');

  const invoice = payment.invoice;
  const job = invoice.booking.job;
  const trader = invoice.booking.trader;
  const amountPaid = money(payment.amount);
  const isPaid = payment.status === PaymentStatus.COMPLETED;
  const purpose = resolveInvoicePurpose(job);

  return {
    paymentId: payment.id,
    transactionId: payment.transactionRef,
    transactionRef: payment.transactionRef,
    status: payment.status,
    method: payment.method,
    amount: amountPaid,
    amountPaid,
    amountPaidFormatted: formatMoneyLabel(amountPaid, payment.currencyCode),
    currencyCode: payment.currencyCode,
    currencySymbol: currencySymbol(payment.currencyCode),
    paidAt: payment.paidAt,
    cardLast4: payment.cardLast4,
    cardBrand: payment.cardBrand,
    billingType: payment.billingType,
    companyName: payment.companyName,
    purpose,
    title: '',
    message: '',
    /** Success screen steps — keys only; labels owned by mobile. */
    timeline: [
      { key: 'PAID', label: '', completed: isPaid, at: payment.paidAt },
      {
        key: 'CONFIRMED',
        label: '',
        completed: isPaid,
        at: isPaid ? payment.paidAt : null,
      },
      { key: 'SERVICE', label: '', completed: false, at: null },
    ],
    receiptSummary: {
      transactionId: payment.transactionRef,
      date: payment.paidAt,
      amountPaid,
      amountPaidFormatted: formatMoneyLabel(amountPaid, payment.currencyCode),
    },
    actions: {
      viewJob: {
        method: 'GET',
        path: `/jobs/${job.id}`,
      },
      backToHome: { path: '/' },
    },
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.invoiceNumber || invoice.booking.bookingRef,
      status: invoice.status,
      purpose,
      ...serializeInvoiceBreakdown(invoice),
      lineItems: buildLineItems(invoice, purpose),
    },
    booking: {
      id: invoice.booking.id,
      bookingRef: invoice.booking.bookingRef,
      status: invoice.booking.status,
      scheduledDate: invoice.booking.scheduledDate,
    },
    job: {
      id: job.id,
      jobRef: job.jobRef,
      title: job.title,
      status: job.status,
      quoteType: job.quoteType,
      siteVisitRequested: job.siteVisitRequested,
      scheduledDate: job.scheduledDate,
      timeSlot: job.timeSlot,
      durationLabel: job.durationLabel,
      addressLine: job.addressLine,
      city: job.city,
      postcode: job.postcode,
      category: job.category,
      subcategory: job.subcategory,
    },
    trader: trader
      ? {
          id: trader.id,
          businessName: trader.businessName,
          fullName: trader.user?.fullName ?? null,
          displayName: trader.businessName || trader.user?.fullName || null,
          avgRating: Number(trader.avgRating ?? 0),
          reviewsCount: trader._count?.ratingsReceived ?? 0,
          isVerified: trader.verificationStatus === 'VERIFIED',
        }
      : null,
  };
};

export const getInvoice = async (userId: string, invoiceId: string) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: invoiceOwnershipInclude,
  });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  assertInvoiceOwner(invoice, userId);
  const base = serializeInvoice(invoice);
  const briskOffers = await loadBriskOffersSheet(invoice.booking.job.categoryId);
  return {
    ...base,
    briskOffers,
    promoCodes: briskOffers.items,
  };
};

/** Clear promo when customer changes job location while still unpaid (Payment Details). */
export const clearInvoicePromoIfApplied = async (invoiceId: string) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      booking: {
        include: {
          job: { select: { quoteType: true, siteVisitRequested: true } },
        },
      },
    },
  });
  if (!invoice || invoice.status !== InvoiceStatus.UNPAID) return;
  if (money(invoice.promoDiscount) <= 0) return;

  const purpose = resolveInvoicePurpose(invoice.booking.job);
  const breakdown = computeInvoiceBreakdown({
    serviceCharge: money(invoice.serviceCharge),
    traderOfferDiscount: money(invoice.traderOfferDiscount),
    promoDiscount: 0,
    currencyCode: invoice.currencyCode,
    purpose,
  });

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      promoDiscount: breakdown.promoDiscount,
      platformFee: breakdown.platformFee,
      tax: breakdown.tax,
      totalAmount: breakdown.totalAmount,
    },
  });
};

export const applyPromo = async (userId: string, invoiceId: string, input: ApplyPromoInput) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: invoiceOwnershipInclude,
  });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  assertInvoiceOwner(invoice, userId);

  if (invoice.status !== InvoiceStatus.UNPAID) {
    throw new BadRequestError('Promo codes can only be applied to unpaid invoices.');
  }

  // One promo at a time (no stacking). Re-apply / replace is allowed while UNPAID
  // (e.g. after location change on Payment Details).
  const code = input.code.trim().toUpperCase();
  const promo = await prisma.promoCode.findFirst({
    where: {
      code: { equals: code, mode: 'insensitive' },
    },
  });
  if (!promo || !promo.active) {
    throw new BadRequestError('Invalid or inactive promo code.');
  }

  const now = new Date();
  if (promo.validFrom.getTime() > now.getTime() || promo.validUntil.getTime() < now.getTime()) {
    throw new BadRequestError('This promo code is not currently valid.');
  }

  if (promo.categoryScope) {
    const jobCategoryId = invoice.booking.job.categoryId;
    const jobCategoryName = invoice.booking.job.category.name;
    const scope = promo.categoryScope.trim();
    const matchesId = scope.toLowerCase() === jobCategoryId.toLowerCase();
    const matchesName = scope.toLowerCase() === jobCategoryName.toLowerCase();
    if (!matchesId && !matchesName) {
      throw new BadRequestError('This promo code does not apply to this job category.');
    }
  }

  const serviceCharge = money(invoice.serviceCharge);
  const traderOfferDiscount = money(invoice.traderOfferDiscount);
  const postOffer = Math.max(serviceCharge - traderOfferDiscount, 0);
  const promoDiscount = computePromoDiscount(
    postOffer,
    promo.discountType,
    money(promo.discountValue)
  );

  // Must preserve SITE_VISIT_FEE (platformFee = 0). Omitting purpose defaulted to SERVICE
  // and added 10% fee, cancelling the promo (e.g. €30 − €3 + €3 = €30).
  const purpose = resolveInvoicePurpose(invoice.booking.job);
  const breakdown = computeInvoiceBreakdown({
    serviceCharge,
    traderOfferDiscount,
    promoDiscount,
    currencyCode: invoice.currencyCode,
    purpose,
  });

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      promoDiscount: breakdown.promoDiscount,
      platformFee: breakdown.platformFee,
      tax: breakdown.tax,
      totalAmount: breakdown.totalAmount,
    },
    include: invoiceOwnershipInclude,
  });

  const briskOffers = await loadBriskOffersSheet(updated.booking.job.categoryId);
  const serialized = {
    ...serializeInvoice(updated),
    promoCode: promo.code,
    briskOffers,
    promoCodes: briskOffers.items,
  };
  emitInvoiceUpdated({
    invoiceId: updated.id,
    jobId: updated.booking.job.id,
    status: updated.status,
    totalAmount: money(updated.totalAmount),
    promoDiscount: money(updated.promoDiscount),
    promoApplied: money(updated.promoDiscount) > 0,
    customerId: userId,
    at: new Date().toISOString(),
  });
  return serialized;
};

export const createPaymentIntent = async (userId: string, input: CreatePaymentIntentInput) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: invoiceOwnershipInclude,
  });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  assertInvoiceOwner(invoice, userId);

  if (invoice.status === InvoiceStatus.PAID) {
    throw new BadRequestError('This invoice is already paid.');
  }
  if (invoice.status === InvoiceStatus.REFUNDED) {
    throw new BadRequestError('Cannot pay a refunded invoice.');
  }

  const existingCompleted = invoice.payments.find((p) => p.status === PaymentStatus.COMPLETED);
  if (existingCompleted) {
    throw new BadRequestError('A completed payment already exists for this invoice.');
  }

  // New Pay Now attempt: supersede older pending/failed intents so mobile uses this paymentId.
  await prisma.payment.updateMany({
    where: {
      invoiceId: invoice.id,
      status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
    },
    data: { status: PaymentStatus.FAILED },
  });

  const amount = money(invoice.totalAmount);
  const stripePaymentIntentId = `pi_mock_${randomUUID()}`;

  const payment = await prisma.payment.create({
    data: {
      transactionRef: generateTransactionRef(),
      invoiceId: invoice.id,
      userId,
      stripePaymentIntentId,
      method: input.method,
      billingType: input.billingType,
      companyName: input.companyName,
      tinNumber: input.tinNumber,
      serviceCharge: money(invoice.serviceCharge),
      feeAmount: money(invoice.platformFee),
      discountAmount: round2(
        money(invoice.traderOfferDiscount) + money(invoice.promoDiscount)
      ),
      amount,
      currencyCode: invoice.currencyCode,
      status: PaymentStatus.PENDING,
    },
  });

  const publishableKey =
    env.STRIPE_PUBLISHABLE_KEY ?? 'pk_test_brisk_mock_replace_via_env';
  const stripeMerchantIdentifier =
    env.STRIPE_MERCHANT_IDENTIFIER ?? 'merchant.com.brisk';
  const usingLiveStripe = Boolean(env.STRIPE_PUBLISHABLE_KEY);

  return {
    paymentId: payment.id,
    transactionId: payment.transactionRef,
    transactionRef: payment.transactionRef,
    clientSecret: usingLiveStripe
      ? `pi_pending_${payment.id}_secret_${payment.id}`
      : `mock_secret_${payment.id}`,
    publishableKey,
    stripeMerchantIdentifier,
    amount: money(payment.amount),
    amountFormatted: formatMoneyLabel(money(payment.amount), payment.currencyCode),
    currencyCode: payment.currencyCode,
    currencySymbol: currencySymbol(payment.currencyCode),
    method: payment.method,
    status: payment.status,
    mock: !usingLiveStripe,
    billingAddress: input.billingAddress ?? null,
    invoiceId: invoice.id,
    orderId: invoice.invoiceNumber || invoice.booking.bookingRef,
    payNowLabel: '',
  };
};

export const confirmPayment = async (
  userId: string,
  paymentId: string,
  input: ConfirmPaymentInput
) => {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    include: { invoice: true },
  });
  if (!payment) throw new NotFoundError('Payment not found.');

  if (payment.status === PaymentStatus.COMPLETED) {
    return buildReceipt(payment.id, userId);
  }

  // Invoice already paid via another intent (fail-test → new intent → success, then
  // retry confirm on old FAILED paymentId). Return that success receipt — no 400.
  if (payment.invoice.status === InvoiceStatus.PAID) {
    const completed = await prisma.payment.findFirst({
      where: {
        invoiceId: payment.invoiceId,
        userId,
        status: PaymentStatus.COMPLETED,
      },
      orderBy: { paidAt: 'desc' },
    });
    if (completed) {
      return buildReceipt(completed.id, userId);
    }
    throw new BadRequestError('Invoice is already paid.');
  }

  // FAILED is retriable while invoice is still UNPAID.
  if (
    payment.status !== PaymentStatus.PENDING &&
    payment.status !== PaymentStatus.FAILED
  ) {
    throw new BadRequestError(`Payment cannot be confirmed from status ${payment.status}.`);
  }

  const paidAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.COMPLETED,
        paidAt,
        cardLast4: input.cardLast4,
        cardBrand: input.cardBrand,
      },
    });

    await tx.payment.updateMany({
      where: {
        invoiceId: payment.invoiceId,
        id: { not: payment.id },
        status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
      },
      data: { status: PaymentStatus.FAILED },
    });

    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: InvoiceStatus.PAID },
    });

    // Claim / apply offer only on Payment Successful — create or update → USED.
    // Job goes live (SCHEDULED) only after payment succeeds.
    const booking = await tx.booking.findUnique({
      where: { id: payment.invoice.bookingId },
      include: {
        job: {
          select: {
            id: true,
            claimId: true,
            offerId: true,
            quoteType: true,
            siteVisitRequested: true,
          },
        },
      },
    });
    const job = booking?.job;
    if (job) {
      const nextStatus =
        job.quoteType === JobQuoteType.ONSITE || job.siteVisitRequested
          ? JobStatus.SCHEDULED
          : JobStatus.SCHEDULED;

      if (job.offerId) {
        const existingClaim = await tx.offerClaim.findUnique({
          where: { offerId_userId: { offerId: job.offerId, userId } },
        });
        if (existingClaim?.status === OfferClaimStatus.USED && existingClaim.jobId !== job.id) {
          throw new ConflictError('You have already used this offer.');
        }
        const claimId = existingClaim
          ? (
              await tx.offerClaim.update({
                where: { id: existingClaim.id },
                data: {
                  status: OfferClaimStatus.USED,
                  usedAt: paidAt,
                  claimedAt: existingClaim.claimedAt ?? paidAt,
                  jobId: job.id,
                },
              })
            ).id
          : (
              await tx.offerClaim.create({
                data: {
                  offerId: job.offerId,
                  userId,
                  status: OfferClaimStatus.USED,
                  claimedAt: paidAt,
                  usedAt: paidAt,
                  jobId: job.id,
                },
              })
            ).id;
        if (!existingClaim) {
          await tx.offer.update({
            where: { id: job.offerId },
            data: { claimsCount: { increment: 1 } },
          });
        }
        await tx.job.update({
          where: { id: job.id },
          data: {
            status: nextStatus,
            ...(job.claimId !== claimId ? { claimId } : {}),
          },
        });
      } else {
        await tx.job.update({
          where: { id: job.id },
          data: { status: nextStatus },
        });
      }
    }
  });

  const receipt = await buildReceipt(payment.id, userId);
  const booking = await prisma.booking.findUnique({
    where: { id: payment.invoice.bookingId },
    select: {
      id: true,
      jobId: true,
      traderId: true,
      trader: { select: { userId: true } },
      job: { select: { customerId: true, status: true } },
    },
  });
  emitPaymentCompleted({
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    jobId: booking?.jobId ?? null,
    bookingId: booking?.id ?? null,
    status: PaymentStatus.COMPLETED,
    amount: money(payment.amount),
    customerId: userId,
    traderId: booking?.traderId ?? null,
    traderUserId: booking?.trader?.userId ?? null,
    at: new Date().toISOString(),
  });
  return receipt;
};

export const failPayment = async (
  userId: string,
  paymentId: string,
  input: FailPaymentInput
) => {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    include: { invoice: { include: invoiceOwnershipInclude } },
  });
  if (!payment) throw new NotFoundError('Payment not found.');

  if (payment.status === PaymentStatus.COMPLETED) {
    throw new BadRequestError('This payment is already completed.');
  }

  if (payment.status !== PaymentStatus.FAILED) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });
  }

  const invoice = payment.invoice;
  const amount = money(payment.amount);

  emitPaymentFailed({
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    jobId: invoice.booking.job.id,
    bookingId: invoice.bookingId,
    status: PaymentStatus.FAILED,
    amount,
    customerId: userId,
    traderId: invoice.booking.trader?.id ?? null,
    at: new Date().toISOString(),
  });

  return {
    paymentId: payment.id,
    transactionId: payment.transactionRef,
    transactionRef: payment.transactionRef,
    status: PaymentStatus.FAILED,
    method: payment.method,
    amount,
    amountFormatted: formatMoneyLabel(amount, payment.currencyCode),
    currencyCode: payment.currencyCode,
    currencySymbol: currencySymbol(payment.currencyCode),
    title: 'Payment Failed',
    message: input.reason || 'Your payment could not be completed. Please try again.',
    reason: input.reason ?? null,
    timeline: [
      { key: 'PAID', label: 'Paid', completed: false, at: null },
      { key: 'CONFIRMED', label: 'Confirmed', completed: false, at: null },
      { key: 'SERVICE', label: 'Service', completed: false, at: null },
    ],
    actions: {
      retryPayment: {
        method: 'POST',
        path: '/payments/intent',
        invoiceId: payment.invoiceId,
      },
      viewInvoice: { method: 'GET', path: `/invoices/${payment.invoiceId}` },
      backToHome: { path: '/' },
    },
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.invoiceNumber || invoice.booking.bookingRef,
      status: invoice.status,
      totalAmount: money(invoice.totalAmount),
    },
  };
};

export const getPaymentReceipt = async (userId: string, paymentId: string) => {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
  });
  if (!payment) throw new NotFoundError('Payment not found.');
  if (payment.status !== PaymentStatus.COMPLETED) {
    throw new BadRequestError('Receipt is available after payment is completed.');
  }
  return buildReceipt(paymentId, userId);
};

export const getBooking = async (userId: string, bookingId: string) => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customerId: userId },
    include: {
      job: {
        include: {
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
          photos: { orderBy: { createdAt: 'asc' } },
          offer: {
            select: {
              id: true,
              title: true,
              discountLabel: true,
              discountType: true,
              discountValue: true,
            },
          },
          address: true,
        },
      },
      trader: {
        select: {
          id: true,
          businessName: true,
          profilePhotoUrl: true,
          user: { select: { fullName: true } },
        },
      },
      invoice: {
        include: {
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  if (!booking) throw new NotFoundError('Booking not found.');

  const latestPayment = booking.invoice?.payments[0] ?? null;

  const traderDisplayName =
    booking.trader.businessName || booking.trader.user?.fullName || null;

  return {
    id: booking.id,
    bookingRef: booking.bookingRef,
    status: booking.status,
    scheduledDate: booking.scheduledDate,
    createdAt: booking.createdAt,
    job: {
      id: booking.job.id,
      jobRef: booking.job.jobRef,
      title: booking.job.title,
      description: booking.job.description,
      status: booking.job.status,
      scheduledDate: booking.job.scheduledDate,
      timeSlot: booking.job.timeSlot,
      durationLabel: booking.job.durationLabel,
      phoneNumber: booking.job.phoneNumber,
      addressLine: booking.job.addressLine,
      city: booking.job.city,
      postcode: booking.job.postcode,
      latitude: booking.job.latitude,
      longitude: booking.job.longitude,
      serviceCharge:
        booking.job.serviceCharge != null ? money(booking.job.serviceCharge) : null,
      category: booking.job.category,
      subcategory: booking.job.subcategory,
      offerApplied: Boolean(booking.job.offer),
      offer: booking.job.offer
        ? {
            id: booking.job.offer.id,
            title: booking.job.offer.title,
            discountLabel: booking.job.offer.discountLabel,
            discountType: booking.job.offer.discountType,
            discountValue: money(booking.job.offer.discountValue),
            bannerTitle: booking.job.offer.title,
            bannerSubtitle: booking.job.offer.discountLabel,
          }
        : null,
      photos: booking.job.photos.map((p) => ({
        id: p.id,
        photoUrl: p.photoUrl,
      })),
      coverPhotoUrl: booking.job.photos[0]?.photoUrl ?? null,
      address: booking.job.address
        ? {
            id: booking.job.address.id,
            label: booking.job.address.label ?? booking.job.address.addressType,
            addressLine1: booking.job.address.addressLine1,
            city: booking.job.address.city,
            eircode: booking.job.address.eircode,
          }
        : null,
    },
    trader: {
      id: booking.trader.id,
      businessName: booking.trader.businessName,
      profilePhotoUrl: booking.trader.profilePhotoUrl,
      fullName: booking.trader.user?.fullName ?? null,
      displayName: traderDisplayName,
    },
    invoice: booking.invoice
      ? {
          id: booking.invoice.id,
          invoiceNumber: booking.invoice.invoiceNumber,
          orderId: booking.invoice.invoiceNumber || booking.bookingRef,
          status: booking.invoice.status,
          ...serializeInvoiceBreakdown(booking.invoice),
          lineItems: buildLineItems(booking.invoice),
          totalFormatted: formatMoneyLabel(
            money(booking.invoice.totalAmount),
            booking.invoice.currencyCode
          ),
        }
      : null,
    payment: latestPayment
      ? {
          id: latestPayment.id,
          transactionId: latestPayment.transactionRef,
          transactionRef: latestPayment.transactionRef,
          status: latestPayment.status,
          method: latestPayment.method,
          amount: money(latestPayment.amount),
          amountPaid: money(latestPayment.amount),
          paidAt: latestPayment.paidAt,
        }
      : null,
  };
};
