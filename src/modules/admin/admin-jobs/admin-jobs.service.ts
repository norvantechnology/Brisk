import { ActorType, InvoiceStatus, JobStatus, Prisma, TraderSiteVisitStatus } from '@prisma/client';
import { prisma } from '../../../config/database';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { buildListOrderBy, pageIdsByComputedKey, resolveSortDir, type SortDir } from '../../../utils/list-sort';
import { cancelJob } from '../../jobs/jobs.service';
import { rescheduleJob } from '../../jobs/jobs.my-job.service';
import { listJobSiteVisits } from '../../site-visits/site-visits.service';
import {
  dateRangeFilter,
  getAdminJobChatThread,
  getAdminJobDetail,
} from '../admin-customer-details/admin-customer-details.service';
import { pushUserNotification } from '../../../sockets/realtime';
import {
  buildJobPayoutBalance,
  jobPayoutListInclude,
  serializeJobPayoutBalance,
} from '../../jobs/job-payout-balance';
import {
  ADMIN_DISPUTE_STATUSES,
  type AdminDisputesListQuery,
  type AdminJobFilters,
  type AdminJobsListQuery,
  type AdminRescheduleJobInput,
  type AdminUpdateDisputeInput,
} from './admin-jobs.validation';

export const ADMIN_JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Awaiting Trader',
  QUOTED: 'Quote Received',
  ACCEPTED: 'Customer Accepted',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  PAYMENT_PENDING: 'Payment Pending',
};

const ACTIVE_STATUSES: JobStatus[] = [JobStatus.ACCEPTED, JobStatus.SCHEDULED, JobStatus.IN_PROGRESS];
const PENDING_STATUSES: JobStatus[] = [JobStatus.PUBLISHED, JobStatus.QUOTED];

const money = (value: Prisma.Decimal | number | null | undefined) => (value == null ? null : Number(value));

const SITE_VISIT_STATUS_LABELS: Record<TraderSiteVisitStatus, string> = {
  PENDING: 'Waiting for Customer',
  CONFIRMED: 'Visit Confirmed',
  RESCHEDULE_REQUIRED: 'Reschedule Requested',
  COMPLETED: 'Site Visited',
  CANCELLED: 'Cancelled',
};

const dateKey = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

const NO_INVOICE: Prisma.JobWhereInput = {
  OR: [{ booking: { is: null } }, { booking: { is: { invoice: { is: null } } } }],
};

/**
 * Shared WHERE for list + stats. Stats skip `status` so tab counts stay visible while a tab is selected,
 * and count archived jobs unless `archived` is sent (the list hides them by default).
 */
const buildJobWhere = (filters: AdminJobFilters, includeStatus = true): Prisma.JobWhereInput => {
  const and: Prisma.JobWhereInput[] = [dateRangeFilter(filters.from, filters.to, 'createdAt')];

  if (filters.customerId) and.push({ customerId: filters.customerId });
  if (filters.traderId) and.push({ traderId: filters.traderId });
  if (filters.categoryId) and.push({ categoryId: filters.categoryId });
  if (includeStatus && filters.status?.length) {
    const hasQuoted = filters.status.includes(JobStatus.QUOTED);
    const hasPublished = filters.status.includes(JobStatus.PUBLISHED);
    const otherStatuses = filters.status.filter(
      (s) => s !== JobStatus.QUOTED && s !== JobStatus.PUBLISHED
    );

    const statusConditions: Prisma.JobWhereInput[] = [];

    if (otherStatuses.length) {
      statusConditions.push({ status: { in: otherStatuses } });
    }

    if (hasQuoted && hasPublished) {
      statusConditions.push({
        status: { in: [JobStatus.PUBLISHED, JobStatus.QUOTED] },
      });
    } else if (hasQuoted) {
      statusConditions.push(
        { status: JobStatus.QUOTED },
        {
          status: JobStatus.PUBLISHED,
          traderId: null,
          quotes: { some: {} },
        }
      );
    } else if (hasPublished) {
      statusConditions.push({
        status: JobStatus.PUBLISHED,
        quotes: { none: {} },
      });
    }

    if (statusConditions.length === 1) {
      and.push(statusConditions[0]);
    } else if (statusConditions.length > 1) {
      and.push({ OR: statusConditions });
    }
  }

  if (filters.archived === 'true') and.push({ archivedAt: { not: null } });
  else if (filters.archived === 'false' || (includeStatus && filters.archived !== 'all')) {
    and.push({ archivedAt: null });
  }

  if (filters.offer === 'APPLIED') and.push({ offerId: { not: null } });
  if (filters.offer === 'NONE') and.push({ offerId: null });

  if (filters.paymentStatus === 'NOT_INVOICED') {
    and.push(NO_INVOICE);
  } else if (filters.paymentStatus) {
    and.push({ booking: { is: { invoice: { is: { status: filters.paymentStatus as InvoiceStatus } } } } });
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    const range: Prisma.DecimalFilter = {
      ...(filters.minAmount !== undefined ? { gte: filters.minAmount } : {}),
      ...(filters.maxAmount !== undefined ? { lte: filters.maxAmount } : {}),
    };
    and.push({
      OR: [
        { booking: { is: { invoice: { is: { totalAmount: range } } } } },
        { AND: [NO_INVOICE, { serviceCharge: range }] },
      ],
    });
  }

  const q = filters.search?.trim();
  if (q) {
    const contains = { contains: q, mode: 'insensitive' as const };
    and.push({
      OR: [
        { jobRef: contains },
        { title: contains },
        { addressLine: contains },
        { city: contains },
        { postcode: contains },
        { category: { name: contains } },
        { subcategory: { name: contains } },
        { customer: { fullName: contains } },
        { customer: { email: contains } },
        { customer: { mobileNumber: contains } },
        { customer: { customerCode: contains } },
        { trader: { businessName: contains } },
        { trader: { traderCode: contains } },
        { trader: { user: { fullName: contains } } },
      ],
    });
  }

  return { AND: and };
};

const JOB_SORT_MAP: Record<string, (dir: SortDir) => Prisma.JobOrderByWithRelationInput | Prisma.JobOrderByWithRelationInput[]> = {
  createdAt: (dir) => ({ createdAt: dir }),
  scheduledDate: (dir) => [{ scheduledDate: { sort: dir, nulls: 'last' } }, { createdAt: 'desc' }],
  status: (dir) => [{ status: dir }, { createdAt: 'desc' }],
  title: (dir) => [{ title: dir }, { createdAt: 'desc' }],
  jobRef: (dir) => ({ jobRef: { sort: dir, nulls: 'last' } }),
  categoryName: (dir) => [{ category: { name: dir } }, { createdAt: 'desc' }],
  customerName: (dir) => [{ customer: { fullName: dir } }, { createdAt: 'desc' }],
  city: (dir) => [{ city: { sort: dir, nulls: 'last' } }, { createdAt: 'desc' }],
  postcode: (dir) => [{ postcode: { sort: dir, nulls: 'last' } }, { createdAt: 'desc' }],
  quotesCount: (dir) => [{ quotes: { _count: dir } }, { createdAt: 'desc' }],
};

const buildOrderBy = (query: AdminJobsListQuery): Prisma.JobOrderByWithRelationInput[] =>
  buildListOrderBy(
    query.sortBy,
    query.sortOrder,
    JOB_SORT_MAP,
    { sortBy: 'createdAt', sortOrder: resolveSortDir(query.sortOrder) },
    { id: 'asc' }
  );

export const getAdminJobsStats = async (filters: AdminJobFilters) => {
  const baseWhere = buildJobWhere(filters, false);
  const [grouped, quotedCount] = await Promise.all([
    prisma.job.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.job.count({
      where: {
        AND: [
          baseWhere,
          {
            OR: [
              { status: JobStatus.QUOTED },
              { status: JobStatus.PUBLISHED, traderId: null, quotes: { some: {} } },
            ],
          },
        ],
      },
    }),
  ]);

  const rawCounts = new Map(grouped.map((g) => [g.status, g._count._all]));
  const explicitQuoted = rawCounts.get(JobStatus.QUOTED) ?? 0;
  const rawPublished = rawCounts.get(JobStatus.PUBLISHED) ?? 0;
  const publishedWithQuotes = Math.max(0, quotedCount - explicitQuoted);
  const publishedAwaitingTrader = Math.max(0, rawPublished - publishedWithQuotes);

  const counts = new Map(rawCounts);
  counts.set(JobStatus.QUOTED, quotedCount);
  counts.set(JobStatus.PUBLISHED, publishedAwaitingTrader);

  const count = (statuses: JobStatus[]) => statuses.reduce((sum, s) => sum + (counts.get(s) ?? 0), 0);

  return {
    totalJobs: count(Object.values(JobStatus)),
    activeJobs: count(ACTIVE_STATUSES),
    pendingJobs: count(PENDING_STATUSES),
    completedJobs: count([JobStatus.COMPLETED]),
    cancelledJobs: count([JobStatus.CANCELLED]),
    paymentPendingJobs: count([JobStatus.PAYMENT_PENDING]),
    draftJobs: count([JobStatus.DRAFT]),
    byStatus: Object.values(JobStatus).map((status) => ({
      status,
      label: ADMIN_JOB_STATUS_LABELS[status],
      count: counts.get(status) ?? 0,
    })),
  };
};

const JOB_LIST_INCLUDE = {
  category: { select: { id: true, name: true } },
  subcategory: { select: { id: true, name: true } },
  customer: {
    select: { id: true, customerCode: true, fullName: true, mobileNumber: true, email: true, profilePhotoUrl: true },
  },
  trader: {
    select: {
      id: true,
      traderCode: true,
      businessName: true,
      traderType: true,
      user: { select: { fullName: true, profilePhotoUrl: true } },
    },
  },
  offer: { select: { id: true, title: true, offerCode: true } },
  photos: { take: 1, orderBy: { createdAt: 'asc' }, select: { photoUrl: true } },
  siteVisitRequests: {
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      status: true,
      visitDate: true,
      timeSlot: true,
      arrivedAt: true,
      completedAt: true,
      durationMinutes: true,
      createdAt: true,
      updatedAt: true,
      trader: {
        select: {
          id: true,
          traderCode: true,
          businessName: true,
          user: { select: { fullName: true } },
        },
      },
      slots: {
        where: { isSelected: true },
        take: 1,
        select: { visitDate: true, timeSlot: true },
      },
    },
  },
  _count: { select: { quotes: true, siteVisitRequests: true } },
  booking: {
    select: {
      id: true,
      bookingRef: true,
      status: true,
      invoice: {
        select: {
          id: true,
          totalAmount: true,
          status: true,
          currencyCode: true,
          paymentRequestId: true,
          serviceCharge: true,
          traderOfferDiscount: true,
        },
      },
    },
  },
  ...jobPayoutListInclude,
} satisfies Prisma.JobInclude;

const JOB_RANK_SELECT = {
  id: true,
  createdAt: true,
  serviceCharge: true,
  offerId: true,
  subcategory: { select: { name: true } },
  trader: { select: { businessName: true, user: { select: { fullName: true } } } },
  booking: { select: { invoice: { select: { totalAmount: true, status: true } } } },
} satisfies Prisma.JobSelect;

type JobRankRow = Prisma.JobGetPayload<{ select: typeof JOB_RANK_SELECT }>;

/**
 * Columns Prisma cannot ORDER BY with empty values last (COALESCE / optional relations):
 * `amount` = invoice total else service charge; `paymentStatus` = invoice status else NOT_INVOICED.
 */
const COMPUTED_JOB_SORTS: Record<string, (row: JobRankRow) => unknown> = {
  amount: (r) => money(r.booking?.invoice?.totalAmount ?? r.serviceCharge),
  subcategoryName: (r) => r.subcategory?.name ?? null,
  traderName: (r) => (r.trader ? r.trader.businessName || r.trader.user?.fullName || null : null),
  paymentStatus: (r) => r.booking?.invoice?.status ?? 'NOT_INVOICED',
  offerApplied: (r) => (r.offerId ? 1 : 0),
};

/** Rank the filtered ids on a computed column, then load only the requested page. */
const findPageByComputed = async (
  where: Prisma.JobWhereInput,
  keyOf: (row: JobRankRow) => unknown,
  sort: SortDir,
  skip: number,
  take: number
) => {
  const candidates = await prisma.job.findMany({ where, select: JOB_RANK_SELECT });
  const pageIds = pageIdsByComputedKey(candidates, keyOf, sort, skip, take);

  const rows = await prisma.job.findMany({ where: { id: { in: pageIds } }, include: JOB_LIST_INCLUDE });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return pageIds.map((id) => byId.get(id)!).filter(Boolean);
};

type AdminJobListRow = Prisma.JobGetPayload<{ include: typeof JOB_LIST_INCLUDE }>;

/** Latest site-visit requests on a jobs-table row (full real list; one row per trader). */
const serializeListSiteVisits = (job: AdminJobListRow) => {
  const siteVisits = job.siteVisitRequests.map((visit) => {
    const selected = visit.slots[0] ?? null;
    return {
      id: visit.id,
      status: visit.status,
      statusLabel: SITE_VISIT_STATUS_LABELS[visit.status],
      visitDate: dateKey(selected?.visitDate ?? visit.visitDate),
      timeSlot: selected?.timeSlot ?? visit.timeSlot,
      arrivedAt: visit.arrivedAt,
      completedAt: visit.completedAt,
      durationMinutes: visit.durationMinutes,
      requestedAt: visit.createdAt,
      updatedAt: visit.updatedAt,
      trader: visit.trader
        ? {
            id: visit.trader.id,
            traderCode: visit.trader.traderCode,
            businessName: visit.trader.businessName,
            fullName: visit.trader.user?.fullName ?? null,
          }
        : null,
    };
  });
  return {
    siteVisitRequested: job.siteVisitRequested,
    siteVisitFee: money(job.siteVisitFee),
    /** true when the customer asked for a visit or any trader request exists. */
    hasSiteVisit: job.siteVisitRequested || siteVisits.length > 0,
    siteVisitsCount: siteVisits.length,
    /** Most recently updated request, or null. */
    siteVisit: siteVisits[0] ?? null,
    siteVisits,
  };
};

export const listAdminJobs = async (query: AdminJobsListQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const where = buildJobWhere(query);
  const computedKey = query.sortBy ? COMPUTED_JOB_SORTS[query.sortBy] : undefined;

  const [total, rows] = await Promise.all([
    prisma.job.count({ where }),
    computedKey
      ? findPageByComputed(where, computedKey, resolveSortDir(query.sortOrder), skip, limit)
      : prisma.job.findMany({ where, skip, take: limit, orderBy: buildOrderBy(query), include: JOB_LIST_INCLUDE }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    jobs: rows.map((job) => {
      const invoice = job.booking?.invoice ?? null;
      const estimatedAmount = money(job.serviceCharge);
      const isQuoted =
        job.status === JobStatus.QUOTED ||
        (job.status === JobStatus.PUBLISHED && job._count.quotes > 0 && !job.traderId);
      const displayStatus = isQuoted ? JobStatus.QUOTED : job.status;
      const traderPayout = serializeJobPayoutBalance(
        buildJobPayoutBalance({
          id: job.id,
          jobRef: job.jobRef,
          title: job.title,
          status: job.status,
          updatedAt: job.updatedAt,
          paymentRequests: job.paymentRequests,
          booking: job.booking,
          payouts: job.payouts,
        })
      );
      return {
        id: job.id,
        jobRef: job.jobRef,
        title: job.title,
        status: displayStatus,
        statusLabel: ADMIN_JOB_STATUS_LABELS[displayStatus] ?? displayStatus,
        archivedAt: job.archivedAt,
        category: job.category,
        subcategory: job.subcategory,
        customer: job.customer,
        trader: job.trader
          ? {
              id: job.trader.id,
              traderCode: job.trader.traderCode,
              businessName: job.trader.businessName,
              traderType: job.trader.traderType,
              fullName: job.trader.user?.fullName ?? null,
              profilePhotoUrl: job.trader.user?.profilePhotoUrl ?? null,
            }
          : null,
        addressLine: job.addressLine,
        city: job.city,
        postcode: job.postcode,
        scheduledDate: job.scheduledDate,
        createdAt: job.createdAt,
        amount: invoice ? money(invoice.totalAmount) : estimatedAmount,
        estimatedAmount,
        currencyCode: invoice?.currencyCode ?? traderPayout.currencyCode,
        paymentStatus: invoice?.status ?? 'NOT_INVOICED',
        /** Job-wise trader bank payout balance (manual admin installments). */
        traderPayout,
        payoutStatus: traderPayout.payoutStatus,
        totalPayable: traderPayout.totalPayable,
        amountPaid: traderPayout.amountPaid,
        remainingBalance: traderPayout.remainingBalance,
        eligibleForPayout: traderPayout.eligibleForPayout,
        offerApplied: Boolean(job.offerId),
        offer: job.offer,
        quotesCount: job._count.quotes,
        coverPhotoUrl: job.photos[0]?.photoUrl ?? null,
        ...serializeListSiteVisits(job),
        booking: job.booking
          ? {
              id: job.booking.id,
              bookingRef: job.booking.bookingRef,
              status: job.booking.status,
              invoiceId: invoice?.id ?? null,
            }
          : null,
      };
    }),
  };
};

export const getAdminJob = async (jobId: string) => {
  const job = await getAdminJobDetail({ id: jobId });
  const isQuoted =
    job.status === JobStatus.QUOTED ||
    (job.status === JobStatus.PUBLISHED && job.quotes.length > 0 && !job.trader);
  const displayStatus = isQuoted ? JobStatus.QUOTED : job.status;
  return { ...job, status: displayStatus, statusLabel: ADMIN_JOB_STATUS_LABELS[displayStatus] ?? displayStatus };
};

type AdminActor = { id: string; label: string };

const findJobForAdminAction = async (jobId: string) => {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, jobRef: true, customerId: true, status: true, archivedAt: true },
  });
  if (!job) throw new NotFoundError('Job not found.');
  return job;
};

const auditJobAction = (admin: AdminActor, eventType: string, jobId: string, description: string) =>
  prisma.auditLog.create({
    data: {
      eventType,
      actorType: ActorType.ADMIN,
      actorId: admin.id,
      actorLabel: admin.label,
      subjectType: 'Job',
      subjectId: jobId,
      description,
    },
  });

/** Same rules as customer cancel; customer + trader are both notified ("cancelled by BRISK support"). */
export const adminCancelJob = async (jobId: string, reason: string, admin: AdminActor) => {
  const job = await findJobForAdminAction(jobId);
  await cancelJob(job.customerId, job.id, reason, 'ADMIN');
  await auditJobAction(admin, 'JOB_CANCELLED_BY_ADMIN', job.id, `Cancelled job ${job.jobRef}: ${reason}`);
  return getAdminJob(job.id);
};

/** Same rules as customer reschedule; customer + trader are both notified. */
export const adminRescheduleJob = async (
  jobId: string,
  input: AdminRescheduleJobInput,
  admin: AdminActor
) => {
  const job = await findJobForAdminAction(jobId);
  await rescheduleJob(job.customerId, job.id, input, 'ADMIN');
  await auditJobAction(
    admin,
    'JOB_RESCHEDULED_BY_ADMIN',
    job.id,
    `Rescheduled job ${job.jobRef} to ${input.date} (${input.timeSlot}).`
  );
  return getAdminJob(job.id);
};

/** Archive hides a finished job from the default admin list (`archived=true|all` to see it). */
export const adminSetJobArchived = async (jobId: string, archived: boolean, admin: AdminActor) => {
  const job = await findJobForAdminAction(jobId);
  if (archived && job.status !== JobStatus.COMPLETED && job.status !== JobStatus.CANCELLED) {
    throw new BadRequestError('Only completed or cancelled jobs can be archived.');
  }
  if (archived !== Boolean(job.archivedAt)) {
    await prisma.job.update({
      where: { id: job.id },
      data: { archivedAt: archived ? new Date() : null },
    });
    await auditJobAction(
      admin,
      archived ? 'JOB_ARCHIVED' : 'JOB_UNARCHIVED',
      job.id,
      `${archived ? 'Archived' : 'Unarchived'} job ${job.jobRef}.`
    );
  }
  return getAdminJob(job.id);
};

export const getAdminJobChat = (jobId: string, query: { page?: number; limit?: number }) =>
  getAdminJobChatThread({ id: jobId }, query);

// ---------------------------------------------------------------------------
// Disputes (customer "Report an Issue")
// ---------------------------------------------------------------------------

const DISPUTE_INCLUDE = {
  job: { select: { id: true, jobRef: true, title: true, status: true } },
  customer: { select: { id: true, fullName: true, email: true, mobileNumber: true, profilePhotoUrl: true } },
  trader: {
    select: { id: true, businessName: true, traderCode: true, user: { select: { fullName: true, profilePhotoUrl: true } } },
  },
} satisfies Prisma.JobDisputeInclude;

const serializeAdminDispute = (d: Prisma.JobDisputeGetPayload<{ include: typeof DISPUTE_INCLUDE }>) => ({
  id: d.id,
  disputeRef: d.disputeRef,
  reason: d.reason,
  description: d.description,
  evidenceUrls: d.evidenceUrls,
  status: d.status,
  adminNote: d.adminNote,
  resolvedAt: d.resolvedAt,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
  job: { ...d.job, status: d.job.status.replace(/_/g, ' '), statusLabel: ADMIN_JOB_STATUS_LABELS[d.job.status] },
  customer: d.customer,
  trader: d.trader
    ? {
        id: d.trader.id,
        traderCode: d.trader.traderCode,
        businessName: d.trader.businessName,
        fullName: d.trader.user.fullName,
        profilePhotoUrl: d.trader.user.profilePhotoUrl,
      }
    : null,
});

const DISPUTE_SORT_MAP: Record<
  string,
  (dir: SortDir) => Prisma.JobDisputeOrderByWithRelationInput | Prisma.JobDisputeOrderByWithRelationInput[]
> = {
  createdAt: (dir) => ({ createdAt: dir }),
  updatedAt: (dir) => ({ updatedAt: dir }),
  resolvedAt: (dir) => [{ resolvedAt: { sort: dir, nulls: 'last' } }, { createdAt: 'desc' }],
  disputeRef: (dir) => ({ disputeRef: dir }),
  reason: (dir) => [{ reason: dir }, { createdAt: 'desc' }],
  status: (dir) => [{ status: dir }, { createdAt: 'desc' }],
  jobRef: (dir) => [{ job: { jobRef: { sort: dir, nulls: 'last' } } }, { createdAt: 'desc' }],
  jobTitle: (dir) => [{ job: { title: dir } }, { createdAt: 'desc' }],
  customerName: (dir) => [{ customer: { fullName: dir } }, { createdAt: 'desc' }],
};

export const listAdminDisputes = async (query: AdminDisputesListQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const and: Prisma.JobDisputeWhereInput[] = [dateRangeFilter(query.from, query.to, 'createdAt')];
  if (query.status) and.push({ status: query.status });
  if (query.reason) and.push({ reason: { contains: query.reason, mode: 'insensitive' } });
  if (query.jobId) and.push({ jobId: query.jobId });
  if (query.customerId) and.push({ customerId: query.customerId });
  if (query.traderId) and.push({ traderId: query.traderId });
  const q = query.search?.trim();
  if (q) {
    const contains = { contains: q, mode: 'insensitive' as const };
    and.push({
      OR: [
        { disputeRef: contains },
        { reason: contains },
        { job: { jobRef: contains } },
        { job: { title: contains } },
        { customer: { fullName: contains } },
        { customer: { email: contains } },
        { trader: { businessName: contains } },
        { trader: { user: { fullName: contains } } },
      ],
    });
  }
  const where: Prisma.JobDisputeWhereInput = { AND: and };
  const skip = (page - 1) * limit;
  const dir = resolveSortDir(query.sortOrder);

  const findPage = async () => {
    if (query.sortBy === 'traderName') {
      const candidates = await prisma.jobDispute.findMany({
        where,
        select: { id: true, createdAt: true, trader: { select: { businessName: true, user: { select: { fullName: true } } } } },
      });
      const ids = pageIdsByComputedKey(
        candidates,
        (r) => (r.trader ? r.trader.businessName || r.trader.user.fullName : null),
        dir,
        skip,
        limit
      );
      const found = await prisma.jobDispute.findMany({ where: { id: { in: ids } }, include: DISPUTE_INCLUDE });
      const byId = new Map(found.map((r) => [r.id, r]));
      return ids.map((id) => byId.get(id)!).filter(Boolean);
    }
    return prisma.jobDispute.findMany({
      where,
      orderBy: buildListOrderBy(query.sortBy, query.sortOrder, DISPUTE_SORT_MAP, { sortBy: 'createdAt', sortOrder: 'desc' }, { id: 'asc' }),
      skip,
      take: limit,
      include: DISPUTE_INCLUDE,
    });
  };

  const [total, rows, byStatus] = await Promise.all([
    prisma.jobDispute.count({ where }),
    findPage(),
    prisma.jobDispute.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  return {
    items: rows.map(serializeAdminDispute),
    stats: Object.fromEntries(
      ADMIN_DISPUTE_STATUSES.map((status) => [status, byStatus.find((s) => s.status === status)?._count._all ?? 0])
    ),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
  };
};

export const getAdminDispute = async (id: string) => {
  const dispute = await prisma.jobDispute.findUnique({ where: { id }, include: DISPUTE_INCLUDE });
  if (!dispute) throw new NotFoundError('Dispute not found.');
  return serializeAdminDispute(dispute);
};

export const updateAdminDispute = async (id: string, input: AdminUpdateDisputeInput) => {
  const existing = await prisma.jobDispute.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) throw new NotFoundError('Dispute not found.');

  const closing = input.status === 'RESOLVED' || input.status === 'REJECTED';
  const updated = await prisma.jobDispute.update({
    where: { id },
    data: {
      status: input.status,
      adminNote: input.adminNote,
      ...(input.status ? { resolvedAt: closing ? new Date() : null } : {}),
    },
    include: DISPUTE_INCLUDE,
  });

  if (input.status && input.status !== existing.status) {
    await pushUserNotification([updated.customer.id], {
      type: 'DISPUTE_UPDATE',
      title: `Issue ${updated.disputeRef} ${input.status.toLowerCase()}`,
      message: updated.adminNote
        ? updated.adminNote
        : `Your reported issue on "${updated.job.title}" is now ${input.status.toLowerCase()}.`,
      data: { disputeId: updated.id, disputeRef: updated.disputeRef, jobId: updated.job.id, status: input.status },
    });
  }

  return serializeAdminDispute(updated);
};

export const getAdminJobSiteVisits = async (jobId: string) => {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, jobRef: true, title: true, status: true },
  });
  if (!job) throw new NotFoundError('Job not found.');
  return { job, ...(await listJobSiteVisits(job.id)) };
};
