import { InvoiceStatus, JobStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import { listJobSiteVisits } from '../../site-visits/site-visits.service';
import {
  dateRangeFilter,
  getAdminJobChatThread,
  getAdminJobDetail,
} from '../admin-customer-details/admin-customer-details.service';
import { pushUserNotification } from '../../../sockets/realtime';
import type {
  AdminDisputesListQuery,
  AdminJobFilters,
  AdminJobsListQuery,
  AdminUpdateDisputeInput,
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

const NO_INVOICE: Prisma.JobWhereInput = {
  OR: [{ booking: { is: null } }, { booking: { is: { invoice: { is: null } } } }],
};

/** Shared WHERE for list + stats. Stats skip `status` so tab counts stay visible while a tab is selected. */
const buildJobWhere = (filters: AdminJobFilters, includeStatus = true): Prisma.JobWhereInput => {
  const and: Prisma.JobWhereInput[] = [dateRangeFilter(filters.from, filters.to, 'createdAt')];

  if (filters.customerId) and.push({ customerId: filters.customerId });
  if (filters.traderId) and.push({ traderId: filters.traderId });
  if (filters.categoryId) and.push({ categoryId: filters.categoryId });
  if (includeStatus && filters.status?.length) and.push({ status: { in: filters.status } });

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

const buildOrderBy = (query: AdminJobsListQuery): Prisma.JobOrderByWithRelationInput[] => {
  const sort = query.sortOrder === 'asc' ? 'asc' : 'desc';
  switch (query.sortBy) {
    case 'scheduledDate':
      return [{ scheduledDate: { sort, nulls: 'last' } }, { createdAt: 'desc' }];
    case 'status':
      return [{ status: sort }, { createdAt: 'desc' }];
    case 'title':
      return [{ title: sort }, { createdAt: 'desc' }];
    default:
      return [{ createdAt: sort }];
  }
};

export const getAdminJobsStats = async (filters: AdminJobFilters) => {
  const grouped = await prisma.job.groupBy({
    by: ['status'],
    where: buildJobWhere(filters, false),
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((g) => [g.status, g._count._all]));
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
  _count: { select: { quotes: true } },
  booking: {
    select: {
      id: true,
      bookingRef: true,
      status: true,
      invoice: { select: { id: true, totalAmount: true, status: true, currencyCode: true } },
    },
  },
} satisfies Prisma.JobInclude;

/**
 * `amount` = invoice total, else agreed service charge — a COALESCE Prisma cannot ORDER BY,
 * so rank the filtered ids on that value, then load only the requested page.
 */
const findPageByAmount = async (where: Prisma.JobWhereInput, sort: 'asc' | 'desc', skip: number, take: number) => {
  const candidates = await prisma.job.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      serviceCharge: true,
      booking: { select: { invoice: { select: { totalAmount: true } } } },
    },
  });
  const amountOf = (c: (typeof candidates)[number]) => money(c.booking?.invoice?.totalAmount ?? c.serviceCharge);
  const pageIds = candidates
    .sort((a, b) => {
      const x = amountOf(a);
      const y = amountOf(b);
      if (x === null || y === null) {
        if (x !== y) return x === null ? 1 : -1;
      } else if (x !== y) {
        return sort === 'asc' ? x - y : y - x;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(skip, skip + take)
    .map((c) => c.id);

  const rows = await prisma.job.findMany({ where: { id: { in: pageIds } }, include: JOB_LIST_INCLUDE });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return pageIds.map((id) => byId.get(id)!).filter(Boolean);
};

export const listAdminJobs = async (query: AdminJobsListQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const where = buildJobWhere(query);

  const [total, rows] = await Promise.all([
    prisma.job.count({ where }),
    query.sortBy === 'amount'
      ? findPageByAmount(where, query.sortOrder === 'asc' ? 'asc' : 'desc', skip, limit)
      : prisma.job.findMany({ where, skip, take: limit, orderBy: buildOrderBy(query), include: JOB_LIST_INCLUDE }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    jobs: rows.map((job) => {
      const invoice = job.booking?.invoice ?? null;
      const estimatedAmount = money(job.serviceCharge);
      return {
        id: job.id,
        jobRef: job.jobRef,
        title: job.title,
        status: job.status,
        statusLabel: ADMIN_JOB_STATUS_LABELS[job.status],
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
        currencyCode: invoice?.currencyCode ?? 'EUR',
        paymentStatus: invoice?.status ?? 'NOT_INVOICED',
        offerApplied: Boolean(job.offerId),
        offer: job.offer,
        quotesCount: job._count.quotes,
        coverPhotoUrl: job.photos[0]?.photoUrl ?? null,
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
  return { ...job, statusLabel: ADMIN_JOB_STATUS_LABELS[job.status] };
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
  job: { ...d.job, statusLabel: ADMIN_JOB_STATUS_LABELS[d.job.status] },
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

export const listAdminDisputes = async (query: AdminDisputesListQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const and: Prisma.JobDisputeWhereInput[] = [dateRangeFilter(query.from, query.to, 'createdAt')];
  if (query.status) and.push({ status: query.status });
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

  const [total, rows, byStatus] = await Promise.all([
    prisma.jobDispute.count({ where }),
    prisma.jobDispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: DISPUTE_INCLUDE,
    }),
    prisma.jobDispute.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  return {
    items: rows.map(serializeAdminDispute),
    stats: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
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
