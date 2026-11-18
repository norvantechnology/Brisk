import {
  InvoiceStatus,
  JobStatus,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  QuoteStatus,
  TraderPaymentRequestStatus,
} from '@prisma/client';

const money = (v: Prisma.Decimal | number | null | undefined) => (v == null ? 0 : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

export type JobPayoutBalanceStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

/**
 * Amount owed to the trader after the customer has paid (per Irish Disclosed Agent rules):
 * Trader Payout = Trader Net + Trader VAT.
 * Brisk absorbs card processing and keeps only Platform Fee + Platform Fee VAT.
 * Trader remits their own VAT on their Revenue VAT3 return.
 */
export const traderPayableFromPaidRequest = (r: {
  serviceCharge: Prisma.Decimal | number;
  materialsTotal: Prisma.Decimal | number;
  siteVisitFee: Prisma.Decimal | number;
  vatAmount?: Prisma.Decimal | number | null;
  platformFeeVat?: Prisma.Decimal | number | null;
}) => {
  const net = money(r.serviceCharge) + money(r.materialsTotal) + money(r.siteVisitFee);
  const traderVat = Math.max(0, money(r.vatAmount) - money(r.platformFeeVat));
  return round2(net + traderVat);
};

export const traderPayableFromUpfrontInvoice = (inv: {
  serviceCharge: Prisma.Decimal | number;
  traderOfferDiscount: Prisma.Decimal | number;
  traderVatAmount?: Prisma.Decimal | number | null;
  platformFeeVat?: Prisma.Decimal | number | null;
  tax?: Prisma.Decimal | number | null;
}) => {
  const net = Math.max(0, money(inv.serviceCharge) - money(inv.traderOfferDiscount));
  const traderVat =
    inv.traderVatAmount != null
      ? money(inv.traderVatAmount)
      : Math.max(0, money(inv.tax) - money(inv.platformFeeVat));
  return round2(net + traderVat);
};

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
  serviceCharge?: Prisma.Decimal | number | null;
  traderId?: string | null;
  quotes?: {
    traderId?: string | null;
    quotedAmount: Prisma.Decimal | number;
    currencyCode?: string | null;
    status: QuoteStatus | string;
  }[] | null;
  paymentRequests?: {
    status: TraderPaymentRequestStatus | string;
    currencyCode: string;
    serviceCharge: Prisma.Decimal | number;
    materialsTotal: Prisma.Decimal | number;
    siteVisitFee: Prisma.Decimal | number;
    vatAmount?: Prisma.Decimal | number | null;
    platformFeeVat?: Prisma.Decimal | number | null;
    invoice?: {
      status?: InvoiceStatus | string | null;
      payments?: { status?: PaymentStatus | string | null; amount?: Prisma.Decimal | number | null }[] | null;
    } | null;
  }[] | null;
  booking?: {
    invoice?: {
      status: InvoiceStatus | string;
      paymentRequestId: string | null;
      currencyCode: string;
      serviceCharge: Prisma.Decimal | number;
      traderOfferDiscount: Prisma.Decimal | number;
      traderVatAmount?: Prisma.Decimal | number | null;
      platformFeeVat?: Prisma.Decimal | number | null;
      tax?: Prisma.Decimal | number | null;
      payments?: { status?: PaymentStatus | string | null; amount?: Prisma.Decimal | number | null }[] | null;
    } | null;
  } | null;
  payouts: { amount: Prisma.Decimal | number; status: PayoutStatus | string }[];
};

export const buildJobPayoutBalance = (job: JobPayoutSource) => {
  let totalPayable = 0;
  let currencyCode = 'EUR';

  // 1. Paid payment requests (request status PAID, or invoice status PAID, or completed payment records)
  let paidRequestsTotal = 0;
  for (const r of job.paymentRequests || []) {
    const isPaid =
      r.status === TraderPaymentRequestStatus.PAID ||
      (r as any).status === 'PAID' ||
      (r as any).invoice?.status === InvoiceStatus.PAID ||
      (r as any).invoice?.status === 'PAID' ||
      Boolean(
        (r as any).invoice?.payments?.some(
          (p: any) =>
            p.status === PaymentStatus.COMPLETED ||
            p.status === 'COMPLETED' ||
            p.status === 'PAID'
        )
      );

    if (isPaid) {
      paidRequestsTotal = round2(paidRequestsTotal + traderPayableFromPaidRequest(r));
      currencyCode = r.currencyCode || currencyCode;
    }
  }

  // 2. Upfront booking invoice (invoice status PAID or completed payment records)
  let upfrontPaidTotal = 0;
  const upfront = job.booking?.invoice;
  const isUpfrontPaid =
    Boolean(upfront) &&
    !upfront?.paymentRequestId &&
    (upfront?.status === InvoiceStatus.PAID ||
      (upfront as any)?.status === 'PAID' ||
      Boolean(
        (upfront as any)?.payments?.some(
          (p: any) =>
            p.status === PaymentStatus.COMPLETED ||
            p.status === 'COMPLETED' ||
            p.status === 'PAID'
        )
      ));

  if (isUpfrontPaid && upfront) {
    upfrontPaidTotal = round2(upfrontPaidTotal + traderPayableFromUpfrontInvoice(upfront));
    currencyCode = upfront.currencyCode || currencyCode;
  }

  totalPayable = round2(paidRequestsTotal + upfrontPaidTotal);

  // 3. Fallback when totalPayable <= 0: derive the actual amount payable to the trader
  if (totalPayable <= 0) {
    let pendingRequestsTotal = 0;
    for (const r of job.paymentRequests || []) {
      if (
        r.status !== TraderPaymentRequestStatus.CANCELLED &&
        (r as any).status !== 'CANCELLED'
      ) {
        pendingRequestsTotal = round2(pendingRequestsTotal + traderPayableFromPaidRequest(r));
        currencyCode = r.currencyCode || currencyCode;
      }
    }

    if (pendingRequestsTotal > 0) {
      totalPayable = pendingRequestsTotal;
    } else if (upfront && !upfront.paymentRequestId) {
      totalPayable = round2(traderPayableFromUpfrontInvoice(upfront));
      currencyCode = upfront.currencyCode || currencyCode;
    } else {
      const quotes = job.quotes || [];
      const acceptedQuote = quotes.find(
        (q) => q.status === QuoteStatus.ACCEPTED || (q as any).status === 'ACCEPTED'
      );
      if (acceptedQuote && money(acceptedQuote.quotedAmount) > 0) {
        totalPayable = round2(money(acceptedQuote.quotedAmount));
        currencyCode = acceptedQuote.currencyCode || currencyCode;
      } else {
        const traderId = job.traderId;
        const traderQuote = traderId ? quotes.find((q) => q.traderId === traderId) : null;
        if (traderQuote && money(traderQuote.quotedAmount) > 0) {
          totalPayable = round2(money(traderQuote.quotedAmount));
          currencyCode = traderQuote.currencyCode || currencyCode;
        } else if (job.serviceCharge != null && money(job.serviceCharge) > 0) {
          totalPayable = round2(money(job.serviceCharge));
        }
      }
    }
  }

  const amountPaid = round2(
    job.payouts
      .filter((p) => p.status === PayoutStatus.COMPLETED || (p as any).status === 'COMPLETED')
      .reduce((s, p) => s + money(p.amount), 0)
  );
  /** Open trader requests / in-flight payouts — reserves balance until completed or failed. */
  const pendingRequestAmount = round2(
    job.payouts
      .filter(
        (p) =>
          p.status === PayoutStatus.PENDING ||
          (p as any).status === 'PENDING' ||
          p.status === PayoutStatus.PROCESSING ||
          (p as any).status === 'PROCESSING'
      )
      .reduce((s, p) => s + money(p.amount), 0)
  );
  const remainingBalance = round2(Math.max(0, totalPayable - amountPaid));
  const availableToRequest = round2(Math.max(0, remainingBalance - pendingRequestAmount));
  const payoutStatus = jobPayoutBalanceStatus(totalPayable, amountPaid);
  const eligibleForPayout = totalPayable > 0 && availableToRequest > 0;

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
    /** totalPayable − amountPaid (still owed to trader before open requests). */
    remainingBalance,
    /** Sum of PENDING + PROCESSING payout rows for this job. */
    pendingRequestAmount,
    /** remainingBalance − pendingRequestAmount — max the trader/admin can request/record now. */
    availableToRequest,
    /** Job-level vs completed payouts: UNPAID | PARTIALLY_PAID | PAID */
    payoutStatus,
    /** true when customer has paid and availableToRequest > 0. */
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
  serviceCharge: true,
  traderId: true,
  updatedAt: true,
  quotes: {
    select: {
      traderId: true,
      quotedAmount: true,
      currencyCode: true,
      status: true,
    },
  },
  paymentRequests: {
    select: {
      status: true,
      currencyCode: true,
      serviceCharge: true,
      materialsTotal: true,
      siteVisitFee: true,
      vatAmount: true,
      platformFeeVat: true,
      invoice: {
        select: {
          status: true,
          payments: {
            select: { status: true, amount: true },
          },
        },
      },
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
          traderVatAmount: true,
          platformFeeVat: true,
          tax: true,
          payments: {
            select: { status: true, amount: true },
          },
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
      vatAmount: true,
      platformFeeVat: true,
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
  pendingRequestAmount: balance.pendingRequestAmount,
  availableToRequest: balance.availableToRequest,
  payoutStatus: balance.payoutStatus,
  eligibleForPayout: balance.eligibleForPayout,
  currencyCode: balance.currencyCode,
});
