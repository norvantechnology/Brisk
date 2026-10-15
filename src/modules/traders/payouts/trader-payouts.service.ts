import { ActorType, PayoutStatus, Prisma, TraderType } from '@prisma/client';
import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import { getStripe, toPaymentError } from '../../../services/stripe.service';
import { resolveCountryIso, serializeConnectAccount } from '../../../services/stripe-connect.service';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { buildPaginationMeta, parsePageLimit } from '../../../utils/pagination';
import { resolveSortDir } from '../../../utils/list-sort';
import {
  buildJobPayoutBalance,
  jobPayoutSelect,
  serializeJobPayoutBalance,
} from '../../jobs/job-payout-balance';
import { createAdminNotifications } from '../../admin/admin-notifications/admin-notifications.service';
import { adminNotificationActionUrl } from '../../notifications/notification-action-urls';
import type {
  CreatePayoutRequestInput,
  StripeOnboardingLinkInput,
  TraderPayoutJobsQuery,
  TraderPayoutsListQuery,
} from './trader-payouts.validation';

const money = (v: Prisma.Decimal | number | null | undefined) => (v == null ? 0 : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

const getTrader = async (userId: string) => {
  const trader = await prisma.trader.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      traderType: true,
      country: true,
      stripeAccountId: true,
      businessName: true,
      bankName: true,
      bankHolderName: true,
      accountNumber: true,
      user: { select: { email: true, country: true, fullName: true } },
    },
  });
  if (!trader) throw new NotFoundError('Trader profile not found.');
  return trader;
};

const serializeTraderPayout = (
  p: {
    id: string;
    jobId: string | null;
    amount: Prisma.Decimal | number;
    currencyCode: string;
    status: PayoutStatus;
    note: string | null;
    bankReference: string | null;
    stripeTransferId: string | null;
    processedAt: Date | null;
    createdAt: Date;
    job?: { id: string; jobRef: string | null; title: string } | null;
  },
  trader: Awaited<ReturnType<typeof getTrader>>,
  jobBalance?: ReturnType<typeof buildJobPayoutBalance> | null
) => ({
  id: p.id,
  payoutRef: `PO-${p.id.slice(0, 8).toUpperCase()}`,
  jobId: p.jobId,
  jobRef: p.job?.jobRef ?? null,
  jobTitle: p.job?.title ?? null,
  amount: money(p.amount),
  currencyCode: p.currencyCode,
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
  jobPayout: jobBalance ? serializeJobPayoutBalance(jobBalance) : null,
});

/** Stripe Connect Express onboarding — trader adds bank / identity details on Stripe's hosted page. */
export const createStripeOnboardingLink = async (userId: string, input: StripeOnboardingLinkInput) => {
  const returnUrl = input.returnUrl ?? env.STRIPE_CONNECT_RETURN_URL;
  const refreshUrl = input.refreshUrl ?? env.STRIPE_CONNECT_REFRESH_URL;
  if (!returnUrl || !refreshUrl) {
    throw new BadRequestError('returnUrl and refreshUrl are required.', {
      code: 'CONNECT_URLS_REQUIRED',
    });
  }

  const trader = await getTrader(userId);
  try {
    const stripe = getStripe();
    let accountId = trader.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          type: 'express',
          country: await resolveCountryIso(trader.country ?? trader.user.country),
          email: trader.user.email,
          business_type: trader.traderType === TraderType.COMPANY ? 'company' : 'individual',
          capabilities: { transfers: { requested: true } },
          metadata: { traderId: trader.id, userId: trader.userId },
        },
        { idempotencyKey: `connect-account-${trader.id}` }
      );
      accountId = account.id;
      await prisma.trader.update({ where: { id: trader.id }, data: { stripeAccountId: accountId } });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return {
      accountId,
      url: link.url,
      expiresAt: new Date(link.expires_at * 1000).toISOString(),
    };
  } catch (error) {
    throw toPaymentError(error);
  }
};

export const getStripeConnectStatus = async (userId: string) => {
  const trader = await getTrader(userId);
  if (!trader.stripeAccountId) {
    return {
      connected: false,
      accountId: null,
      detailsSubmitted: false,
      payoutsEnabled: false,
      transfersEnabled: false,
      defaultCurrency: null,
      requirementsDue: [] as string[],
      disabledReason: null,
    };
  }
  try {
    return serializeConnectAccount(await getStripe().accounts.retrieve(trader.stripeAccountId));
  } catch (error) {
    throw toPaymentError(error);
  }
};

/** Jobs with customer-paid balances — request full/partial payouts from these. */
export const listPayoutJobs = async (userId: string, query: TraderPayoutJobsQuery = {}) => {
  const trader = await getTrader(userId);
  const { page, limit, skip } = parsePageLimit(query);

  const jobs = await prisma.job.findMany({
    where: {
      traderId: trader.id,
      ...(query.search?.trim()
        ? {
            OR: [
              { jobRef: { contains: query.search.trim(), mode: 'insensitive' } },
              { title: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: jobPayoutSelect,
  });

  let rows = jobs.map(buildJobPayoutBalance).filter((b) => b.totalPayable > 0);

  if (query.eligibleOnly) {
    rows = rows.filter((b) => b.eligibleForPayout);
  }
  if (query.payoutStatus) {
    rows = rows.filter((b) => b.payoutStatus === query.payoutStatus);
  }

  const sortBy = query.sortBy || 'updatedAt';
  const dir = resolveSortDir(query.sortOrder, 'desc');
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
      case 'availableToRequest':
        return b.availableToRequest;
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
  const pageRows = rows.slice(skip, skip + limit).map((b) => ({
    ...b,
    updatedAt: b.updatedAt.toISOString(),
  }));

  return {
    items: pageRows,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const getJobPayoutSummary = async (userId: string, jobId: string) => {
  const trader = await getTrader(userId);
  const [job, installments] = await Promise.all([
    prisma.job.findFirst({
      where: { id: jobId, traderId: trader.id },
      select: jobPayoutSelect,
    }),
    prisma.payout.findMany({
      where: { traderId: trader.id, jobId },
      orderBy: { createdAt: 'desc' },
      include: { job: { select: { id: true, jobRef: true, title: true } } },
    }),
  ]);
  if (!job) throw new NotFoundError('Job not found.');

  const balance = buildJobPayoutBalance(job);
  return {
    ...balance,
    updatedAt: balance.updatedAt.toISOString(),
    bank: {
      bankName: trader.bankName,
      bankHolderName: trader.bankHolderName,
      accountNumberMasked: trader.accountNumber ? `****${trader.accountNumber.slice(-4)}` : null,
    },
    installments: installments.map((p) => serializeTraderPayout(p, trader, balance)),
  };
};

export const listMyPayouts = async (userId: string, query: TraderPayoutsListQuery = {}) => {
  const trader = await getTrader(userId);
  const { page, limit, skip } = parsePageLimit(query);

  const where: Prisma.PayoutWhereInput = {
    traderId: trader.id,
    ...(query.status ? { status: query.status } : {}),
    ...(query.jobId ? { jobId: query.jobId } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.payout.count({ where }),
    prisma.payout.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { job: { select: { id: true, jobRef: true, title: true } } },
    }),
  ]);

  return {
    items: rows.map((p) => serializeTraderPayout(p, trader)),
    meta: buildPaginationMeta(total, page, limit),
  };
};

/**
 * Trader Web Portal — request full or partial payout for a job (status PENDING).
 * Amount must be ≤ availableToRequest (remaining after COMPLETED − open PENDING/PROCESSING).
 */
export const requestJobPayout = async (userId: string, input: CreatePayoutRequestInput) => {
  const trader = await getTrader(userId);
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, traderId: trader.id },
    select: jobPayoutSelect,
  });
  if (!job) throw new NotFoundError('Job not found.');

  const balance = buildJobPayoutBalance(job);
  if (balance.totalPayable <= 0) {
    throw new BadRequestError('This job has no customer-paid amount eligible for payout yet.', {
      code: 'JOB_NOT_ELIGIBLE_FOR_PAYOUT',
      data: serializeJobPayoutBalance(balance),
    });
  }
  if (balance.availableToRequest <= 0) {
    throw new BadRequestError(
      balance.remainingBalance <= 0
        ? 'This job is already fully paid out.'
        : 'Open payout requests already cover the remaining balance.',
      {
        code:
          balance.remainingBalance <= 0
            ? 'JOB_PAYOUT_ALREADY_COMPLETE'
            : 'JOB_PAYOUT_BALANCE_RESERVED',
        data: serializeJobPayoutBalance(balance),
      }
    );
  }
  if (input.amount - balance.availableToRequest > 0.001) {
    throw new BadRequestError(
      `Amount exceeds available balance (${balance.availableToRequest} ${balance.currencyCode}).`,
      {
        code: 'PAYOUT_EXCEEDS_REMAINING',
        data: { ...serializeJobPayoutBalance(balance), requestedAmount: input.amount },
      }
    );
  }

  const currencyCode = input.currencyCode ?? balance.currencyCode ?? 'EUR';
  const amount = round2(input.amount);

  const payout = await prisma.payout.create({
    data: {
      traderId: trader.id,
      jobId: job.id,
      amount,
      currencyCode,
      status: PayoutStatus.PENDING,
      note: input.note ?? null,
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
      eventType: 'TRADER_JOB_PAYOUT_REQUESTED',
      actorType: ActorType.TRADER,
      actorId: trader.userId,
      actorLabel: trader.businessName || trader.user.fullName || trader.user.email,
      subjectType: 'Job',
      subjectId: job.id,
      description: `Trader requested payout ${currencyCode} ${amount} for job ${job.jobRef ?? job.id} (available left ${nextBalance.availableToRequest})${input.note ? ` — ${input.note}` : ''}.`,
    },
  });

  await createAdminNotifications({
    type: 'TRADER_PAYOUT_REQUESTED',
    title: 'Trader payout requested',
    message: `${trader.businessName || trader.user.fullName || 'A trader'} requested ${currencyCode} ${amount.toFixed(2)} for "${job.title}" (${job.jobRef ?? job.id}).`,
    actionUrl: adminNotificationActionUrl.traderDetail(trader.id),
    payload: {
      traderId: trader.id,
      jobId: job.id,
      payoutId: payout.id,
      amount,
      currencyCode,
    },
  });

  return serializeTraderPayout(payout, trader, nextBalance);
};

/** Trader cancels their own PENDING payout request (frees availableToRequest). */
export const cancelPayoutRequest = async (userId: string, payoutId: string) => {
  const trader = await getTrader(userId);
  const existing = await prisma.payout.findFirst({
    where: { id: payoutId, traderId: trader.id },
    include: { job: { select: { id: true, jobRef: true, title: true } } },
  });
  if (!existing) throw new NotFoundError('Payout request not found.');
  if (existing.status !== PayoutStatus.PENDING) {
    throw new BadRequestError('Only a pending payout request can be cancelled.', {
      code: 'PAYOUT_NOT_PENDING',
    });
  }

  const updated = await prisma.payout.update({
    where: { id: existing.id },
    data: { status: PayoutStatus.FAILED, note: existing.note ? `${existing.note} (cancelled by trader)` : 'Cancelled by trader' },
    include: { job: { select: { id: true, jobRef: true, title: true } } },
  });

  let jobBalance: ReturnType<typeof buildJobPayoutBalance> | null = null;
  if (updated.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: updated.jobId },
      select: jobPayoutSelect,
    });
    if (job) jobBalance = buildJobPayoutBalance(job);
  }

  return serializeTraderPayout(updated, trader, jobBalance);
};
