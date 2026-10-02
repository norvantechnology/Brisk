import { Prisma, TraderPaymentRequestStatus } from '@prisma/client';
import { prisma } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import {
  convertAmount,
  getCurrencyMeta,
  resolveUserCurrency,
} from '../../../services/currency.service';
import { buildPaginationMeta, parsePageLimit } from '../../../utils/pagination';
import { countActiveJobs } from '../jobs/trader-my-jobs.service';
import { buildTraderPaymentRequestWhere } from '../payments/trader-payments.service';
import type {
  EarningsDashboardQuery,
  PaymentTransactionsQuery,
} from './trader-earnings.validation';

const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || 'Europe/Dublin';
const DEFAULT_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 20;
/** Daily goal = average earnings per working day over this lookback (excluding today). */
const GOAL_LOOKBACK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const money = (v: Prisma.Decimal | number | null | undefined): number =>
  v == null ? 0 : Number(v);

const round2 = (n: number): number => Math.round(n * 100) / 100;

const dayKeyInTz = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const tzOffsetMs = (date: Date, timeZone: string): number => {
  const local = new Date(date.toLocaleString('en-US', { timeZone }));
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  return local.getTime() - utc.getTime();
};

/** UTC instant of local midnight (in `timeZone`) for the day containing `date`. */
const startOfDayInTz = (date: Date, timeZone: string): Date => {
  const utcMidnight = new Date(`${dayKeyInTz(date, timeZone)}T00:00:00.000Z`);
  return new Date(utcMidnight.getTime() - tzOffsetMs(utcMidnight, timeZone));
};

/** Start of the local day `days` before `dayStart` (DST-safe). */
const shiftDayStart = (dayStart: Date, days: number, timeZone: string): Date =>
  startOfDayInTz(new Date(dayStart.getTime() - days * DAY_MS + DAY_MS / 2), timeZone);

const formatDisplayDate = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const month = MONTHS[Number(get('month')) - 1] ?? get('month');
  return `${get('day')} ${month} ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
};

const paymentStatusLabel = (status: TraderPaymentRequestStatus): 'PAID' | 'PENDING' =>
  status === TraderPaymentRequestStatus.PAID ? 'PAID' : 'PENDING';

/** Trader view: customer has paid → RECEIVED, otherwise still PENDING. */
const traderPaymentStatus = (status: TraderPaymentRequestStatus): 'RECEIVED' | 'PENDING' =>
  status === TraderPaymentRequestStatus.PAID ? 'RECEIVED' : 'PENDING';

const readableStatus = (status: string): string => status.replace(/_/g, ' ');

/** e.g. "€ +40" / "€ +40.50" — payment requests are always money in for the trader. */
const formatSignedAmount = (amount: number, symbol: string): string => {
  const abs = Math.abs(amount);
  const value = Number.isInteger(abs) ? String(abs) : abs.toFixed(2);
  return `${symbol} ${amount < 0 ? '-' : '+'}${value}`;
};

const transactionSelect = {
  id: true,
  jobId: true,
  type: true,
  status: true,
  totalAmount: true,
  currencyCode: true,
  createdAt: true,
  updatedAt: true,
  job: { select: { title: true, status: true } },
} satisfies Prisma.TraderPaymentRequestSelect;

type TransactionRow = Prisma.TraderPaymentRequestGetPayload<{ select: typeof transactionSelect }>;

const loadCurrencySymbols = async (codes: Iterable<string>) => {
  const symbolByCode = new Map<string, string>();
  await Promise.all(
    [...new Set(codes)].map(async (code) =>
      symbolByCode.set(code, (await getCurrencyMeta(code)).symbol)
    )
  );
  return symbolByCode;
};

/** Same row shape for dashboard recentTransactions and the full payment-transactions list. */
const serializeTransaction = (
  row: TransactionRow,
  symbolByCode: Map<string, string>,
  timeZone: string
) => {
  const code = row.currencyCode || 'EUR';
  const isPaid = row.status === TraderPaymentRequestStatus.PAID;
  const symbol = symbolByCode.get(code) || code;
  const amount = money(row.totalAmount);
  return {
    id: row.id,
    jobId: row.jobId,
    title: row.job.title,
    formattedDate: formatDisplayDate(isPaid ? row.updatedAt : row.createdAt, timeZone),
    jobStatus: row.job.status,
    jobStatusLabel: readableStatus(row.job.status),
    amount,
    formattedAmount: formatSignedAmount(amount, symbol),
    currencyCode: code,
    currencySymbol: symbol,
    payoutStatus: paymentStatusLabel(row.status),
    paymentStatus: traderPaymentStatus(row.status),
    paymentType: row.type,
  };
};

const toCurrency = async (
  amount: number,
  from: string,
  to: string
): Promise<number> => {
  if (from === to) return amount;
  try {
    return (await convertAmount(amount, from, to)).amount;
  } catch {
    return amount;
  }
};

const growthPercent = (today: number, previous: number): number => {
  if (previous <= 0) return today > 0 ? 100 : 0;
  return round2(((today - previous) / previous) * 100);
};

/**
 * Trader Earnings Dashboard.
 * GET /traders/earnings/dashboard
 */
export const getEarningsDashboard = async (userId: string, query: EarningsDashboardQuery) => {
  const trader = await prisma.trader.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!trader) {
    throw new NotFoundError('Trader profile not found.');
  }

  const timeZone = query.timezone || DEFAULT_TIMEZONE;
  const recentLimit = Math.min(
    Math.max(Number(query.limit) || DEFAULT_RECENT_LIMIT, 1),
    MAX_RECENT_LIMIT
  );

  const now = new Date();
  const todayStart = startOfDayInTz(now, timeZone);
  const yesterdayStart = shiftDayStart(todayStart, 1, timeZone);
  const lookbackStart = shiftDayStart(todayStart, GOAL_LOOKBACK_DAYS, timeZone);

  const [
    currencyCode,
    paidInWindow,
    reviewAgg,
    avatarRows,
    jobsInProgressCount,
    transactionRows,
    feedbackRows,
  ] = await Promise.all([
    resolveUserCurrency(userId),
    prisma.traderPaymentRequest.findMany({
      where: {
        traderId: trader.id,
        status: TraderPaymentRequestStatus.PAID,
        updatedAt: { gte: lookbackStart, lte: now },
      },
      select: { totalAmount: true, currencyCode: true, updatedAt: true },
    }),
    prisma.ratingReview.aggregate({
      where: { traderId: trader.id },
      _avg: { stars: true },
      _count: { _all: true },
    }),
    prisma.ratingReview.findMany({
      where: { traderId: trader.id, customer: { profilePhotoUrl: { not: null } } },
      orderBy: { createdAt: 'desc' },
      distinct: ['customerId'],
      take: recentLimit,
      select: { customer: { select: { profilePhotoUrl: true } } },
    }),
    countActiveJobs(trader.id),
    prisma.traderPaymentRequest.findMany({
      where: {
        traderId: trader.id,
        status: { not: TraderPaymentRequestStatus.CANCELLED },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: recentLimit,
      select: transactionSelect,
    }),
    prisma.ratingReview.findMany({
      where: { traderId: trader.id },
      orderBy: { createdAt: 'desc' },
      take: recentLimit,
      select: {
        id: true,
        stars: true,
        review: true,
        createdAt: true,
        customer: { select: { fullName: true, profilePhotoUrl: true } },
        booking: {
          select: {
            job: { select: { city: true, address: { select: { city: true } } } },
          },
        },
      },
    }),
  ]);

  const todayKey = dayKeyInTz(now, timeZone);
  const yesterdayKey = dayKeyInTz(yesterdayStart, timeZone);
  const totalsByDay = new Map<string, number>();
  for (const row of paidInWindow) {
    const amount = await toCurrency(money(row.totalAmount), row.currencyCode || 'EUR', currencyCode);
    const key = dayKeyInTz(row.updatedAt, timeZone);
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + amount);
  }

  const todayRevenue = round2(totalsByDay.get(todayKey) ?? 0);
  const yesterdayRevenue = round2(totalsByDay.get(yesterdayKey) ?? 0);
  const pastWorkingDays = [...totalsByDay.entries()].filter(([key]) => key !== todayKey);
  const dailyGoalAmount = pastWorkingDays.length
    ? round2(pastWorkingDays.reduce((sum, [, v]) => sum + v, 0) / pastWorkingDays.length)
    : 0;
  const dailyGoalPercentage =
    dailyGoalAmount > 0 ? Math.round((todayRevenue / dailyGoalAmount) * 100) : 0;

  const symbolByCode = await loadCurrencySymbols([
    currencyCode,
    ...transactionRows.map((r) => r.currencyCode || 'EUR'),
  ]);

  return {
    revenue: {
      todayRevenue,
      currencyCode,
      currencySymbol: symbolByCode.get(currencyCode) || currencyCode,
      growthPercentage: growthPercent(todayRevenue, yesterdayRevenue),
      isGrowthPositive: todayRevenue >= yesterdayRevenue,
      dailyGoalPercentage,
      dailyGoalAmount,
    },
    overview: {
      averageRating: reviewAgg._avg.stars != null ? Math.round(reviewAgg._avg.stars * 10) / 10 : 0,
      totalReviewsCount: reviewAgg._count._all,
      recentReviewerAvatars: avatarRows
        .map((r) => r.customer.profilePhotoUrl)
        .filter((url): url is string => Boolean(url)),
      jobsInProgressCount,
    },
    recentTransactions: transactionRows.map((row) =>
      serializeTransaction(row, symbolByCode, timeZone)
    ),
    recentFeedbacks: feedbackRows.map((row) => ({
      id: row.id,
      rating: row.stars,
      comment: row.review,
      customerName: row.customer.fullName,
      customerLocation: row.booking.job?.address?.city ?? row.booking.job?.city ?? null,
      customerImage: row.customer.profilePhotoUrl,
      createdAt: row.createdAt.toISOString(),
    })),
  };
};

/**
 * Trader Earnings — full payment transactions list (same rows as dashboard recentTransactions).
 * GET /traders/earnings/payment-transactions
 */
export const listPaymentTransactions = async (
  userId: string,
  query: PaymentTransactionsQuery
) => {
  const trader = await prisma.trader.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!trader) {
    throw new NotFoundError('Trader profile not found.');
  }

  const timeZone = query.timezone || DEFAULT_TIMEZONE;
  const { page, limit, skip } = parsePageLimit(query, { defaultLimit: 10, maxLimit: 50 });
  const where = buildTraderPaymentRequestWhere(trader.id, query);

  const [total, rows] = await Promise.all([
    prisma.traderPaymentRequest.count({ where }),
    prisma.traderPaymentRequest.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      select: transactionSelect,
    }),
  ]);

  const symbolByCode = await loadCurrencySymbols(rows.map((r) => r.currencyCode || 'EUR'));

  return {
    data: rows.map((row) => serializeTransaction(row, symbolByCode, timeZone)),
    meta: buildPaginationMeta(total, page, limit),
  };
};
