import {
  DocumentRuleScope,
  JobStatus,
  OfferStatus,
  OfferType,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  QuoteStatus,
  TraderDocumentStatus,
} from '@prisma/client';
import { prisma } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import { offerInclude, serializeOffer } from '../../offers/offers.serializers';
import { getDocumentRequirementsForTrader } from '../../document-rules/document-rules.service';

const money = (value: Prisma.Decimal | number | null | undefined): number =>
  value == null ? 0 : Number(value);

const round2 = (n: number) => Math.round(n * 100) / 100;

const parsePage = (page?: string) => Math.max(1, Number(page) || 1);
const parseLimit = (limit?: string) => Math.max(1, Math.min(100, Number(limit) || 10));

const parseDateBoundary = (value: string | undefined, endOfDay: boolean) => {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const assertTraderExists = async (traderId: string) => {
  const trader = await prisma.trader.findUnique({
    where: { id: traderId },
    select: {
      id: true,
      traderType: true,
      traderCode: true,
      businessName: true,
      fullLegalName: true,
      avgRating: true,
      jobsDoneCount: true,
      bankName: true,
      bankHolderName: true,
      accountNumber: true,
      categories: { select: { categoryId: true } },
    },
  });
  if (!trader) throw new NotFoundError('Trader not found.');
  return trader;
};

const dateRangeFilter = (from?: string, to?: string, field = 'createdAt') => {
  const gte = parseDateBoundary(from, false);
  const lte = parseDateBoundary(to, true);
  if (!gte && !lte) return {};
  return {
    [field]: {
      ...(gte ? { gte } : {}),
      ...(lte ? { lte } : {}),
    },
  };
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const getTraderDocumentsStats = async (traderId: string) => {
  const trader = await assertTraderExists(traderId);
  const categoryIds = trader.categories.map((c) => c.categoryId);
  const requirements = await getDocumentRequirementsForTrader(trader.traderType, categoryIds);
  const requiredRules = [...requirements.entityRules, ...requirements.categoryRulesFlat].filter(
    (r) => r.required
  );

  const documents = await prisma.traderDocument.findMany({
    where: { traderId },
    select: {
      id: true,
      documentRuleId: true,
      status: true,
      reviewedAt: true,
      uploadedAt: true,
    },
  });

  const byRule = new Map(documents.map((d) => [d.documentRuleId, d]));
  let approvedRequired = 0;
  for (const rule of requiredRules) {
    const doc = byRule.get(rule.id);
    if (doc?.status === TraderDocumentStatus.APPROVED) approvedRequired += 1;
  }

  const totalSubmitted = documents.length;
  const approvedFiles = documents.filter((d) => d.status === TraderDocumentStatus.APPROVED).length;
  const pendingFiles = documents.filter((d) => d.status === TraderDocumentStatus.PENDING).length;
  const rejectedFiles = documents.filter((d) => d.status === TraderDocumentStatus.REJECTED).length;
  const requiredTotal = requiredRules.length || totalSubmitted;
  const compliancePercent =
    requiredTotal > 0 ? round2((approvedRequired / requiredTotal) * 100) : 0;

  const lastReviewed = documents
    .map((d) => d.reviewedAt)
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    documentCompliancePercent: compliancePercent,
    requiredTotal,
    approvedRequired,
    approvedLabel: `${approvedRequired} of ${requiredTotal} documents approved`,
    activeCredentials: approvedFiles,
    filesSubmitted: totalSubmitted,
    pendingFiles,
    rejectedFiles,
    lastVerifiedAt: lastReviewed ?? null,
  };
};

export const listTraderDocuments = async (
  traderId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    status?: TraderDocumentStatus;
    scope?: 'ENTITY' | 'CATEGORY' | 'ALL';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    from?: string;
    to?: string;
  }
) => {
  await assertTraderExists(traderId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.TraderDocumentWhereInput = {
    traderId,
    ...dateRangeFilter(filters.from, filters.to, 'uploadedAt'),
  };

  if (filters.status) where.status = filters.status;

  if (filters.scope && filters.scope !== 'ALL') {
    where.documentRule = {
      scope:
        filters.scope === 'ENTITY' ? DocumentRuleScope.ENTITY : DocumentRuleScope.CATEGORY,
    };
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { fileName: { contains: q, mode: 'insensitive' } },
      { documentRule: { name: { contains: q, mode: 'insensitive' } } },
      { documentRule: { documentKey: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const orderBy: Prisma.TraderDocumentOrderByWithRelationInput =
    filters.sortBy === 'name'
      ? { documentRule: { name: sortOrder } }
      : filters.sortBy === 'status'
        ? { status: sortOrder }
        : filters.sortBy === 'reviewedAt'
          ? { reviewedAt: sortOrder }
          : { uploadedAt: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.traderDocument.count({ where }),
    prisma.traderDocument.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        documentRule: {
          select: {
            id: true,
            documentKey: true,
            name: true,
            description: true,
            required: true,
            scope: true,
            traderType: true,
            categoryId: true,
            acceptedFormats: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    documents: rows.map((doc) => ({
      id: doc.id,
      traderId: doc.traderId,
      documentRuleId: doc.documentRuleId,
      name: doc.documentRule.name,
      documentKey: doc.documentRule.documentKey,
      required: doc.documentRule.required,
      scope: doc.documentRule.scope,
      scopeLabel:
        doc.documentRule.scope === DocumentRuleScope.ENTITY
          ? doc.documentRule.traderType === 'COMPANY'
            ? 'Company Doc'
            : 'Entity Doc'
          : 'Category Doc',
      category: doc.documentRule.category,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      status: doc.status,
      rejectionReason: doc.rejectionReason,
      uploadedAt: doc.uploadedAt,
      reviewedAt: doc.reviewedAt,
      reviewedById: doc.reviewedById,
    })),
  };
};

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

const resolveSiteVisitStatus = (job: {
  siteVisitRequested: boolean;
  quoteType: string | null;
  status: JobStatus;
  booking: { status: string } | null;
}) => {
  const isSiteVisit =
    job.siteVisitRequested || job.quoteType === 'ONSITE';
  if (!isSiteVisit) return null;
  if (job.booking?.status === 'COMPLETED' || job.status === JobStatus.COMPLETED) {
    return 'Visit Completed';
  }
  if (job.booking?.status === 'IN_PROGRESS' || job.status === JobStatus.IN_PROGRESS) {
    return 'Visit In Progress';
  }
  if (job.booking?.status === 'SCHEDULED' || job.status === JobStatus.SCHEDULED) {
    return 'Visit Scheduled';
  }
  if (job.status === JobStatus.CANCELLED || job.booking?.status === 'CANCELLED') {
    return 'Visit Cancelled';
  }
  return 'Visit Pending';
};

export const getTraderJobsStats = async (traderId: string) => {
  await assertTraderExists(traderId);

  const [
    totalJobs,
    completedJobs,
    siteVisitJobs,
    completedSiteVisits,
    quotesSubmitted,
    quotesAccepted,
    paymentAgg,
    visitFeeAgg,
  ] = await Promise.all([
    prisma.job.count({ where: { traderId } }),
    prisma.job.count({ where: { traderId, status: JobStatus.COMPLETED } }),
    prisma.job.count({
      where: {
        traderId,
        OR: [{ siteVisitRequested: true }, { quoteType: 'ONSITE' }],
      },
    }),
    prisma.job.count({
      where: {
        traderId,
        status: JobStatus.COMPLETED,
        OR: [{ siteVisitRequested: true }, { quoteType: 'ONSITE' }],
      },
    }),
    prisma.quote.count({ where: { traderId } }),
    prisma.quote.count({ where: { traderId, status: QuoteStatus.ACCEPTED } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.COMPLETED,
        invoice: { booking: { traderId } },
      },
    }),
    prisma.job.aggregate({
      _sum: { siteVisitFee: true },
      where: {
        traderId,
        status: JobStatus.COMPLETED,
        OR: [{ siteVisitRequested: true }, { quoteType: 'ONSITE' }],
      },
    }),
  ]);

  const selectionRate =
    quotesSubmitted > 0 ? round2((quotesAccepted / quotesSubmitted) * 100) : 0;

  return {
    totalJobs,
    completedJobs,
    visitFeesEarned: round2(money(visitFeeAgg._sum.siteVisitFee)),
    visitsCompleted: completedSiteVisits,
    visitsTotal: siteVisitJobs,
    materialsAdded: 0, // not modeled in schema yet
    selectionRatePercent: selectionRate,
    jobRevenue: round2(money(paymentAgg._sum.amount)),
    currencyCode: 'EUR',
  };
};

export const listTraderJobs = async (
  traderId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    status?: JobStatus;
    categoryId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    from?: string;
    to?: string;
  }
) => {
  await assertTraderExists(traderId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.JobWhereInput = {
    traderId,
    ...dateRangeFilter(filters.from, filters.to, 'createdAt'),
  };

  if (filters.status) where.status = filters.status;
  if (filters.categoryId) where.categoryId = filters.categoryId;

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { jobRef: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
      { customer: { fullName: { contains: q, mode: 'insensitive' } } },
      { category: { name: { contains: q, mode: 'insensitive' } } },
      { subcategory: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const orderBy: Prisma.JobOrderByWithRelationInput =
    filters.sortBy === 'amount'
      ? { serviceCharge: sortOrder }
      : filters.sortBy === 'status'
        ? { status: sortOrder }
        : filters.sortBy === 'scheduledDate'
          ? { scheduledDate: sortOrder }
          : filters.sortBy === 'title'
            ? { title: sortOrder }
            : { createdAt: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
        booking: {
          select: {
            id: true,
            bookingRef: true,
            status: true,
            invoice: {
              select: {
                id: true,
                totalAmount: true,
                currencyCode: true,
                status: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    jobs: rows.map((job) => {
      const amount =
        job.booking?.invoice?.totalAmount != null
          ? money(job.booking.invoice.totalAmount)
          : job.serviceCharge != null
            ? money(job.serviceCharge)
            : job.siteVisitFee != null
              ? money(job.siteVisitFee)
              : 0;

      return {
        id: job.id,
        jobRef: job.jobRef,
        title: job.title,
        customer: job.customer
          ? {
              id: job.customer.id,
              fullName: job.customer.fullName,
              email: job.customer.email,
            }
          : null,
        service: job.title,
        category: job.category,
        subcategory: job.subcategory,
        date: job.scheduledDate ?? job.createdAt,
        createdAt: job.createdAt,
        scheduledDate: job.scheduledDate,
        amount: round2(amount),
        currencyCode: job.booking?.invoice?.currencyCode ?? 'EUR',
        status: job.status,
        siteVisitRequested: job.siteVisitRequested,
        siteVisitFee: job.siteVisitFee != null ? money(job.siteVisitFee) : null,
        siteVisitStatus: resolveSiteVisitStatus(job),
        bookingId: job.booking?.id ?? null,
        bookingRef: job.booking?.bookingRef ?? null,
        invoiceId: job.booking?.invoice?.id ?? null,
      };
    }),
  };
};

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export const getTraderReviewsStats = async (traderId: string) => {
  await assertTraderExists(traderId);

  const reviews = await prisma.ratingReview.findMany({
    where: { traderId },
    select: { stars: true },
  });

  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let sum = 0;
  for (const review of reviews) {
    const key = String(review.stars);
    if (distribution[key] != null) distribution[key] += 1;
    sum += review.stars;
  }

  const total = reviews.length;
  return {
    average: total > 0 ? round2(sum / total) : 0,
    total,
    distribution,
  };
};

export const listTraderReviews = async (
  traderId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    stars?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    from?: string;
    to?: string;
  }
) => {
  await assertTraderExists(traderId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.RatingReviewWhereInput = {
    traderId,
    ...dateRangeFilter(filters.from, filters.to, 'createdAt'),
  };

  if (filters.stars) where.stars = Number(filters.stars);

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { review: { contains: q, mode: 'insensitive' } },
      { customer: { fullName: { contains: q, mode: 'insensitive' } } },
      { booking: { bookingRef: { contains: q, mode: 'insensitive' } } },
      { booking: { job: { jobRef: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  const orderBy: Prisma.RatingReviewOrderByWithRelationInput =
    filters.sortBy === 'stars'
      ? { stars: sortOrder }
      : { createdAt: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.ratingReview.count({ where }),
    prisma.ratingReview.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        customer: { select: { id: true, fullName: true, email: true, profilePhotoUrl: true } },
        booking: {
          select: {
            id: true,
            bookingRef: true,
            job: {
              select: {
                id: true,
                jobRef: true,
                title: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    reviews: rows.map((r) => ({
      id: r.id,
      stars: r.stars,
      review: r.review,
      createdAt: r.createdAt,
      customer: r.customer,
      bookingId: r.bookingId,
      bookingRef: r.booking.bookingRef,
      job: r.booking.job
        ? {
            id: r.booking.job.id,
            jobRef: r.booking.job.jobRef,
            title: r.booking.job.title,
            category: r.booking.job.category,
          }
        : null,
    })),
  };
};

// ---------------------------------------------------------------------------
// Earnings / Payouts
// ---------------------------------------------------------------------------

export const getTraderEarningsSummary = async (traderId: string) => {
  const trader = await assertTraderExists(traderId);

  const [invoiceAgg, payoutCompleted, payoutPending, payoutProcessing] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: {
        serviceCharge: true,
        traderOfferDiscount: true,
        platformFee: true,
        totalAmount: true,
      },
      where: {
        status: 'PAID',
        booking: { traderId },
      },
    }),
    prisma.payout.aggregate({
      _sum: { amount: true },
      where: { traderId, status: PayoutStatus.COMPLETED },
    }),
    prisma.payout.aggregate({
      _sum: { amount: true },
      where: { traderId, status: PayoutStatus.PENDING },
    }),
    prisma.payout.aggregate({
      _sum: { amount: true },
      where: { traderId, status: PayoutStatus.PROCESSING },
    }),
  ]);

  const grossEarnings = round2(
    money(invoiceAgg._sum.serviceCharge) - money(invoiceAgg._sum.traderOfferDiscount)
  );
  const platformCommission = round2(money(invoiceAgg._sum.platformFee));
  const netPaidOut = round2(money(payoutCompleted._sum.amount));
  const pendingPayout = round2(
    money(payoutPending._sum.amount) + money(payoutProcessing._sum.amount)
  );

  return {
    grossEarnings,
    platformCommission,
    platformCommissionPercent: 10,
    netPaidOut,
    pendingPayout,
    currencyCode: 'EUR',
    bank: {
      bankName: trader.bankName,
      bankHolderName: trader.bankHolderName,
      accountNumberMasked: trader.accountNumber
        ? `****${trader.accountNumber.slice(-4)}`
        : null,
    },
  };
};

export const listTraderPayouts = async (
  traderId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    status?: PayoutStatus;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    from?: string;
    to?: string;
  }
) => {
  const trader = await assertTraderExists(traderId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.PayoutWhereInput = {
    traderId,
    ...dateRangeFilter(filters.from, filters.to, 'createdAt'),
  };

  if (filters.status) where.status = filters.status;

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [{ stripeTransferId: { contains: q, mode: 'insensitive' } }];
    // Exact UUID match if search looks like an id
    if (/^[0-9a-f-]{36}$/i.test(q)) {
      where.OR.push({ id: q });
    }
  }

  const orderBy: Prisma.PayoutOrderByWithRelationInput =
    filters.sortBy === 'amount'
      ? { amount: sortOrder }
      : filters.sortBy === 'status'
        ? { status: sortOrder }
        : filters.sortBy === 'processedAt'
          ? { processedAt: sortOrder }
          : { createdAt: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.payout.count({ where }),
    prisma.payout.findMany({
      where,
      skip,
      take: limit,
      orderBy,
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    payouts: rows.map((p) => ({
      id: p.id,
      payoutRef: `PO-${p.id.slice(0, 8).toUpperCase()}`,
      amount: money(p.amount),
      currencyCode: p.currencyCode,
      status: p.status,
      stripeTransferId: p.stripeTransferId,
      processedAt: p.processedAt,
      createdAt: p.createdAt,
      bank: {
        bankName: trader.bankName,
        bankHolderName: trader.bankHolderName,
        accountNumberMasked: trader.accountNumber
          ? `****${trader.accountNumber.slice(-4)}`
          : null,
      },
    })),
  };
};

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export const getTraderOffersStats = async (traderId: string) => {
  await assertTraderExists(traderId);
  const now = new Date();

  const [total, active, expired, disabled, claims, revenue] = await Promise.all([
    prisma.offer.count({ where: { traderId, offerType: OfferType.TRADER } }),
    prisma.offer.count({
      where: {
        traderId,
        offerType: OfferType.TRADER,
        status: OfferStatus.ACTIVE,
        validUntil: { gte: now },
      },
    }),
    prisma.offer.count({
      where: {
        traderId,
        offerType: OfferType.TRADER,
        OR: [
          { status: OfferStatus.EXPIRED },
          { status: OfferStatus.ACTIVE, validUntil: { lt: now } },
        ],
      },
    }),
    prisma.offer.count({
      where: { traderId, offerType: OfferType.TRADER, status: OfferStatus.DISABLED },
    }),
    prisma.offerClaim.count({ where: { offer: { traderId } } }),
    prisma.offer.aggregate({
      _sum: { revenueGenerated: true, claimsCount: true, viewsCount: true },
      where: { traderId, offerType: OfferType.TRADER },
    }),
  ]);

  return {
    totalOffers: total,
    activeOffers: active,
    expiredOffers: expired,
    disabledOffers: disabled,
    totalClaims: claims,
    totalViews: Number(revenue._sum.viewsCount ?? 0),
    revenueGenerated: money(revenue._sum.revenueGenerated),
  };
};

export const listTraderOffers = async (
  traderId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    status?: OfferStatus;
    categoryId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    from?: string;
    to?: string;
  }
) => {
  await assertTraderExists(traderId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.OfferWhereInput = {
    traderId,
    offerType: OfferType.TRADER,
    ...dateRangeFilter(filters.from, filters.to, 'createdAt'),
  };

  if (filters.status) where.status = filters.status;
  if (filters.categoryId) {
    where.categories = { some: { categoryId: filters.categoryId } };
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { offerCode: { contains: q, mode: 'insensitive' } },
      { couponCode: { contains: q, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.OfferOrderByWithRelationInput =
    filters.sortBy === 'claimsCount'
      ? { claimsCount: sortOrder }
      : filters.sortBy === 'viewsCount'
        ? { viewsCount: sortOrder }
      : filters.sortBy === 'validUntil'
        ? { validUntil: sortOrder }
        : filters.sortBy === 'title'
          ? { title: sortOrder }
          : { createdAt: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.offer.count({ where }),
    prisma.offer.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: offerInclude,
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    offers: rows.map(serializeOffer),
  };
};
