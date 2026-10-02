import { z } from 'zod';

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
});

export const requireCustomRange = (
  q: { filter?: string; startDate?: string; endDate?: string },
  ctx: z.RefinementCtx
) => {
  if (q.filter === 'custom' && (!q.startDate || !q.endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startDate and endDate (YYYY-MM-DD) are required when filter=custom.',
      path: ['startDate'],
    });
  }
};

export const paymentHistoryQuerySchema = z.object({
  query: paymentListQueryBase.superRefine(requireCustomRange),
});

export type PaymentListFilters = z.infer<typeof paymentListQueryBase>;
export type PaymentHistoryQuery = z.infer<typeof paymentHistoryQuerySchema>['query'];
