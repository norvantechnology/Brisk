import { z } from 'zod';

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .optional();

export const paymentHistoryQuerySchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
      filter: z
        .enum(['all', 'last_30_days', 'last_6_months', 'last_1_year', 'custom'])
        .optional()
        .default('all'),
      startDate: dateString,
      endDate: dateString,
    })
    .superRefine((q, ctx) => {
      if (q.filter === 'custom') {
        if (!q.startDate || !q.endDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'startDate and endDate (YYYY-MM-DD) are required when filter=custom.',
            path: ['startDate'],
          });
        }
      }
    }),
});

export type PaymentHistoryQuery = z.infer<typeof paymentHistoryQuerySchema>['query'];
