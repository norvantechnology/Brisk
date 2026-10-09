import { JobStatus, Prisma, TraderSiteVisitStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { buildPaginationMeta, parsePageLimit } from '../../utils/pagination';
import { SITE_VISIT_SLOT_DEFS } from '../traders/jobs/trader-jobs.service';
import type { SiteVisitSortField } from './site-visits.validation';

/**
 * Shared site-visit list logic for Admin (customer + trader details) and the Trader Portal,
 * so every screen reports the same status for the same request.
 *
 * `status` is the request status, except an open request (PENDING / CONFIRMED / RESCHEDULE_REQUIRED)
 * becomes CLOSED when its job was cancelled, completed, or awarded to another trader.
 */
export type SiteVisitStatus = TraderSiteVisitStatus | 'CLOSED';
export type SiteVisitGroup = 'REQUESTED' | 'VISITED' | 'CLOSED';
export type SiteVisitClosedReason = 'JOB_CANCELLED' | 'JOB_COMPLETED' | 'ASSIGNED_TO_OTHER_TRADER';
type Audience = 'ADMIN' | 'TRADER';

const OPEN_STATUSES: TraderSiteVisitStatus[] = [
  TraderSiteVisitStatus.PENDING,
  TraderSiteVisitStatus.CONFIRMED,
  TraderSiteVisitStatus.RESCHEDULE_REQUIRED,
];
const CLOSED_JOB_STATUSES: JobStatus[] = [JobStatus.CANCELLED, JobStatus.COMPLETED];

const STATUS_LABELS: Record<SiteVisitStatus, string> = {
  PENDING: 'Waiting for Customer',
  CONFIRMED: 'Visit Confirmed',
  RESCHEDULE_REQUIRED: 'Reschedule Requested',
  COMPLETED: 'Site Visited',
  CANCELLED: 'Cancelled',
  CLOSED: 'Closed',
};

const siteVisitSelect = {
  id: true,
  jobId: true,
  traderId: true,
  status: true,
  visitDate: true,
  timeSlot: true,
  arrivedAt: true,
  completedAt: true,
  durationMinutes: true,
  createdAt: true,
  updatedAt: true,
  slots: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      visitDate: true,
      timeSlot: true,
      startTime: true,
      endTime: true,
      isSelected: true,
    },
  },
  job: {
    select: {
      id: true,
      jobRef: true,
      title: true,
      status: true,
      traderId: true,
      city: true,
      postcode: true,
      scheduledDate: true,
      siteVisitFee: true,
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
      customer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          mobileNumber: true,
          profilePhotoUrl: true,
        },
      },
    },
  },
  trader: {
    select: {
      id: true,
      traderCode: true,
      businessName: true,
      traderType: true,
      avgRating: true,
      profilePhotoUrl: true,
      user: {
        select: { fullName: true, email: true, mobileNumber: true, profilePhotoUrl: true },
      },
    },
  },
} satisfies Prisma.TraderSiteVisitRequestSelect;

type SiteVisitRow = Prisma.TraderSiteVisitRequestGetPayload<{ select: typeof siteVisitSelect }>;

const dateKey = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

const closedReasonFor = (row: SiteVisitRow): SiteVisitClosedReason | null => {
  if (!OPEN_STATUSES.includes(row.status)) return null;
  if (row.job.status === JobStatus.CANCELLED) return 'JOB_CANCELLED';
  if (row.job.status === JobStatus.COMPLETED) return 'JOB_COMPLETED';
  if (row.job.traderId && row.job.traderId !== row.traderId) return 'ASSIGNED_TO_OTHER_TRADER';
  return null;
};

const groupFor = (status: SiteVisitStatus): SiteVisitGroup => {
  if (status === TraderSiteVisitStatus.COMPLETED) return 'VISITED';
  if (status === TraderSiteVisitStatus.CANCELLED || status === 'CLOSED') return 'CLOSED';
  return 'REQUESTED';
};

/** Job still open for this trader: not cancelled / completed, and unassigned or assigned to them. */
const jobOpenFor = (traderId: string): Prisma.JobWhereInput => ({
  status: { notIn: CLOSED_JOB_STATUSES },
  OR: [{ traderId: null }, { traderId }],
});

const jobClosedFor = (traderId: string): Prisma.JobWhereInput => ({
  OR: [
    { status: { in: CLOSED_JOB_STATUSES } },
    { AND: [{ traderId: { not: null } }, { traderId: { not: traderId } }] },
  ],
});

export const siteVisitGroupWhere = (
  traderId: string,
  group: SiteVisitGroup
): Prisma.TraderSiteVisitRequestWhereInput => {
  if (group === 'VISITED') return { status: TraderSiteVisitStatus.COMPLETED };
  if (group === 'REQUESTED') return { status: { in: OPEN_STATUSES }, job: jobOpenFor(traderId) };
  return {
    OR: [
      { status: TraderSiteVisitStatus.CANCELLED },
      { status: { in: OPEN_STATUSES }, job: jobClosedFor(traderId) },
    ],
  };
};

const statusWhere = (
  traderId: string,
  status: SiteVisitStatus
): Prisma.TraderSiteVisitRequestWhereInput => {
  if (status === 'CLOSED') return { status: { in: OPEN_STATUSES }, job: jobClosedFor(traderId) };
  if (OPEN_STATUSES.includes(status)) return { status, job: jobOpenFor(traderId) };
  return { status };
};

export const serializeSiteVisit = (row: SiteVisitRow, audience: Audience) => {
  const closedReason = closedReasonFor(row);
  const status: SiteVisitStatus = closedReason ? 'CLOSED' : row.status;

  const slots = row.slots.map((slot) => ({
    id: slot.id,
    date: dateKey(slot.visitDate)!,
    timeSlot: slot.timeSlot,
    startTime: slot.startTime,
    endTime: slot.endTime,
    isSelected: slot.isSelected,
  }));
  const selected = slots.find((s) => s.isSelected) ?? null;
  const timeSlot = selected?.timeSlot ?? row.timeSlot ?? null;
  const defaults = timeSlot ? SITE_VISIT_SLOT_DEFS[timeSlot] : null;

  const customer = row.job.customer;
  const trader = row.trader;

  return {
    id: row.id,
    requestId: row.id,
    status,
    statusLabel: STATUS_LABELS[status],
    group: groupFor(status),
    /** Raw request status as stored (differs from `status` only when CLOSED). */
    requestStatus: row.status,
    closedReason,
    visitDate: selected?.date ?? dateKey(row.visitDate),
    timeSlot,
    startTime: selected?.startTime ?? defaults?.startTime ?? null,
    endTime: selected?.endTime ?? defaults?.endTime ?? null,
    slots,
    slotCount: slots.length,
    siteVisitFee: row.job.siteVisitFee != null ? Number(row.job.siteVisitFee) : null,
    arrivedAt: row.arrivedAt,
    completedAt: row.completedAt,
    durationMinutes: row.durationMinutes,
    requestedAt: row.createdAt,
    updatedAt: row.updatedAt,
    job: {
      id: row.job.id,
      jobRef: row.job.jobRef,
      title: row.job.title,
      status: row.job.status,
      category: row.job.category,
      subcategory: row.job.subcategory,
      city: row.job.city,
      postcode: row.job.postcode,
      scheduledDate: row.job.scheduledDate,
      ...(audience === 'ADMIN' ? { assignedTraderId: row.job.traderId } : {}),
    },
    customer:
      audience === 'ADMIN'
        ? {
            id: customer.id,
            fullName: customer.fullName,
            email: customer.email,
            mobileNumber: customer.mobileNumber,
            profilePhotoUrl: customer.profilePhotoUrl,
          }
        : { fullName: customer.fullName, profilePhotoUrl: customer.profilePhotoUrl },
    ...(audience === 'ADMIN'
      ? {
          trader: {
            id: trader.id,
            traderCode: trader.traderCode,
            name: trader.businessName || trader.user.fullName,
            fullName: trader.user.fullName,
            businessName: trader.businessName,
            traderType: trader.traderType,
            avgRating: Number(trader.avgRating),
            email: trader.user.email,
            mobileNumber: trader.user.mobileNumber,
            profilePhotoUrl: trader.profilePhotoUrl ?? trader.user.profilePhotoUrl ?? null,
          },
        }
      : {}),
  };
};

const summarize = (items: Array<{ group: SiteVisitGroup }>) => ({
  total: items.length,
  requestedCount: items.filter((i) => i.group === 'REQUESTED').length,
  visitedCount: items.filter((i) => i.group === 'VISITED').length,
  closedCount: items.filter((i) => i.group === 'CLOSED').length,
});

/** Admin Customer Details → job: every trader who requested a site visit on this job. */
export const listJobSiteVisits = async (jobId: string) => {
  const rows = await prisma.traderSiteVisitRequest.findMany({
    where: { jobId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: siteVisitSelect,
  });
  const items = rows.map((row) => serializeSiteVisit(row, 'ADMIN'));
  return { items, summary: summarize(items) };
};

export type TraderSiteVisitListQuery = {
  group?: SiteVisitGroup;
  status?: SiteVisitStatus;
  search?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  sortBy?: SiteVisitSortField;
  sortOrder?: 'asc' | 'desc';
  page?: number | string;
  limit?: number | string;
};

const SITE_VISIT_SORT_MAP: Record<
  Exclude<SiteVisitSortField, 'visitDate'>,
  (dir: 'asc' | 'desc') => Prisma.TraderSiteVisitRequestOrderByWithRelationInput
> = {
  updatedAt: (dir) => ({ updatedAt: dir }),
  requestedAt: (dir) => ({ createdAt: dir }),
  jobRef: (dir) => ({ job: { jobRef: { sort: dir, nulls: 'last' } } }),
  jobTitle: (dir) => ({ job: { title: dir } }),
  customerName: (dir) => ({ job: { customer: { fullName: dir } } }),
  categoryName: (dir) => ({ job: { category: { name: dir } } }),
};

/** Displayed visit date = selected slot date, else the request's visitDate (same as serializer). */
const effectiveVisitDate = (row: {
  visitDate: Date | null;
  slots: Array<{ visitDate: Date; isSelected: boolean }>;
}): Date | null => row.slots.find((s) => s.isSelected)?.visitDate ?? row.visitDate;

const visitDateRange = (from?: string, to?: string): Prisma.TraderSiteVisitRequestWhereInput => {
  if (!from && !to) return {};
  const range = {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
  };
  return {
    OR: [
      { slots: { some: { isSelected: true, visitDate: range } } },
      { slots: { none: { isSelected: true } }, visitDate: range },
    ],
  };
};

/** Page of ids ordered by displayed visit date (nulls last), so sort matches what the UI shows. */
const pageIdsByVisitDate = async (
  where: Prisma.TraderSiteVisitRequestWhereInput,
  sortOrder: 'asc' | 'desc',
  skip: number,
  take: number
): Promise<string[]> => {
  const rows = await prisma.traderSiteVisitRequest.findMany({
    where,
    select: {
      id: true,
      visitDate: true,
      slots: { where: { isSelected: true }, select: { visitDate: true, isSelected: true } },
    },
  });
  const dir = sortOrder === 'asc' ? 1 : -1;
  return rows
    .map((row) => ({ id: row.id, time: effectiveVisitDate(row)?.getTime() ?? null }))
    .sort((a, b) => {
      if (a.time === b.time) return a.id.localeCompare(b.id);
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return (a.time - b.time) * dir;
    })
    .slice(skip, skip + take)
    .map((row) => row.id);
};

/** Paginated site visits for one trader (Admin Trader Details + Trader Portal). */
export const listTraderSiteVisits = async (
  traderId: string,
  query: TraderSiteVisitListQuery,
  audience: Audience
) => {
  const { page, limit, skip } = parsePageLimit(query);
  const search = query.search?.trim();

  const baseWhere: Prisma.TraderSiteVisitRequestWhereInput = {
    AND: [
      { traderId },
      visitDateRange(query.from, query.to),
      query.categoryId ? { job: { categoryId: query.categoryId } } : {},
      search
        ? {
            job: {
              OR: [
                { jobRef: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { customer: { fullName: { contains: search, mode: 'insensitive' } } },
              ],
            },
          }
        : {},
    ],
  };

  const filters: Prisma.TraderSiteVisitRequestWhereInput[] = [baseWhere];
  if (query.group) filters.push(siteVisitGroupWhere(traderId, query.group));
  if (query.status) filters.push(statusWhere(traderId, query.status));
  const listWhere: Prisma.TraderSiteVisitRequestWhereInput = { AND: filters };

  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const loadPage = async () => {
    if (query.sortBy === 'visitDate') {
      const ids = await pageIdsByVisitDate(listWhere, sortOrder, skip, limit);
      const found = await prisma.traderSiteVisitRequest.findMany({
        where: { id: { in: ids } },
        select: siteVisitSelect,
      });
      const byId = new Map(found.map((row) => [row.id, row]));
      return ids.map((id) => byId.get(id)).filter((row): row is SiteVisitRow => Boolean(row));
    }
    return prisma.traderSiteVisitRequest.findMany({
      where: listWhere,
      orderBy: [
        SITE_VISIT_SORT_MAP[(query.sortBy ?? 'updatedAt') as Exclude<SiteVisitSortField, 'visitDate'>](
          sortOrder
        ),
        { id: 'asc' },
      ],
      skip,
      take: limit,
      select: siteVisitSelect,
    });
  };

  const countGroup = (group: SiteVisitGroup) =>
    prisma.traderSiteVisitRequest.count({
      where: { AND: [baseWhere, siteVisitGroupWhere(traderId, group)] },
    });

  const [total, rows, requestedCount, visitedCount, closedCount] = await Promise.all([
    prisma.traderSiteVisitRequest.count({ where: listWhere }),
    loadPage(),
    countGroup('REQUESTED'),
    countGroup('VISITED'),
    countGroup('CLOSED'),
  ]);

  return {
    items: rows.map((row) => serializeSiteVisit(row, audience)),
    summary: {
      total: requestedCount + visitedCount + closedCount,
      requestedCount,
      visitedCount,
      closedCount,
    },
    meta: buildPaginationMeta(total, page, limit),
  };
};
