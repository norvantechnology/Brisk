import { z } from 'zod';

const dateOrDay = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .optional();

export const discoverJobsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    /** Radius in km (default: trader serviceRadiusKm or 10) */
    radiusKm: z.string().optional(),
    /** Optional override of trader service center */
    lat: z.string().optional(),
    lng: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    /** When true, only site-visit jobs */
    siteVisit: z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .transform((v) => v === 'true' || v === '1'),
    /** When true, only jobs scheduled within the next 48 hours */
    urgent: z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .transform((v) => v === 'true' || v === '1'),
    search: z.string().optional(),
    from: dateOrDay,
    to: dateOrDay,
  }),
});

export const discoverJobIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid job ID.'),
  }),
});
