import { Prisma, TraderPaymentRequestStatus } from '@prisma/client';
import { prisma } from '../../../config/database';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { buildPaginationMeta, parsePageLimit } from '../../../utils/pagination';
import { numberRangeWhere } from '../../../utils/list-filters';
import {
  buildListOrderBy,
  pageIdsByComputedKey,
  resolveSortDir,
  type SortDir,
} from '../../../utils/list-sort';
import { getCurrencyMeta } from '../../../services/currency.service';
import type { PaymentHistoryQuery, PaymentListFilters } from './trader-payments.validation';

const money = (v: Prisma.Decimal | number | null | undefined): number => {
  if (v == null) return 0;
  return Number(v);
};

const getPublicApiBase = (): string =>
  (
    process.env.PUBLIC_API_URL ||
    process.env.UPLOAD_PUBLIC_BASE_URL ||
    process.env.PUBLIC_API_BASE_URL ||
    'https://api.brisk.ie'
  ).replace(/\/$/, '');

const formatJobCode = (jobRef: string | null | undefined, jobId: string): string => {
  const raw = (jobRef || jobId.slice(0, 8)).trim();
  return raw.startsWith('#') ? raw : `#${raw}`;
};

const mapPaymentStatus = (
  status: TraderPaymentRequestStatus
): 'PAID' | 'PENDING' | 'REFUNDED' | 'CANCELLED' => {
  if (status === TraderPaymentRequestStatus.PAID) return 'PAID';
  if (status === TraderPaymentRequestStatus.CANCELLED) return 'CANCELLED';
  return 'PENDING';
};

const resolveDateRange = (
  filter: PaymentListFilters['filter'],
  startDate?: string,
  endDate?: string
): { gte?: Date; lte?: Date } | undefined => {
  const now = new Date();
  if (!filter || filter === 'all') return undefined;

  if (filter === 'custom') {
    if (!startDate || !endDate) {
      throw new BadRequestError('startDate and endDate are required for filter=custom.');
    }
    const gte = new Date(`${startDate}T00:00:00.000Z`);
    const lte = new Date(`${endDate}T23:59:59.999Z`);
    if (Number.isNaN(gte.getTime()) || Number.isNaN(lte.getTime())) {
      throw new BadRequestError('Invalid startDate or endDate.');
    }
    if (gte > lte) {
      throw new BadRequestError('startDate must be on or before endDate.');
    }
    return { gte, lte };
  }

  const gte = new Date(now);
  if (filter === 'last_30_days') gte.setUTCDate(gte.getUTCDate() - 30);
  else if (filter === 'last_6_months') gte.setUTCMonth(gte.getUTCMonth() - 6);
  else if (filter === 'last_1_year') gte.setUTCFullYear(gte.getUTCFullYear() - 1);
  return { gte, lte: now };
};

/**
 * Non-cancelled payment requests of a trader, filtered by date range (paid date for PAID,
 * request date otherwise), search (job ref / title / customer name), status, type and amount.
 */
export const buildTraderPaymentRequestWhere = (
  traderId: string,
  query: Pick<
    PaymentListFilters,
    'filter' | 'startDate' | 'endDate' | 'search' | 'status' | 'type' | 'minAmount' | 'maxAmount'
  >
): Prisma.TraderPaymentRequestWhereInput => {
  const search = query.search?.trim() || '';
  const dateRange = resolveDateRange(query.filter, query.startDate, query.endDate);
  const amount = numberRangeWhere(query.minAmount, query.maxAmount);

  const andFilters: Prisma.TraderPaymentRequestWhereInput[] = [];

  if (query.status === 'PAID') {
    andFilters.push({ status: TraderPaymentRequestStatus.PAID });
  } else if (query.status === 'PENDING') {
    andFilters.push({
      status: { in: [TraderPaymentRequestStatus.PENDING, TraderPaymentRequestStatus.SENT] },
    });
  }
  if (query.type) andFilters.push({ type: query.type });
  if (amount) andFilters.push({ totalAmount: amount });

  if (dateRange) {
    andFilters.push({
      OR: [
        { status: TraderPaymentRequestStatus.PAID, updatedAt: dateRange },
        {
          status: { not: TraderPaymentRequestStatus.PAID },
          createdAt: dateRange,
        },
      ],
    });
  }

  if (search) {
    andFilters.push({
      OR: [
        { job: { jobRef: { contains: search, mode: 'insensitive' } } },
        { job: { title: { contains: search, mode: 'insensitive' } } },
        {
          job: {
            customer: { fullName: { contains: search, mode: 'insensitive' } },
          },
        },
      ],
    });
  }

  return {
    traderId,
    status: { not: TraderPaymentRequestStatus.CANCELLED },
    ...(andFilters.length ? { AND: andFilters } : {}),
  };
};

/** Keys from Payment History and Earnings → Payment Transactions (each endpoint validates its own subset). */
const PAYMENT_REQUEST_SORT_MAP: Record<
  string,
  (dir: SortDir) => Prisma.TraderPaymentRequestOrderByWithRelationInput[]
> = {
  updatedAt: (dir) => [{ updatedAt: dir }, { createdAt: dir }],
  createdAt: (dir) => [{ createdAt: dir }],
  totalAmount: (dir) => [{ totalAmount: dir }],
  amount: (dir) => [{ totalAmount: dir }],
  status: (dir) => [{ status: dir }],
  paymentStatus: (dir) => [{ status: dir }],
  type: (dir) => [{ type: dir }],
  paymentType: (dir) => [{ type: dir }],
  jobCode: (dir) => [{ job: { jobRef: { sort: dir, nulls: 'last' } } }],
  jobTitle: (dir) => [{ job: { title: dir } }],
  title: (dir) => [{ job: { title: dir } }],
  customerName: (dir) => [{ job: { customer: { fullName: dir } } }],
  jobStatus: (dir) => [{ job: { status: dir } }],
};

/** Date shown on the row: paid date for PAID, request date otherwise. */
const DISPLAY_DATE_SORTS = new Set(['paymentDate', 'date']);

/** One page of payment requests; default order = last updated first (unchanged). */
export const findTraderPaymentRequestPage = async <
  S extends Prisma.TraderPaymentRequestSelect & { id: true },
>(
  where: Prisma.TraderPaymentRequestWhereInput,
  query: { sortBy?: string; sortOrder?: string },
  skip: number,
  take: number,
  select: S
): Promise<Prisma.TraderPaymentRequestGetPayload<{ select: S }>[]> => {
  type Row = Prisma.TraderPaymentRequestGetPayload<{ select: S }>;
  if (query.sortBy && DISPLAY_DATE_SORTS.has(query.sortBy)) {
    const candidates = await prisma.traderPaymentRequest.findMany({
      where,
      select: { id: true, status: true, createdAt: true, updatedAt: true },
    });
    const ids = pageIdsByComputedKey(
      candidates,
      (r) => (r.status === TraderPaymentRequestStatus.PAID ? r.updatedAt : r.createdAt).getTime(),
      resolveSortDir(query.sortOrder),
      skip,
      take
    );
    const rows = (await prisma.traderPaymentRequest.findMany({
      where: { id: { in: ids } },
      select,
    })) as unknown as Row[];
    const byId = new Map(rows.map((row) => [(row as unknown as { id: string }).id, row]));
    return ids.map((id) => byId.get(id)).filter((row): row is Row => Boolean(row));
  }
  return (await prisma.traderPaymentRequest.findMany({
    where,
    select,
    orderBy: buildListOrderBy<Prisma.TraderPaymentRequestOrderByWithRelationInput>(
      query.sortBy,
      query.sortOrder,
      PAYMENT_REQUEST_SORT_MAP,
      { sortBy: 'updatedAt', sortOrder: 'desc' },
      { id: 'asc' }
    ),
    skip,
    take,
  })) as unknown as Row[];
};

/**
 * Trader Payment History — paginated list for Profile / Payments screen.
 * GET /traders/payments/history
 */
export const listPaymentHistory = async (userId: string, query: PaymentHistoryQuery) => {
  const trader = await prisma.trader.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!trader) {
    throw new NotFoundError('Trader profile not found.');
  }

  const { page, limit, skip } = parsePageLimit(query, { defaultLimit: 10, maxLimit: 50 });
  const where = buildTraderPaymentRequestWhere(trader.id, query);

  const [total, rows] = await Promise.all([
    prisma.traderPaymentRequest.count({ where }),
    findTraderPaymentRequestPage(where, query, skip, limit, {
        id: true,
        jobId: true,
        status: true,
        totalAmount: true,
        currencyCode: true,
        createdAt: true,
        updatedAt: true,
        job: {
          select: {
            id: true,
            jobRef: true,
            title: true,
            customer: {
              select: { fullName: true, profilePhotoUrl: true },
            },
          },
        },
    }),
  ]);

  const currencyCodes = [...new Set(rows.map((r) => r.currencyCode || 'EUR'))];
  const symbolByCode = new Map<string, string>();
  await Promise.all(
    currencyCodes.map(async (code) => {
      const meta = await getCurrencyMeta(code);
      symbolByCode.set(code, meta.symbol);
    })
  );

  const apiBase = getPublicApiBase();
  const data = rows.map((row) => {
    const currencyCode = row.currencyCode || 'EUR';
    const status = mapPaymentStatus(row.status);
    const paymentDate =
      status === 'PAID' ? row.updatedAt : row.createdAt;

    return {
      id: row.id,
      jobId: row.jobId,
      jobCode: formatJobCode(row.job.jobRef, row.job.id),
      jobTitle: row.job.title,
      customerName: row.job.customer.fullName,
      customerImage: row.job.customer.profilePhotoUrl,
      totalAmount: money(row.totalAmount),
      currencyCode,
      currencySymbol: symbolByCode.get(currencyCode) || '€',
      status,
      paymentDate: paymentDate.toISOString(),
      receiptUrl: `${apiBase}/traders/jobs/mine/${row.jobId}/invoice/download`,
    };
  });

  return {
    data,
    meta: buildPaginationMeta(total, page, limit),
  };
};
