import { z } from 'zod';

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
