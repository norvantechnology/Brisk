import { z } from 'zod';
import { paymentListQueryBase, requireCustomRange } from '../payments/trader-payments.validation';

const isValidTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const earningsDashboardQuerySchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'limit must be a positive integer')
      .optional(),
    timezone: z
      .string()
      .trim()
      .refine(isValidTimeZone, 'timezone must be a valid IANA zone, e.g. Europe/Dublin')
      .optional(),
  }),
});

export type EarningsDashboardQuery = z.infer<typeof earningsDashboardQuerySchema>['query'];

export const paymentTransactionsQuerySchema = z.object({
  query: paymentListQueryBase
    .extend({
      timezone: z
        .string()
        .trim()
        .refine(isValidTimeZone, 'timezone must be a valid IANA zone, e.g. Europe/Dublin')
        .optional(),
    })
    .superRefine(requireCustomRange),
});

export type PaymentTransactionsQuery = z.infer<typeof paymentTransactionsQuerySchema>['query'];
