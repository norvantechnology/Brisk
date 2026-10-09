import {
  DiscountType,
  InvoiceStatus,
  JobQuoteType,
  JobStatus,
  OfferClaimStatus,
  PaymentStatus,
  Prisma,
  TraderPaymentRequestStatus,
  TraderPaymentRequestType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';
import {
  type ChargeDetails,
  STRIPE_KIND_INVOICE,
  assertIntentMatches,
  buildClientPaymentConfig,
  cancelPaymentIntentQuietly,
  ensureStripeCustomer,
  getChargeDetails,
  getStripe,
  isStripeConfigured,
  paymentMethodFromCharge,
  retrieveSucceededIntent,
  toMinorUnits,
  toPaymentError,
} from '../../services/stripe.service';
import { computeInvoiceBreakdown } from '../jobs/jobs.service';
import {
  emitPaymentRequestPaidEvent,
  markPaymentRequestPaid,
} from '../payment-requests/payment-requests.service';
import type {
  ApplyPromoInput,
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

const invoiceJobInclude = {
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
} satisfies Prisma.JobInclude;

const invoiceTraderSelect = {
  id: true,
  userId: true,
  businessName: true,
  avgRating: true,
  topRated: true,
  verificationStatus: true,
  yearsExperience: true,
  profilePhotoUrl: true,
  _count: { select: { ratingsReceived: true } },
  user: { select: { fullName: true, profilePhotoUrl: true } },
} satisfies Prisma.TraderSelect;

const invoiceBookingSelect = {
  id: true,
  bookingRef: true,
  status: true,
  scheduledDate: true,
} satisfies Prisma.BookingSelect;

const invoiceOwnershipInclude = {
  booking: {
    include: {
      job: { include: invoiceJobInclude },
      trader: { select: invoiceTraderSelect },
      customer: {
        select: { id: true, fullName: true, email: true },
      },
    },
  },
  payments: { orderBy: { createdAt: 'desc' as const } },
  paymentRequest: {
    select: {
      id: true,
      type: true,
      status: true,
      customerId: true,
      materialsTotal: true,
      siteVisitFee: true,
      vatRate: true,
      job: { include: { ...invoiceJobInclude, booking: { select: invoiceBookingSelect } } },
      trader: { select: invoiceTraderSelect },
    },
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof invoiceOwnershipInclude }>;

/** Upfront invoice → its booking; payment-request invoice → the request's job / trader / customer. */
const invoiceContext = (invoice: InvoiceWithRelations) => {
  if (invoice.booking) {
    const { job, trader, customerId } = invoice.booking;
    return { job, trader, customerId, booking: invoice.booking };
  }
  const request = invoice.paymentRequest;
  if (!request) throw new NotFoundError('Invoice not found.');
  return {
    job: request.job,
    trader: request.trader,
    customerId: request.customerId,
    booking: request.job.booking,
  };
};

const assertInvoiceOwner = (invoice: InvoiceWithRelations, userId: string) => {
  if (invoiceContext(invoice).customerId !== userId) {
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
  /** Keys identify the row — mobile owns display copy. */
  const items: Array<{ key: string; amount: number; type: 'charge' | 'discount' | 'fee' }> = [
    {
      key: purpose === 'SITE_VISIT_FEE' ? 'siteVisitFee' : 'serviceCharge',
      amount: money(invoice.serviceCharge),
      type: 'charge',
    },
  ];
  if (money(invoice.platformFee) > 0) {
    items.push({
      key: 'platformFee',
      amount: money(invoice.platformFee),
      type: 'fee',
    });
  }
  if (money(invoice.traderOfferDiscount) > 0) {
    items.push({
      key: 'traderOfferDiscount',
      amount: -money(invoice.traderOfferDiscount),
      type: 'discount',
    });
  }
  if (money(invoice.promoDiscount) > 0) {
    items.push({
      key: 'promoDiscount',
      amount: -money(invoice.promoDiscount),
      type: 'discount',
    });
  }
  if (money(invoice.tax) > 0) {
    items.push({ key: 'tax', amount: money(invoice.tax), type: 'fee' });
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

/** Payment-request invoices: a trader site-visit fee request bills the visit, every other request the service. */
const invoicePurposeOf = (invoice: InvoiceWithRelations): 'SERVICE' | 'SITE_VISIT_FEE' =>
  invoice.paymentRequest
    ? invoice.paymentRequest.type === TraderPaymentRequestType.SITE_VISIT_FEE
      ? 'SITE_VISIT_FEE'
      : 'SERVICE'
    : resolveInvoicePurpose(invoiceContext(invoice).job);

const invoiceLineItems = (invoice: InvoiceWithRelations, purpose: 'SERVICE' | 'SITE_VISIT_FEE') => {
  const request = invoice.paymentRequest;
  if (!request) return buildLineItems(invoice, purpose);
  const [, ...feesAndDiscounts] = buildLineItems(invoice);
  const charges = [
    { key: 'serviceCharge', amount: money(invoice.serviceCharge), type: 'charge' as const },
    { key: 'materialsTotal', amount: money(request.materialsTotal), type: 'charge' as const },
    { key: 'siteVisitFee', amount: money(request.siteVisitFee), type: 'charge' as const },
  ].filter((item) => item.amount > 0);
  return [...charges, ...feesAndDiscounts];
};

const formatTimeSlotRange = (timeSlot?: string | null) => {
  // No static slot ranges — return the stored timeSlot value only.
  return timeSlot?.trim() || null;
};

const currencySymbol = (code: string) =>
  ({ EUR: '€', GBP: '£', USD: '$', INR: '₹' }[code] ?? code);

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

    return {
      id: code.id,
      title,
      code: code.code,
      couponCode: code.code,
      discountType: code.discountType,
      discountValue,
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
    { key: 'ALL', categoryId: '' },
    ...categories.map((c) => ({ key: c.id, name: c.name, categoryId: c.id })),
  ];

  return {
    applyPath: '/invoices/{invoiceId}/apply-promo',
    categoryFilters,
    items,
    /** Alias — same list for mobile models that expect promoCodes */
    promoCodes: items,
  };
};

const serializeBooking = (booking: ReturnType<typeof invoiceContext>['booking']) =>
  booking
    ? {
        id: booking.id,
        bookingRef: booking.bookingRef,
        status: booking.status,
        scheduledDate: booking.scheduledDate,
      }
    : null;

const serializeInvoice = (invoice: InvoiceWithRelations) => {
  const { job, trader, booking } = invoiceContext(invoice);
  const breakdown = serializeInvoiceBreakdown(invoice);
  const purpose = invoicePurposeOf(invoice);
  const request = invoice.paymentRequest;
  const serviceProvider =
    trader?.businessName || trader?.user?.fullName || null;
  const orderId = invoice.invoiceNumber || booking?.bookingRef || invoice.id;
  const slotRange = formatTimeSlotRange(job.timeSlot);

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    orderId,
    status: invoice.status,
    bookingId: booking?.id ?? null,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    purpose,
    ...breakdown,
    materialsTotal: request ? money(request.materialsTotal) : 0,
    siteVisitFee: request
      ? money(request.siteVisitFee)
      : purpose === 'SITE_VISIT_FEE'
        ? breakdown.serviceCharge
        : 0,
    vatRate: request ? money(request.vatRate) : 0,
    currencySymbol: currencySymbol(invoice.currencyCode),
    lineItems: invoiceLineItems(invoice, purpose),
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
    },
    booking: serializeBooking(booking),
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
      {
        key: 'APPLE_PAY',
        provider: 'stripe',
        enabled: isStripeConfigured() && Boolean(env.STRIPE_MERCHANT_IDENTIFIER),
      },
      { key: 'GOOGLE_PAY', provider: 'stripe', enabled: isStripeConfigured() },
      { key: 'CARD', provider: 'stripe', enabled: isStripeConfigured() },
    ],
    billingTypes: [
      { key: 'INDIVIDUAL' },
      { key: 'COMPANY' },
    ],
    paymentStatus: invoice.payments[0]?.status ?? null,
    latestPaymentId: invoice.payments[0]?.id ?? null,
    /** True when a promo discount is on the invoice. */
    promoApplied: money(invoice.promoDiscount) > 0,
    /** Currently applied promo code (uppercase), or null if none. */
    promoCode: invoice.appliedPromoCode ?? null,
    alreadyApplied: false,
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
  const { job, trader, booking } = invoiceContext(invoice);
  const amountPaid = money(payment.amount);
  const isPaid = payment.status === PaymentStatus.COMPLETED;
  const purpose = invoicePurposeOf(invoice);

  return {
    paymentId: payment.id,
    transactionId: payment.transactionRef,
    transactionRef: payment.transactionRef,
    status: payment.status,
    method: payment.method,
    amount: amountPaid,
    amountPaid,
    currencyCode: payment.currencyCode,
    currencySymbol: currencySymbol(payment.currencyCode),
    paidAt: payment.paidAt,
    cardLast4: payment.cardLast4,
    cardBrand: payment.cardBrand,
    billingType: payment.billingType,
    companyName: payment.companyName,
    purpose,
    /** Success screen steps — keys only; labels owned by mobile. */
    timeline: [
      { key: 'PAID', completed: isPaid, at: payment.paidAt },
      {
        key: 'CONFIRMED',
        completed: isPaid,
        at: isPaid ? payment.paidAt : null,
      },
      { key: 'SERVICE', completed: false, at: null },
    ],
    receiptSummary: {
      transactionId: payment.transactionRef,
      date: payment.paidAt,
      amountPaid,
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
      orderId: invoice.invoiceNumber || booking?.bookingRef || invoice.id,
      status: invoice.status,
      purpose,
      ...serializeInvoiceBreakdown(invoice),
      lineItems: invoiceLineItems(invoice, purpose),
    },
    booking: serializeBooking(booking),
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

/** Recompute fee/total from stored line amounts so GET never drifts. */
const ensureInvoiceTotalsConsistent = async (invoice: InvoiceWithRelations) => {
  // Payment-request invoices keep the trader's billed totals (materials, site visit, VAT).
  if (invoice.status !== InvoiceStatus.UNPAID || invoice.paymentRequestId) return invoice;

  const purpose = resolveInvoicePurpose(invoiceContext(invoice).job);
  const breakdown = computeInvoiceBreakdown({
    serviceCharge: money(invoice.serviceCharge),
    traderOfferDiscount: money(invoice.traderOfferDiscount),
    promoDiscount: money(invoice.promoDiscount),
    currencyCode: invoice.currencyCode,
    purpose,
  });

  const drift =
    money(invoice.platformFee) !== breakdown.platformFee ||
    money(invoice.tax) !== breakdown.tax ||
    money(invoice.totalAmount) !== breakdown.totalAmount ||
    money(invoice.promoDiscount) !== breakdown.promoDiscount;

  if (!drift) return invoice;

  return prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      promoDiscount: breakdown.promoDiscount,
      platformFee: breakdown.platformFee,
      tax: breakdown.tax,
      totalAmount: breakdown.totalAmount,
    },
    include: invoiceOwnershipInclude,
  });
};

export const getInvoice = async (userId: string, invoiceId: string) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: invoiceOwnershipInclude,
  });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  assertInvoiceOwner(invoice, userId);
  const consistent = await ensureInvoiceTotalsConsistent(invoice);
  const base = serializeInvoice(consistent);
  const briskOffers = await loadBriskOffersSheet(invoiceContext(consistent).job.categoryId);
  return {
    ...base,
    briskOffers,
    promoCodes: briskOffers.items,
  };
};

/** Clear promo when customer revisits location / republish while still unpaid. */
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
  if (!invoice?.booking || invoice.status !== InvoiceStatus.UNPAID) return;
  if (money(invoice.promoDiscount) <= 0 && !invoice.appliedPromoCode) return;

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
      appliedPromoCode: null,
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
  if (invoice.paymentRequestId) {
    throw new BadRequestError('Promo codes cannot be applied to a trader payment request.');
  }

  // One promo at a time (no stacking). Same code → idempotent "already applied".
  // Different code while UNPAID → replace previous promo.
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
    const jobCategoryId = invoiceContext(invoice).job.categoryId;
    const jobCategoryName = invoiceContext(invoice).job.category.name;
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
  const purpose = resolveInvoicePurpose(invoiceContext(invoice).job);
  const breakdown = computeInvoiceBreakdown({
    serviceCharge,
    traderOfferDiscount,
    promoDiscount,
    currencyCode: invoice.currencyCode,
    purpose,
  });

  const storedCode = invoice.appliedPromoCode?.trim().toUpperCase() ?? null;
  const existingDiscount = money(invoice.promoDiscount);
  const sameCodeAlreadyApplied =
    existingDiscount > 0 &&
    (storedCode === code || (!storedCode && existingDiscount === breakdown.promoDiscount));

  const promoCode = promo.code.toUpperCase();

  if (sameCodeAlreadyApplied) {
    // Idempotent: heal totals / persist missing code, never stack.
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        promoDiscount: breakdown.promoDiscount,
        appliedPromoCode: promoCode,
        platformFee: breakdown.platformFee,
        tax: breakdown.tax,
        totalAmount: breakdown.totalAmount,
      },
    });

    return {
      invoiceId,
      promoApplied: true,
      alreadyApplied: true,
      promoCode,
    };
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      promoDiscount: breakdown.promoDiscount,
      appliedPromoCode: promoCode,
      platformFee: breakdown.platformFee,
      tax: breakdown.tax,
      totalAmount: breakdown.totalAmount,
    },
  });

  emitInvoiceUpdated({
    invoiceId: updated.id,
    jobId: invoiceContext(invoice).job.id,
    status: updated.status,
    totalAmount: money(updated.totalAmount),
    promoDiscount: money(updated.promoDiscount),
    promoApplied: money(updated.promoDiscount) > 0,
    customerId: userId,
    at: new Date().toISOString(),
  });

  return {
    invoiceId,
    promoApplied: true,
    alreadyApplied: false,
    promoCode,
  };
};

export const createPaymentIntent = async (userId: string, input: CreatePaymentIntentInput) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: invoiceOwnershipInclude,
  });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  assertInvoiceOwner(invoice, userId);
  const context = invoiceContext(invoice);

  if (invoice.status === InvoiceStatus.PAID) {
    throw new BadRequestError('This invoice is already paid.');
  }
  if (invoice.status === InvoiceStatus.REFUNDED) {
    throw new BadRequestError('Cannot pay a refunded invoice.');
  }
  if (
    invoice.paymentRequest &&
    invoice.paymentRequest.status !== TraderPaymentRequestStatus.SENT &&
    invoice.paymentRequest.status !== TraderPaymentRequestStatus.PENDING
  ) {
    throw new BadRequestError(
      `Payment request cannot be paid from status ${invoice.paymentRequest.status}.`
    );
  }

  const existingCompleted = invoice.payments.find((p) => p.status === PaymentStatus.COMPLETED);
  if (existingCompleted) {
    throw new BadRequestError('A completed payment already exists for this invoice.');
  }

  const amount = money(invoice.totalAmount);
  const requiresPayment = amount > 0;
  if (requiresPayment) getStripe();

  // New Pay Now attempt: supersede older pending/failed intents so mobile uses this paymentId,
  // and cancel their Stripe intents so an old sheet can never charge twice.
  const stale = invoice.payments.filter(
    (p) => p.status === PaymentStatus.PENDING || p.status === PaymentStatus.FAILED
  );
  await Promise.all(stale.map((p) => cancelPaymentIntentQuietly(p.stripePaymentIntentId)));
  await prisma.payment.updateMany({
    where: {
      invoiceId: invoice.id,
      status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
    },
    data: { status: PaymentStatus.FAILED },
  });

  const payment = await prisma.payment.create({
    data: {
      transactionRef: generateTransactionRef(),
      invoiceId: invoice.id,
      userId,
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

  const base = {
    paymentId: payment.id,
    transactionId: payment.transactionRef,
    transactionRef: payment.transactionRef,
    amount: money(payment.amount),
    currencyCode: payment.currencyCode,
    currencySymbol: currencySymbol(payment.currencyCode),
    method: payment.method,
    status: payment.status,
    billingAddress: input.billingAddress ?? null,
    invoiceId: invoice.id,
    orderId: invoice.invoiceNumber || context.booking?.bookingRef || invoice.id,
  };

  // Fully discounted invoice (e.g. free site visit): nothing to charge — confirm completes it.
  if (!requiresPayment) {
    return {
      ...base,
      requiresPayment: false,
      paymentIntentId: null,
      clientSecret: null,
      customerId: null,
      ephemeralKey: null,
      publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
      stripeMerchantIdentifier: env.STRIPE_MERCHANT_IDENTIFIER ?? null,
    };
  }

  try {
    const customerId = await ensureStripeCustomer(userId);
    const intent = await getStripe().paymentIntents.create(
      {
        amount: toMinorUnits(amount, payment.currencyCode),
        currency: payment.currencyCode.toLowerCase(),
        customer: customerId,
        automatic_payment_methods: { enabled: true },
        description: `Brisk ${base.orderId} — ${context.job.title}`,
        metadata: {
          kind: STRIPE_KIND_INVOICE,
          paymentId: payment.id,
          invoiceId: invoice.id,
          jobId: context.job.id,
          userId,
        },
      },
      { idempotencyKey: `invoice-payment-${payment.id}` }
    );
    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripePaymentIntentId: intent.id },
    });
    return {
      ...base,
      requiresPayment: true,
      ...(await buildClientPaymentConfig(customerId, intent)),
    };
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });
    throw toPaymentError(error);
  }
};

export const confirmPayment = async (userId: string, paymentId: string) => {
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

  if (money(payment.amount) > 0) {
    if (!payment.stripePaymentIntentId) {
      throw new BadRequestError('This payment was not started. Please tap Pay Now again.', {
        code: 'PAYMENT_INTENT_MISSING',
      });
    }
    try {
      const intent = await retrieveSucceededIntent(
        payment.stripePaymentIntentId,
        money(payment.amount),
        payment.currencyCode
      );
      await finalizeInvoicePayment(payment.id, await getChargeDetails(intent));
    } catch (error) {
      throw toPaymentError(error);
    }
  } else {
    await finalizeInvoicePayment(payment.id, null);
  }

  return buildReceipt(payment.id, userId);
};

/**
 * Marks an invoice payment as successful (invoice PAID, offer claim USED, job SCHEDULED).
 * Payment-request invoice: marks the linked trader request PAID instead (FULL_JOB → job COMPLETED).
 * Idempotent — called by both the confirm API and the Stripe webhook; returns false if
 * the payment was already finalized.
 */
export const finalizeInvoicePayment = async (
  paymentId: string,
  charge: ChargeDetails | null
): Promise<boolean> => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { paymentRequest: { select: { jobId: true } } } } },
  });
  if (!payment || payment.status === PaymentStatus.COMPLETED) return false;

  const userId = payment.userId;
  const paidAt = new Date();
  const method = paymentMethodFromCharge(charge);

  const finalized = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: PaymentStatus.COMPLETED } },
      data: {
        status: PaymentStatus.COMPLETED,
        paidAt,
        cardLast4: charge?.cardLast4 ?? null,
        cardBrand: charge?.cardBrand ?? null,
        ...(method ? { method } : {}),
      },
    });
    if (claimed.count === 0) return null;

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

    if (payment.invoice.paymentRequestId) {
      const paidRequest = await markPaymentRequestPaid(tx, payment.invoice.paymentRequestId, {
        paidAt,
        intentId: payment.stripePaymentIntentId,
        details: charge,
        method,
      });
      return { paidRequest };
    }
    if (!payment.invoice.bookingId) return { paidRequest: null };

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
    return { paidRequest: null };
  });
  if (!finalized) return false;

  const requestJobId = payment.invoice.paymentRequest?.jobId;
  const bookingWhere: Prisma.BookingWhereInput | null = payment.invoice.bookingId
    ? { id: payment.invoice.bookingId }
    : requestJobId
      ? { jobId: requestJobId }
      : null;
  const booking = bookingWhere
    ? await prisma.booking.findFirst({
        where: bookingWhere,
        select: {
          id: true,
          jobId: true,
          traderId: true,
          trader: { select: { userId: true } },
          job: { select: { customerId: true, status: true } },
        },
      })
    : null;
  emitPaymentCompleted({
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    jobId: booking?.jobId ?? requestJobId ?? null,
    bookingId: booking?.id ?? null,
    status: PaymentStatus.COMPLETED,
    amount: money(payment.amount),
    customerId: userId,
    traderId: booking?.traderId ?? null,
    traderUserId: booking?.trader?.userId ?? null,
    at: paidAt.toISOString(),
    ...(payment.invoice.paymentRequestId ? { jobStatus: null, notifyTrader: false } : {}),
  });
  if (finalized.paidRequest) emitPaymentRequestPaidEvent(finalized.paidRequest, paidAt);
  return true;
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

  // The sheet can report an error after Stripe already captured (e.g. network drop) —
  // never mark a captured payment as failed.
  if (payment.stripePaymentIntentId && isStripeConfigured()) {
    const intent = await getStripe()
      .paymentIntents.retrieve(payment.stripePaymentIntentId)
      .catch(() => null);
    if (intent?.status === 'succeeded') {
      assertIntentMatches(intent, money(payment.amount), payment.currencyCode);
      await finalizeInvoicePayment(payment.id, await getChargeDetails(intent));
      throw new ConflictError('This payment has already succeeded.', {
        code: 'PAYMENT_ALREADY_SUCCEEDED',
        data: { receipt: await buildReceipt(payment.id, userId) },
      });
    }
  }

  if (payment.status !== PaymentStatus.FAILED) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });
  }

  const invoice = payment.invoice;
  const context = invoiceContext(invoice);
  const amount = money(payment.amount);

  emitPaymentFailed({
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    jobId: context.job.id,
    bookingId: context.booking?.id ?? null,
    status: PaymentStatus.FAILED,
    amount,
    customerId: userId,
    traderId: context.trader?.id ?? null,
    at: new Date().toISOString(),
  });

  return {
    paymentId: payment.id,
    transactionId: payment.transactionRef,
    transactionRef: payment.transactionRef,
    status: PaymentStatus.FAILED,
    method: payment.method,
    amount,
    currencyCode: payment.currencyCode,
    currencySymbol: currencySymbol(payment.currencyCode),
    title: 'Payment Failed',
    message: input.reason || 'Your payment could not be completed. Please try again.',
    reason: input.reason ?? null,
    timeline: [
      { key: 'PAID', completed: false, at: null },
      { key: 'CONFIRMED', completed: false, at: null },
      { key: 'SERVICE', completed: false, at: null },
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
      orderId: invoice.invoiceNumber || context.booking?.bookingRef || invoice.id,
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
