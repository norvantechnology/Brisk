import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');

export const siteVisitListQuery = {
  status: z
    .enum(['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUIRED', 'COMPLETED', 'CANCELLED', 'CLOSED'])
    .optional(),
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().uuid('Invalid category ID format.').optional(),
  /** Visit date range (YYYY-MM-DD). */
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  sortBy: z.enum(['requestedAt', 'visitDate', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

export const adminTraderSiteVisitsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  query: z.object({
    ...siteVisitListQuery,
    group: z.enum(['REQUESTED', 'VISITED', 'CLOSED']).optional(),
  }),
});

export const traderSiteVisitsSchema = z.object({
  query: z.object({
    ...siteVisitListQuery,
    tab: z.enum(['REQUESTED', 'VISITED']).default('REQUESTED'),
  }),
});
