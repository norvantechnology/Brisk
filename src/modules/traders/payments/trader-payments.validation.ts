import { z } from 'zod';
import { TraderPaymentRequestType } from '@prisma/client';
import { amountParam } from '../../../utils/list-filters';
import { sortByParam, sortOrderParam } from '../../../utils/list-sort';

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .optional();

/** Shared list filters: All / Last 30 Days / Last 6 Months / 1 Year / Custom range + search. */
export const paymentListQueryBase = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  filter: z
    .enum(['all', 'last_30_days', 'last_6_months', 'last_1_year', 'custom'])
    .optional()
    .default('all'),
  startDate: dateString,
  endDate: dateString,
  /** Displayed status: PENDING covers requests not yet paid (PENDING + SENT). */
  status: z.enum(['PAID', 'PENDING']).optional(),
  type: z.nativeEnum(TraderPaymentRequestType).optional(),
  minAmount: amountParam,
  maxAmount: amountParam,
  sortOrder: sortOrderParam,
});

export const requireCustomRange = (
  q: { filter?: string; startDate?: string; endDate?: string; minAmount?: number; maxAmount?: number },
  ctx: z.RefinementCtx
) => {
  if (q.filter === 'custom' && (!q.startDate || !q.endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startDate and endDate (YYYY-MM-DD) are required when filter=custom.',
      path: ['startDate'],
    });
  }
  if (q.minAmount !== undefined && q.maxAmount !== undefined && q.minAmount > q.maxAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'minAmount cannot be greater than maxAmount.',
      path: ['minAmount'],
    });
  }
};

export const PAYMENT_HISTORY_SORT_FIELDS = [
  'paymentDate',
  'createdAt',
  'updatedAt',
  'totalAmount',
  'status',
  'type',
  'jobCode',
  'jobTitle',
  'customerName',
] as const;

export const paymentHistoryQuerySchema = z.object({
  query: paymentListQueryBase
    .extend({ sortBy: sortByParam(PAYMENT_HISTORY_SORT_FIELDS) })
    .superRefine(requireCustomRange),
});

export type PaymentListFilters = z.infer<typeof paymentListQueryBase> & { sortBy?: string };
export type PaymentHistoryQuery = z.infer<typeof paymentHistoryQuerySchema>['query'];
