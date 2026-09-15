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

export const discoverJobDetailQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid job ID.'),
  }),
  query: z.object({
    lat: z.string().optional(),
    lng: z.string().optional(),
  }),
});

const siteVisitTimeSlotEnum = z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'ANYTIME']);

const siteVisitSlotItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  timeSlot: siteVisitTimeSlotEnum,
});

/**
 * POST Request / Reschedule Site Visit.
 * Multi-slot Figma: prefer `slots: [{ date, timeSlot }, ...]`.
 * Legacy single: `{ date, timeSlot }` still accepted.
 */
export const siteVisitRequestBodySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid job ID.'),
  }),
  body: z
    .object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
        .optional(),
      timeSlot: siteVisitTimeSlotEnum.optional(),
      slots: z.array(siteVisitSlotItemSchema).min(1).max(20).optional(),
    })
    .superRefine((body, ctx) => {
      const hasSlots = Array.isArray(body.slots) && body.slots.length > 0;
      const hasSingle = Boolean(body.date && body.timeSlot);
      if (!hasSlots && !hasSingle) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide slots: [{ date, timeSlot }] or date + timeSlot.',
        });
      }
    }),
});
