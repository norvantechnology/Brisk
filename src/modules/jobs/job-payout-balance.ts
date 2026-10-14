import {
  InvoiceStatus,
  JobStatus,
  PayoutStatus,
  Prisma,
  TraderPaymentRequestStatus,
} from '@prisma/client';

const money = (v: Prisma.Decimal | number | null | undefined) => (v == null ? 0 : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

export type JobPayoutBalanceStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

/**
 * Amount owed to the trader after the customer has paid.
 * = PAID payment-request (serviceCharge + materials + siteVisitFee)
 * + PAID booking upfront invoice not tied to a payment request (serviceCharge − trader offer discount).
 * Platform fee + VAT are retained by Brisk / tax — not paid out to the trader.
 */
export const traderPayableFromPaidRequest = (r: {
  serviceCharge: Prisma.Decimal | number;
  materialsTotal: Prisma.Decimal | number;
  siteVisitFee: Prisma.Decimal | number;
}) => round2(money(r.serviceCharge) + money(r.materialsTotal) + money(r.siteVisitFee));

export const traderPayableFromUpfrontInvoice = (inv: {
  serviceCharge: Prisma.Decimal | number;
  traderOfferDiscount: Prisma.Decimal | number;
}) => round2(Math.max(0, money(inv.serviceCharge) - money(inv.traderOfferDiscount)));

export const jobPayoutBalanceStatus = (
  totalPayable: number,
  amountPaid: number
): JobPayoutBalanceStatus => {
  if (totalPayable <= 0) return 'UNPAID';
  if (amountPaid <= 0) return 'UNPAID';
  if (amountPaid + 0.001 >= totalPayable) return 'PAID';
  return 'PARTIALLY_PAID';
};

export type JobPayoutSource = {
  id: string;
  jobRef: string | null;
  title: string;
  status: JobStatus;
  updatedAt: Date;
  paymentRequests: {
    status: TraderPaymentRequestStatus;
    currencyCode: string;
    serviceCharge: Prisma.Decimal | number;
    materialsTotal: Prisma.Decimal | number;
    siteVisitFee: Prisma.Decimal | number;
  }[];
  booking: {
    invoice: {
      status: InvoiceStatus;
      paymentRequestId: string | null;
      currencyCode: string;
      serviceCharge: Prisma.Decimal | number;
      traderOfferDiscount: Prisma.Decimal | number;
    } | null;
  } | null;
  payouts: { amount: Prisma.Decimal | number; status: PayoutStatus }[];
};

export const buildJobPayoutBalance = (job: JobPayoutSource) => {
  let totalPayable = 0;
  let currencyCode = 'EUR';

  for (const r of job.paymentRequests) {
    if (r.status !== TraderPaymentRequestStatus.PAID) continue;
    totalPayable = round2(totalPayable + traderPayableFromPaidRequest(r));
    currencyCode = r.currencyCode || currencyCode;
  }

  const upfront = job.booking?.invoice;
  if (upfront && upfront.status === InvoiceStatus.PAID && !upfront.paymentRequestId) {
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

export type JobPayoutBalance = ReturnType<typeof buildJobPayoutBalance>;

/** Prisma select for building job-wise trader payout balances. */
export const jobPayoutSelect = {
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

/** Nested include fragment for list endpoints that already `include` other relations. */
export const jobPayoutListInclude = {
  paymentRequests: {
    select: {
      status: true,
      currencyCode: true,
      serviceCharge: true,
      materialsTotal: true,
      siteVisitFee: true,
    },
  },
  payouts: {
    select: { amount: true, status: true },
  },
} as const;

export const serializeJobPayoutBalance = (balance: JobPayoutBalance) => ({
  totalPayable: balance.totalPayable,
  amountPaid: balance.amountPaid,
  remainingBalance: balance.remainingBalance,
  payoutStatus: balance.payoutStatus,
  eligibleForPayout: balance.eligibleForPayout,
  currencyCode: balance.currencyCode,
});
