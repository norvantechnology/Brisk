import { InvoiceStatus, PaymentMethod, PaymentStatus, Prisma, TraderPaymentRequestStatus } from '@prisma/client';

const money = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));
const round2 = (n: number): number => Math.round(n * 100) / 100;

export const formatPaymentMethodLabel = (method: string | null | undefined): string | null => {
  if (!method) return null;
  const upper = method.toUpperCase().replace(/\s+/g, '_');
  switch (upper) {
    case 'KLARNA':
      return 'Klarna';
    case 'CARD':
      return 'Credit / Debit Card';
    case 'APPLE_PAY':
      return 'Apple Pay';
    case 'GOOGLE_PAY':
      return 'Google Pay';
    default:
      return method.charAt(0).toUpperCase() + method.slice(1).toLowerCase().replace(/_/g, ' ');
  }
};

export const isKlarnaMethod = (method: string | null | undefined): boolean => {
  if (!method) return false;
  return method.toUpperCase().trim() === 'KLARNA';
};

export interface FormattedPaymentItem {
  id: string;
  transactionRef: string | null;
  stripePaymentIntentId?: string | null;
  method: string | null;
  paymentMethod: string | null;
  paymentMethodLabel: string | null;
  isKlarna: boolean;
  amount: number;
  currencyCode: string;
  status: string;
  paidAt: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  createdAt?: string | null;
}

export interface JobPaymentDetails {
  paymentMethod: string | null;
  paymentMethodLabel: string | null;
  isKlarna: boolean;
  paymentStatus: string | null;
  paidAt: string | null;
  transactionRef: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  amountPaid: number;
  totalAmount: number;
  currencyCode: string;
  payments: FormattedPaymentItem[];
}

export type RawPaymentInput = {
  id?: string;
  transactionRef?: string | null;
  stripePaymentIntentId?: string | null;
  method?: PaymentMethod | string | null;
  paymentMethod?: PaymentMethod | string | null;
  amount?: Prisma.Decimal | number | null;
  currencyCode?: string | null;
  status?: PaymentStatus | string | null;
  paidAt?: Date | string | null;
  createdAt?: Date | string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
};

export type RawInvoiceInput = {
  id?: string;
  invoiceNumber?: string | null;
  status?: InvoiceStatus | string | null;
  totalAmount?: Prisma.Decimal | number | null;
  currencyCode?: string | null;
  payments?: RawPaymentInput[] | null;
};

export type RawPaymentRequestInput = {
  id?: string;
  type?: string | null;
  status?: TraderPaymentRequestStatus | string | null;
  title?: string | null;
  description?: string | null;
  totalAmount?: Prisma.Decimal | number | null;
  currencyCode?: string | null;
  paymentMethod?: PaymentMethod | string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  stripePaymentIntentId?: string | null;
  paidAt?: Date | string | null;
  createdAt?: Date | string | null;
  invoice?: RawInvoiceInput | null;
};

export type JobPaymentSource = {
  id?: string;
  serviceCharge?: Prisma.Decimal | number | null;
  booking?: {
    invoice?: RawInvoiceInput | null;
  } | null;
  paymentRequests?: RawPaymentRequestInput[] | null;
};

/**
 * Resolves complete payment details for any job, invoice, or request structure.
 * Consistently identifies Klarna, latest payment method, and formatted transactions.
 */
export const resolveJobPaymentDetails = (job: JobPaymentSource | null | undefined): JobPaymentDetails => {
  if (!job) {
    return {
      paymentMethod: null,
      paymentMethodLabel: null,
      isKlarna: false,
      paymentStatus: 'NOT_INVOICED',
      paidAt: null,
      transactionRef: null,
      cardBrand: null,
      cardLast4: null,
      amountPaid: 0,
      totalAmount: 0,
      currencyCode: 'EUR',
      payments: [],
    };
  }

  const formattedPayments: FormattedPaymentItem[] = [];
  const seenPaymentIds = new Set<string>();

  const addPayment = (p: RawPaymentInput) => {
    const rawId = p.id || p.transactionRef || p.stripePaymentIntentId || '';
    if (rawId && seenPaymentIds.has(rawId)) return;
    if (rawId) seenPaymentIds.add(rawId);

    const methodStr = (p.paymentMethod ?? p.method)?.toString() ?? null;
    const isKlarna = isKlarnaMethod(methodStr);
    const label = formatPaymentMethodLabel(methodStr);
    const paidAtStr = p.paidAt ? (typeof p.paidAt === 'string' ? p.paidAt : p.paidAt.toISOString()) : null;
    const createdAtStr = p.createdAt ? (typeof p.createdAt === 'string' ? p.createdAt : p.createdAt.toISOString()) : null;

    formattedPayments.push({
      id: p.id ?? rawId,
      transactionRef: p.transactionRef ?? null,
      stripePaymentIntentId: p.stripePaymentIntentId ?? null,
      method: methodStr,
      paymentMethod: methodStr,
      paymentMethodLabel: label,
      isKlarna,
      amount: money(p.amount),
      currencyCode: p.currencyCode || 'EUR',
      status: p.status?.toString() ?? 'COMPLETED',
      paidAt: paidAtStr,
      cardBrand: p.cardBrand ?? null,
      cardLast4: p.cardLast4 ?? null,
      createdAt: createdAtStr,
    });
  };

  // 1. Upfront / booking invoice payments
  const upfrontInvoice = job.booking?.invoice;
  if (upfrontInvoice?.payments && Array.isArray(upfrontInvoice.payments)) {
    for (const p of upfrontInvoice.payments) {
      addPayment({
        ...p,
        currencyCode: p.currencyCode || upfrontInvoice.currencyCode,
      });
    }
  }

  // 2. Payment requests invoices and requests themselves
  if (job.paymentRequests && Array.isArray(job.paymentRequests)) {
    for (const r of job.paymentRequests) {
      if (r.invoice?.payments && Array.isArray(r.invoice.payments)) {
        for (const p of r.invoice.payments) {
          addPayment({
            ...p,
            currencyCode: p.currencyCode || r.invoice.currencyCode || r.currencyCode,
          });
        }
      } else if (r.status === TraderPaymentRequestStatus.PAID || r.status === 'PAID') {
        // Fallback if payment request was marked paid without a nested payment record
        addPayment({
          id: r.id,
          transactionRef: r.stripePaymentIntentId ? `TXN-${r.id.slice(-6).toUpperCase()}` : null,
          stripePaymentIntentId: r.stripePaymentIntentId ?? null,
          method: r.paymentMethod,
          paymentMethod: r.paymentMethod,
          amount: r.totalAmount,
          currencyCode: r.currencyCode,
          status: 'COMPLETED',
          paidAt: r.paidAt,
          createdAt: r.createdAt,
          cardBrand: r.cardBrand ?? null,
          cardLast4: r.cardLast4 ?? null,
        });
      }
    }
  }

  // Sort payments newest first
  formattedPayments.sort((a, b) => {
    const timeA = a.paidAt ? new Date(a.paidAt).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.paidAt ? new Date(b.paidAt).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  const completedPayments = formattedPayments.filter(
    (p) => p.status === PaymentStatus.COMPLETED || p.status === 'COMPLETED' || p.status === 'PAID'
  );

  const amountPaid = round2(
    completedPayments.reduce((sum, p) => sum + p.amount, 0)
  );

  let totalAmount = 0;
  if (upfrontInvoice?.totalAmount != null) {
    totalAmount += money(upfrontInvoice.totalAmount);
  }
  if (job.paymentRequests && Array.isArray(job.paymentRequests)) {
    for (const r of job.paymentRequests) {
      if (r.status !== TraderPaymentRequestStatus.CANCELLED && r.status !== 'CANCELLED') {
        totalAmount += money(r.totalAmount);
      }
    }
  }
  if (totalAmount === 0 && job.serviceCharge != null) {
    totalAmount = money(job.serviceCharge);
  }
  totalAmount = round2(totalAmount);

  // Determine overall currency
  const currencyCode =
    completedPayments[0]?.currencyCode ||
    upfrontInvoice?.currencyCode ||
    job.paymentRequests?.[0]?.currencyCode ||
    'EUR';

  // Has Klarna been used at all on this job?
  const hasKlarna = formattedPayments.some((p) => p.isKlarna);

  // Latest payment info
  const primaryPayment = completedPayments[0] ?? formattedPayments[0] ?? null;
  const paymentMethod = primaryPayment?.paymentMethod ?? null;
  const paymentMethodLabel = primaryPayment?.paymentMethodLabel ?? null;
  const cardBrand = primaryPayment?.cardBrand ?? null;
  const cardLast4 = primaryPayment?.cardLast4 ?? null;
  const paidAt = primaryPayment?.paidAt ?? null;
  const transactionRef = primaryPayment?.transactionRef ?? null;

  // Derive payment status
  let paymentStatus: string = 'NOT_INVOICED';
  if (upfrontInvoice?.status) {
    paymentStatus = upfrontInvoice.status;
  }
  if (completedPayments.length > 0) {
    if (totalAmount > 0 && amountPaid + 0.001 >= totalAmount) {
      paymentStatus = 'PAID';
    } else if (amountPaid > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    } else {
      paymentStatus = 'PAID';
    }
  } else if (upfrontInvoice) {
    paymentStatus = upfrontInvoice.status ?? 'UNPAID';
  }

  return {
    paymentMethod,
    paymentMethodLabel,
    isKlarna: hasKlarna,
    paymentStatus,
    paidAt,
    transactionRef,
    cardBrand,
    cardLast4,
    amountPaid,
    totalAmount,
    currencyCode,
    payments: formattedPayments,
  };
};

/**
 * Standard include clause to ensure payments and invoice data are fetched for jobs
 */
export const jobPaymentIncludeClause = {
  booking: {
    select: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          currencyCode: true,
          payments: {
            orderBy: { createdAt: 'desc' as const },
            select: {
              id: true,
              transactionRef: true,
              stripePaymentIntentId: true,
              method: true,
              amount: true,
              currencyCode: true,
              status: true,
              paidAt: true,
              cardBrand: true,
              cardLast4: true,
              createdAt: true,
            },
          },
        },
      },
    },
  },
  paymentRequests: {
    select: {
      id: true,
      type: true,
      status: true,
      title: true,
      description: true,
      totalAmount: true,
      currencyCode: true,
      paymentMethod: true,
      cardBrand: true,
      cardLast4: true,
      stripePaymentIntentId: true,
      paidAt: true,
      createdAt: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          payments: {
            orderBy: { createdAt: 'desc' as const },
            select: {
              id: true,
              transactionRef: true,
              stripePaymentIntentId: true,
              method: true,
              amount: true,
              currencyCode: true,
              status: true,
              paidAt: true,
              cardBrand: true,
              cardLast4: true,
              createdAt: true,
            },
          },
        },
      },
    },
  },
} as const;
