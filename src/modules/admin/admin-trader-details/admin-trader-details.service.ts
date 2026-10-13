import {
  ActorType,
  DocumentRuleScope,
  InvoiceStatus,
  JobStatus,
  OfferStatus,
  OfferType,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  QuoteStatus,
  TraderDocumentStatus,
  TraderPaymentRequestStatus,
  type Payout,
} from '@prisma/client';
import { prisma } from '../../../config/database';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { buildListOrderBy, pageIdsByComputedKey, resolveSortDir, type SortDir } from '../../../utils/list-sort';
import { findOfferPage } from '../admin-offers/admin-offers.service';
import type {
  CreateTraderPayoutInput,
  JobPayoutBalanceStatus,
} from './admin-trader-details.validation';
import { serializeOffer } from '../../offers/offers.serializers';
import { getDocumentRequirementsForTrader } from '../../document-rules/document-rules.service';
import { formatDocumentExpiryDate } from '../../document-rules/document-expiry';
import {
  listTraderSiteVisits,
  type TraderSiteVisitListQuery,
} from '../../site-visits/site-visits.service';

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
      stripeAccountId: true,
      categories: { where: { isActive: true }, select: { categoryId: true } },
    },
  });
  if (!trader) throw new NotFoundError('Trader not found.');
  return trader;
};

type DetailSortMap<O> = Record<string, (dir: SortDir) => O | O[]>;

/** Whitelisted `sortBy`; omitted keeps the tab default column, honouring `sortOrder`. */
const detailOrderBy = <O>(
  filters: { sortBy?: string; sortOrder?: string },
  map: DetailSortMap<O>,
  fallbackSortBy: string
): O[] =>
  buildListOrderBy<O>(
    filters.sortBy,
    filters.sortOrder,
    map,
    { sortBy: fallbackSortBy, sortOrder: resolveSortDir(filters.sortOrder) },
    { id: 'asc' } as O
  );

/** Ranks every matching row by a computed key, then loads only the requested page in that order. */
const loadPageInOrder = async <R extends { id: string; createdAt: Date }, T extends { id: string }>(
  candidates: R[],
  keyOf: (row: R) => unknown,
  sortOrder: string | undefined,
  skip: number,
  take: number,
  loadByIds: (ids: string[]) => Promise<T[]>
): Promise<T[]> => {
  const ids = pageIdsByComputedKey(candidates, keyOf, resolveSortDir(sortOrder), skip, take);
  const byId = new Map((await loadByIds(ids)).map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is T => Boolean(r));
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

const TRADER_DOCUMENT_SORT_MAP: DetailSortMap<Prisma.TraderDocumentOrderByWithRelationInput> = {
  name: (dir) => [{ documentRule: { name: dir } }, { uploadedAt: 'desc' }],
  documentKey: (dir) => [{ documentRule: { documentKey: dir } }, { uploadedAt: 'desc' }],
  required: (dir) => [{ documentRule: { required: dir } }, { uploadedAt: 'desc' }],
  scope: (dir) => [{ documentRule: { scope: dir } }, { documentRule: { traderType: dir } }, { uploadedAt: 'desc' }],
  fileName: (dir) => [{ fileName: { sort: dir, nulls: 'last' } }, { uploadedAt: 'desc' }],
  status: (dir) => [{ status: dir }, { uploadedAt: 'desc' }],
  expiryDate: (dir) => [{ expiryDate: { sort: dir, nulls: 'last' } }, { uploadedAt: 'desc' }],
  reviewedAt: (dir) => [{ reviewedAt: { sort: dir, nulls: 'last' } }, { uploadedAt: 'desc' }],
  uploadedAt: (dir) => ({ uploadedAt: dir }),
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

  const include = {
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
  } satisfies Prisma.TraderDocumentInclude;

  const findPage = async () => {
    if (filters.sortBy === 'categoryName') {
      const candidates = await prisma.traderDocument.findMany({
        where,
        select: { id: true, uploadedAt: true, documentRule: { select: { category: { select: { name: true } } } } },
      });
      return loadPageInOrder(
        candidates.map((d) => ({ id: d.id, createdAt: d.uploadedAt, categoryName: d.documentRule.category?.name ?? null })),
        (r) => r.categoryName,
        filters.sortOrder,
        skip,
        limit,
        (ids) => prisma.traderDocument.findMany({ where: { id: { in: ids } }, include })
      );
    }
    return prisma.traderDocument.findMany({
      where,
      skip,
      take: limit,
      orderBy: detailOrderBy<Prisma.TraderDocumentOrderByWithRelationInput>(filters, TRADER_DOCUMENT_SORT_MAP, 'uploadedAt'),
      include,
    });
  };

  const [total, rows] = await Promise.all([prisma.traderDocument.count({ where }), findPage()]);

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
      expiryDate: formatDocumentExpiryDate(doc.expiryDate),
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

const TRADER_JOB_SORT_MAP: DetailSortMap<Prisma.JobOrderByWithRelationInput> = {
  jobRef: (dir) => ({ jobRef: { sort: dir, nulls: 'last' } }),
  title: (dir) => [{ title: dir }, { createdAt: 'desc' }],
  customerName: (dir) => [{ customer: { fullName: dir } }, { createdAt: 'desc' }],
  categoryName: (dir) => [{ category: { name: dir } }, { createdAt: 'desc' }],
  scheduledDate: (dir) => [{ scheduledDate: { sort: dir, nulls: 'last' } }, { createdAt: 'desc' }],
  status: (dir) => [{ status: dir }, { createdAt: 'desc' }],
  siteVisitFee: (dir) => [{ siteVisitFee: { sort: dir, nulls: 'last' } }, { createdAt: 'desc' }],
  createdAt: (dir) => ({ createdAt: dir }),
};

const TRADER_JOB_RANK_SELECT = {
  id: true,
  createdAt: true,
  scheduledDate: true,
  serviceCharge: true,
  siteVisitFee: true,
  siteVisitRequested: true,
  quoteType: true,
  status: true,
  subcategory: { select: { name: true } },
  booking: { select: { bookingRef: true, status: true, invoice: { select: { totalAmount: true } } } },
} satisfies Prisma.JobSelect;

type TraderJobRankRow = Prisma.JobGetPayload<{ select: typeof TRADER_JOB_RANK_SELECT }>;

/** Same values the jobs tab displays (COALESCE / optional relations), ranked in memory. */
const COMPUTED_TRADER_JOB_SORTS: Record<string, (row: TraderJobRankRow) => unknown> = {
  amount: (r) => round2(money(r.booking?.invoice?.totalAmount ?? r.serviceCharge ?? r.siteVisitFee)),
  date: (r) => r.scheduledDate ?? r.createdAt,
  subcategoryName: (r) => r.subcategory?.name ?? null,
  bookingRef: (r) => r.booking?.bookingRef ?? null,
  siteVisitStatus: (r) => resolveSiteVisitStatus(r),
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
      invoice: { OR: [{ booking: { traderId } }, { paymentRequest: { traderId } }] },
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

  const include = {
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
  } satisfies Prisma.JobInclude;

  const computedKey = filters.sortBy ? COMPUTED_TRADER_JOB_SORTS[filters.sortBy] : undefined;
  const findPage = async () => {
    if (computedKey) {
      const candidates = await prisma.job.findMany({ where, select: TRADER_JOB_RANK_SELECT });
      return loadPageInOrder(candidates, computedKey, filters.sortOrder, skip, limit, (ids) =>
        prisma.job.findMany({ where: { id: { in: ids } }, include })
      );
    }
    return prisma.job.findMany({
      where,
      skip,
      take: limit,
      orderBy: detailOrderBy<Prisma.JobOrderByWithRelationInput>(filters, TRADER_JOB_SORT_MAP, 'createdAt'),
      include,
    });
  };

  const [total, rows] = await Promise.all([prisma.job.count({ where }), findPage()]);

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

/** Trader Details → jobs this trader requested a site visit on (paginated, filterable). */
export const listTraderSiteVisitRequests = async (
  traderId: string,
  query: TraderSiteVisitListQuery
) => {
  await assertTraderExists(traderId);
  return listTraderSiteVisits(traderId, query, 'ADMIN');
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

const TRADER_REVIEW_SORT_MAP: DetailSortMap<Prisma.RatingReviewOrderByWithRelationInput> = {
  stars: (dir) => [{ stars: dir }, { createdAt: 'desc' }],
  review: (dir) => [{ review: { sort: dir, nulls: 'last' } }, { createdAt: 'desc' }],
  customerName: (dir) => [{ customer: { fullName: dir } }, { createdAt: 'desc' }],
  bookingRef: (dir) => [{ booking: { bookingRef: { sort: dir, nulls: 'last' } } }, { createdAt: 'desc' }],
  jobRef: (dir) => [{ booking: { job: { jobRef: { sort: dir, nulls: 'last' } } } }, { createdAt: 'desc' }],
  jobTitle: (dir) => [{ booking: { job: { title: dir } } }, { createdAt: 'desc' }],
  categoryName: (dir) => [{ booking: { job: { category: { name: dir } } } }, { createdAt: 'desc' }],
  createdAt: (dir) => ({ createdAt: dir }),
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

  const orderBy = detailOrderBy<Prisma.RatingReviewOrderByWithRelationInput>(filters, TRADER_REVIEW_SORT_MAP, 'createdAt');

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
// Earnings / Job-wise Payouts (manual bank transfer; partial installments)
// ---------------------------------------------------------------------------

/**
 * Amount owed to the trader for a job after the customer has paid.
 * = PAID payment-request (serviceCharge + materials + siteVisitFee)
 * + PAID booking upfront invoice not tied to a payment request (serviceCharge − trader offer discount).
 * Platform fee + VAT are retained by Brisk / tax — not paid out to the trader.
 */
const traderPayableFromPaidRequest = (r: {
  serviceCharge: Prisma.Decimal;
  materialsTotal: Prisma.Decimal;
  siteVisitFee: Prisma.Decimal;
}) => round2(money(r.serviceCharge) + money(r.materialsTotal) + money(r.siteVisitFee));

const traderPayableFromUpfrontInvoice = (inv: {
  serviceCharge: Prisma.Decimal;
  traderOfferDiscount: Prisma.Decimal;
}) => round2(Math.max(0, money(inv.serviceCharge) - money(inv.traderOfferDiscount)));

const jobPayoutBalanceStatus = (
  totalPayable: number,
  amountPaid: number
): JobPayoutBalanceStatus => {
  if (totalPayable <= 0) return 'UNPAID';
  if (amountPaid <= 0) return 'UNPAID';
  if (amountPaid + 0.001 >= totalPayable) return 'PAID';
  return 'PARTIALLY_PAID';
};

type JobPayoutSource = {
  id: string;
  jobRef: string | null;
  title: string;
  status: JobStatus;
  updatedAt: Date;
  currencyCodeHint?: string | null;
  paymentRequests: {
    status: TraderPaymentRequestStatus;
    currencyCode: string;
    serviceCharge: Prisma.Decimal;
    materialsTotal: Prisma.Decimal;
    siteVisitFee: Prisma.Decimal;
  }[];
  booking: {
    invoice: {
      status: InvoiceStatus;
      paymentRequestId: string | null;
      currencyCode: string;
      serviceCharge: Prisma.Decimal;
      traderOfferDiscount: Prisma.Decimal;
    } | null;
  } | null;
  payouts: { amount: Prisma.Decimal; status: PayoutStatus }[];
};

const buildJobPayoutBalance = (job: JobPayoutSource) => {
  let totalPayable = 0;
  let currencyCode = 'EUR';

  for (const r of job.paymentRequests) {
    if (r.status !== TraderPaymentRequestStatus.PAID) continue;
    totalPayable = round2(totalPayable + traderPayableFromPaidRequest(r));
    currencyCode = r.currencyCode || currencyCode;
  }

  const upfront = job.booking?.invoice;
  if (
    upfront &&
    upfront.status === InvoiceStatus.PAID &&
    !upfront.paymentRequestId
  ) {
    totalPayable = round2(totalPayable + traderPayableFromUpfrontInvoice(upfront));
    currencyCode = upfront.currencyCode || currencyCode;
  }

  const amountPaid = round2(
    job.payouts
      .filter((p) => p.status === PayoutStatus.COMPLETED)
      .reduce((s, p) => s + money(p.amount), 0)
  );
  const remainingBalance = round2(Math.max(0, totalPayable - amountPaid));
  const payoutStatus = jobPayoutBalanceStatus(totalPayable, amountPaid);
  const eligibleForPayout = totalPayable > 0 && remainingBalance > 0;

  return {
    jobId: job.id,
    jobRef: job.jobRef,
    title: job.title,
    jobStatus: job.status,
    currencyCode,
    /** Total amount admin should eventually pay the trader for this job. */
    totalPayable,
    /** Sum of COMPLETED payout installments already recorded for this job. */
    amountPaid,
    /** totalPayable − amountPaid (0 when fully paid). */
    remainingBalance,
    /** Job-level: UNPAID | PARTIALLY_PAID | PAID */
    payoutStatus,
    /** true when customer has paid and remainingBalance > 0 — FE can enable “Send payout”. */
    eligibleForPayout,
    updatedAt: job.updatedAt,
  };
};

const jobPayoutSelect = {
  id: true,
  jobRef: true,
  title: true,
  status: true,
  updatedAt: true,
  paymentRequests: {
    select: {
      status: true,
      currencyCode: true,
      serviceCharge: true,
      materialsTotal: true,
      siteVisitFee: true,
    },
  },
  booking: {
    select: {
      invoice: {
        select: {
          status: true,
          paymentRequestId: true,
          currencyCode: true,
          serviceCharge: true,
          traderOfferDiscount: true,
        },
      },
    },
  },
  payouts: {
    select: { amount: true, status: true },
  },
} satisfies Prisma.JobSelect;

export const getTraderEarningsSummary = async (traderId: string) => {
  const trader = await assertTraderExists(traderId);

  const [invoiceAgg, payoutCompleted, jobs] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: {
        serviceCharge: true,
        traderOfferDiscount: true,
        platformFee: true,
        totalAmount: true,
      },
      where: {
        status: 'PAID',
        OR: [{ booking: { traderId } }, { paymentRequest: { traderId } }],
      },
    }),
    prisma.payout.aggregate({
      _sum: { amount: true },
      where: { traderId, status: PayoutStatus.COMPLETED },
    }),
    prisma.job.findMany({
      where: { traderId },
      select: jobPayoutSelect,
    }),
  ]);

  const balances = jobs.map(buildJobPayoutBalance);
  const pendingPayout = round2(
    balances.filter((b) => b.eligibleForPayout).reduce((s, b) => s + b.remainingBalance, 0)
  );
  const eligibleJobsCount = balances.filter((b) => b.eligibleForPayout).length;

  const grossEarnings = round2(
    money(invoiceAgg._sum.serviceCharge) - money(invoiceAgg._sum.traderOfferDiscount)
  );
  const platformCommission = round2(money(invoiceAgg._sum.platformFee));
  const netPaidOut = round2(money(payoutCompleted._sum.amount));

  return {
    grossEarnings,
    platformCommission,
    platformCommissionPercent: 10,
    netPaidOut,
    /** Sum of remainingBalance across jobs still eligible for payout. */
    pendingPayout,
    eligibleJobsCount,
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

const TRADER_PAYOUT_SORT_MAP: DetailSortMap<Prisma.PayoutOrderByWithRelationInput> = {
  payoutRef: (dir) => ({ id: dir }),
  amount: (dir) => [{ amount: dir }, { createdAt: 'desc' }],
  currencyCode: (dir) => [{ currencyCode: dir }, { createdAt: 'desc' }],
  status: (dir) => [{ status: dir }, { createdAt: 'desc' }],
  stripeTransferId: (dir) => [{ stripeTransferId: { sort: dir, nulls: 'last' } }, { createdAt: 'desc' }],
  processedAt: (dir) => [{ processedAt: { sort: dir, nulls: 'last' } }, { createdAt: 'desc' }],
  createdAt: (dir) => ({ createdAt: dir }),
  jobRef: (dir) => [{ job: { jobRef: { sort: dir, nulls: 'last' } } }, { createdAt: 'desc' }],
};

type BankTrader = Pick<
  Awaited<ReturnType<typeof assertTraderExists>>,
  'bankName' | 'bankHolderName' | 'accountNumber'
>;

const serializePayout = (
  p: Payout & {
    job?: { id: string; jobRef: string | null; title: string } | null;
  },
  trader: BankTrader,
  jobBalance?: ReturnType<typeof buildJobPayoutBalance> | null
) => ({
  id: p.id,
  payoutRef: `PO-${p.id.slice(0, 8).toUpperCase()}`,
  jobId: p.jobId,
  jobRef: p.job?.jobRef ?? null,
  jobTitle: p.job?.title ?? null,
  amount: money(p.amount),
  currencyCode: p.currencyCode,
  /** Installment row status (COMPLETED for recorded manual bank transfers). */
  status: p.status,
  note: p.note ?? null,
  bankReference: p.bankReference ?? null,
  stripeTransferId: p.stripeTransferId,
  processedAt: p.processedAt,
  createdAt: p.createdAt,
  bank: {
    bankName: trader.bankName,
    bankHolderName: trader.bankHolderName,
    accountNumberMasked: trader.accountNumber ? `****${trader.accountNumber.slice(-4)}` : null,
  },
  /** Present when payout is job-linked — FE balance after this installment context. */
  jobPayout: jobBalance
    ? {
        totalPayable: jobBalance.totalPayable,
        amountPaid: jobBalance.amountPaid,
        remainingBalance: jobBalance.remainingBalance,
        payoutStatus: jobBalance.payoutStatus,
        eligibleForPayout: jobBalance.eligibleForPayout,
      }
    : null,
});

export const listTraderPayouts = async (
  traderId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    status?: PayoutStatus;
    jobId?: string;
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
  const where: Prisma.PayoutWhereInput = {
    traderId,
    ...dateRangeFilter(filters.from, filters.to, 'createdAt'),
  };

  if (filters.status) where.status = filters.status;
  if (filters.jobId) where.jobId = filters.jobId;

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { stripeTransferId: { contains: q, mode: 'insensitive' } },
      { bankReference: { contains: q, mode: 'insensitive' } },
      { note: { contains: q, mode: 'insensitive' } },
      { job: { jobRef: { contains: q, mode: 'insensitive' } } },
      { job: { title: { contains: q, mode: 'insensitive' } } },
    ];
    if (/^[0-9a-f-]{36}$/i.test(q)) {
      where.OR.push({ id: q }, { jobId: q });
    }
  }

  const orderBy = detailOrderBy<Prisma.PayoutOrderByWithRelationInput>(
    filters,
    TRADER_PAYOUT_SORT_MAP,
    'createdAt'
  );

  const [total, rows] = await Promise.all([
    prisma.payout.count({ where }),
    prisma.payout.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: { job: { select: { id: true, jobRef: true, title: true } } },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    payouts: rows.map((p) => serializePayout(p, trader)),
  };
};

/** Jobs with customer-paid amounts — balances for the admin payout UI. */
export const listTraderPayoutJobs = async (
  traderId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    payoutStatus?: JobPayoutBalanceStatus;
    eligibleOnly?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
) => {
  await assertTraderExists(traderId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;

  const jobs = await prisma.job.findMany({
    where: {
      traderId,
      ...(filters.search?.trim()
        ? {
            OR: [
              { jobRef: { contains: filters.search.trim(), mode: 'insensitive' } },
              { title: { contains: filters.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: jobPayoutSelect,
  });

  let rows = jobs.map(buildJobPayoutBalance).filter((b) => b.totalPayable > 0);

  if (filters.eligibleOnly) {
    rows = rows.filter((b) => b.eligibleForPayout);
  }
  if (filters.payoutStatus) {
    rows = rows.filter((b) => b.payoutStatus === filters.payoutStatus);
  }

  const sortBy = filters.sortBy || 'updatedAt';
  const dir = resolveSortDir(filters.sortOrder, 'desc');
  const keyOf = (b: ReturnType<typeof buildJobPayoutBalance>): unknown => {
    switch (sortBy) {
      case 'jobRef':
        return b.jobRef;
      case 'title':
        return b.title;
      case 'totalPayable':
        return b.totalPayable;
      case 'amountPaid':
        return b.amountPaid;
      case 'remainingBalance':
        return b.remainingBalance;
      case 'payoutStatus':
        return b.payoutStatus;
      default:
        return b.updatedAt.getTime();
    }
  };
  rows.sort((a, b) => {
    const av = keyOf(a);
    const bv = keyOf(b);
    const aNull = av === null || av === undefined || av === '';
    const bNull = bv === null || bv === undefined || bv === '';
    if (aNull || bNull) return aNull === bNull ? 0 : aNull ? 1 : -1;
    const cmp =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true });
    const primary = dir === 'asc' ? cmp : -cmp;
    return primary || b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const total = rows.length;
  const pageRows = rows.slice(skip, skip + limit);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    jobs: pageRows,
  };
};

/** Single-job payout balance + installment history (payout modal). */
export const getTraderJobPayoutSummary = async (traderId: string, jobId: string) => {
  const trader = await assertTraderExists(traderId);
  const [job, installments] = await Promise.all([
    prisma.job.findFirst({
      where: { id: jobId, traderId },
      select: jobPayoutSelect,
    }),
    prisma.payout.findMany({
      where: { traderId, jobId },
      orderBy: { createdAt: 'desc' },
      include: { job: { select: { id: true, jobRef: true, title: true } } },
    }),
  ]);
  if (!job) throw new NotFoundError('Job not found for this trader.');

  const balance = buildJobPayoutBalance(job);
  return {
    ...balance,
    bank: {
      bankName: trader.bankName,
      bankHolderName: trader.bankHolderName,
      accountNumberMasked: trader.accountNumber ? `****${trader.accountNumber.slice(-4)}` : null,
    },
    installments: installments.map((p) => serializePayout(p, trader, balance)),
  };
};

/**
 * Record a manual bank payout installment for a job.
 * Customer must already have paid; amount cannot exceed remainingBalance.
 */
export const createTraderPayout = async (
  adminId: string,
  adminLabel: string,
  traderId: string,
  input: CreateTraderPayoutInput
) => {
  const trader = await assertTraderExists(traderId);

  const job = await prisma.job.findFirst({
    where: { id: input.jobId, traderId },
    select: jobPayoutSelect,
  });
  if (!job) {
    throw new NotFoundError('Job not found for this trader.');
  }

  const balance = buildJobPayoutBalance(job);
  if (balance.totalPayable <= 0) {
    throw new BadRequestError('This job has no customer-paid amount eligible for trader payout yet.', {
      code: 'JOB_NOT_ELIGIBLE_FOR_PAYOUT',
      data: balance,
    });
  }
  if (balance.remainingBalance <= 0) {
    throw new BadRequestError('This job is already fully paid out to the trader.', {
      code: 'JOB_PAYOUT_ALREADY_COMPLETE',
      data: balance,
    });
  }
  if (input.amount - balance.remainingBalance > 0.001) {
    throw new BadRequestError(
      `Amount exceeds remaining balance (${balance.remainingBalance} ${balance.currencyCode}).`,
      {
        code: 'PAYOUT_EXCEEDS_REMAINING',
        data: { ...balance, requestedAmount: input.amount },
      }
    );
  }

  const currencyCode = input.currencyCode ?? balance.currencyCode ?? 'EUR';
  const now = new Date();

  const payout = await prisma.payout.create({
    data: {
      traderId,
      jobId: job.id,
      amount: input.amount,
      currencyCode,
      status: PayoutStatus.COMPLETED,
      note: input.note ?? null,
      bankReference: input.bankReference ?? null,
      processedById: adminId,
      processedAt: now,
    },
    include: { job: { select: { id: true, jobRef: true, title: true } } },
  });

  const refreshed = await prisma.job.findFirst({
    where: { id: job.id },
    select: jobPayoutSelect,
  });
  const nextBalance = refreshed ? buildJobPayoutBalance(refreshed) : balance;

  await prisma.auditLog.create({
    data: {
      eventType: 'TRADER_JOB_PAYOUT_RECORDED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'Job',
      subjectId: job.id,
      description: `Recorded manual payout ${currencyCode} ${input.amount} for job ${job.jobRef ?? job.id} (remaining ${nextBalance.remainingBalance}; status ${nextBalance.payoutStatus})${input.bankReference ? ` — bank ref ${input.bankReference}` : ''}${input.note ? ` — ${input.note}` : ''}.`,
    },
  });

  return serializePayout(payout, trader, nextBalance);
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
  const where: Prisma.OfferWhereInput = {
    traderId,
    offerType: OfferType.TRADER,
    ...dateRangeFilter(filters.from, filters.to, 'createdAt'),
  };

  const now = new Date();
  if (filters.status === OfferStatus.ACTIVE) {
    where.status = OfferStatus.ACTIVE;
    where.validUntil = { gte: now };
  } else if (filters.status === OfferStatus.EXPIRED) {
    where.AND = [{ OR: [{ status: OfferStatus.EXPIRED }, { status: OfferStatus.ACTIVE, validUntil: { lt: now } }] }];
  } else if (filters.status) {
    where.status = filters.status;
  }
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

  const [total, rows] = await Promise.all([
    prisma.offer.count({ where }),
    findOfferPage(where, filters.sortBy, filters.sortOrder, skip, limit, resolveSortDir(filters.sortOrder)),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    offers: rows.map(serializeOffer),
  };
};
