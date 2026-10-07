import { JobQuoteType, JobStatus } from '@prisma/client';
import { z } from 'zod';

const uuid = z.string().uuid();

/** Accept true/false, "true"/"false", 1/0 — mobile often sends strings. */
const coerceOptionalBool = z.preprocess((v) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(s)) return true;
    if (['false', '0', 'no'].includes(s)) return false;
  }
  return v;
}, z.boolean().optional());

const budgetFields = {
  quoteType: z.nativeEnum(JobQuoteType).optional(),
  minBudget: z.coerce.number().nonnegative().nullable().optional(),
  maxBudget: z.coerce.number().nonnegative().nullable().optional(),
  /** Preferred flag when Site Visit card selected. */
  siteVisitRequested: coerceOptionalBool,
  /** Aliases — same meaning as siteVisitRequested (mobile naming variants). */
  siteVisit: coerceOptionalBool,
  isSiteVisit: coerceOptionalBool,
};

const refineBudget = (
  data: {
    quoteType?: JobQuoteType;
    minBudget?: number | null;
    maxBudget?: number | null;
    serviceCharge?: number | null;
  },
  ctx: z.RefinementCtx
) => {
  if (
    data.minBudget != null &&
    data.maxBudget != null &&
    data.maxBudget < data.minBudget
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'maxBudget must be greater than or equal to minBudget.',
      path: ['maxBudget'],
    });
  }
};

export const jobFormConfigSchema = z.object({
  query: z.object({
    categoryId: uuid.optional(),
    subcategoryId: uuid.optional(),
    offerId: uuid.optional(),
    entryPoint: z
      .enum(['OFFER', 'HOME_CATEGORY', 'HOME_SUBCATEGORY', 'DIRECT', 'TRADER_PROFILE'])
      .optional(),
  }),
});

export const createJobSchema = z.object({
  body: z
    .object({
      categoryId: uuid,
      subcategoryId: uuid.nullable().optional(),
      title: z.string().trim().min(1).optional(),
      description: z.string().trim().min(1, 'Description is required.'),
      scheduledDate: z.coerce.date().optional(),
      timeSlot: z.string().trim().optional(),
      durationLabel: z.string().trim().optional(),
      phoneNumber: z.string().trim().optional(),
      photoUrls: z.array(z.string().url()).optional(),
      qaFormAnswers: z.record(z.unknown()).optional(),
      offerId: uuid.nullable().optional(),
      appliedTraderOfferId: uuid.nullable().optional(),
      claimId: uuid.nullable().optional(),
      traderId: uuid.nullable().optional(),
      serviceCharge: z.coerce.number().nonnegative().optional(),
      ...budgetFields,
    })
    .superRefine(refineBudget),
});

export const listJobsSchema = z.object({
  query: z.object({
    status: z.nativeEnum(JobStatus).optional(),
  }),
});

export const myJobsTabQuerySchema = z.object({
  query: z.object({
    tab: z.string().trim().toUpperCase().pipe(z.enum(['ACTIVE', 'COMPLETED', 'OTHER'])).optional().default('ACTIVE'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const jobIdParamSchema = z.object({
  params: z.object({ id: uuid }),
});

export const updateJobSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      categoryId: uuid.optional(),
      subcategoryId: uuid.nullable().optional(),
      title: z.string().trim().min(1).optional(),
      description: z.string().trim().min(1).optional(),
      scheduledDate: z.coerce.date().nullable().optional(),
      timeSlot: z.string().trim().nullable().optional(),
      durationLabel: z.string().trim().nullable().optional(),
      phoneNumber: z.string().trim().nullable().optional(),
      photoUrls: z.array(z.string().url()).optional(),
      qaFormAnswers: z.record(z.unknown()).nullable().optional(),
      serviceCharge: z.coerce.number().nonnegative().nullable().optional(),
      traderId: uuid.nullable().optional(),
      ...budgetFields,
    })
    .superRefine(refineBudget),
});

const publishAddressObjectSchema = z.object({
  /** When selecting a saved place, pass its id here (or top-level addressId). */
  id: uuid.optional(),
  addressId: uuid.optional(),
  addressType: z.enum(['Home', 'Work', 'Custom']).optional(),
  label: z.string().trim().min(1).optional(),
  houseNumber: z.string().trim().optional(),
  addressLine1: z.string().trim().min(1, 'Street address is required.'),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1, 'City is required.'),
  county: z.string().trim().optional(),
  eircode: z.string().trim().optional(),
  country: z.string().trim().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  mapImageUrl: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
  isDefault: z.boolean().optional(),
});

export const setJobLocationSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      addressId: uuid.optional(),
      /** Inline searched location — backend creates a saved address when addressId is missing. */
      address: publishAddressObjectSchema.optional(),
      /** Alias of `address` (mobile map search). */
      location: publishAddressObjectSchema.optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.addressId && !data.address && !data.location) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide addressId or address/location object.',
          path: ['addressId'],
        });
      }
    }),
});

export const publishJobSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      /** Existing saved address (GET /addresses). */
      addressId: uuid.optional(),
      /** Searched/new location — created as a customer address when addressId is omitted. */
      address: publishAddressObjectSchema.optional(),
      /** Alias of `address` for map-search payloads. */
      location: publishAddressObjectSchema.optional(),
      serviceCharge: z.coerce.number().nonnegative().optional(),
    })
    .optional()
    .default({}),
});

export const acceptJobQuoteSchema = z.object({
  params: z.object({
    id: uuid,
    quoteId: uuid,
  }),
});

export const siteVisitProposalParamSchema = z.object({
  params: z.object({
    id: uuid,
    requestId: uuid,
  }),
});

export const jobQuoteDetailSchema = z.object({
  params: z.object({ id: uuid, quoteId: uuid }),
  query: z.object({
    reviewsLimit: z.coerce.number().int().min(1).max(50).optional().default(10),
  }),
});

export const cancelJobSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({ reason: z.string().trim().max(1000).optional() })
    .optional()
    .default({}),
});

export const rescheduleJobSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD.'),
    timeSlot: z.string().trim().min(1, 'timeSlot is required.').max(50),
    serviceCategoryId: uuid.optional(),
    serviceSubcategoryId: uuid.nullable().optional(),
  }),
});

export const jobReviewSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    /** Ignored — the reviewed trader is always the job's booked trader. */
    traderId: uuid.optional(),
    rating: z.coerce.number().int('rating must be a whole number from 1 to 5.').min(1).max(5),
    review: z.string().trim().max(2000).optional(),
  }),
});

export const DISPUTE_REASONS = [
  'Poor Quality of Work',
  'Incomplete Job',
  'Overcharging',
  'No-show / Delay',
  'Other',
] as const;

/** "Upload up to 5 photos" on the Report an Issue screen. */
export const DISPUTE_MAX_EVIDENCE_PHOTOS = 5;

export const createJobDisputeSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    reason: z.enum(DISPUTE_REASONS),
    description: z.string().trim().min(1, 'Please describe the issue.').max(5000),
    evidenceUrls: z
      .array(z.string().url())
      .max(DISPUTE_MAX_EVIDENCE_PHOTOS, `Upload up to ${DISPUTE_MAX_EVIDENCE_PHOTOS} photos.`)
      .optional(),
  }),
});

export type RescheduleJobInput = z.infer<typeof rescheduleJobSchema>['body'];
export type JobReviewInput = z.infer<typeof jobReviewSchema>['body'];
export type CreateJobDisputeInput = z.infer<typeof createJobDisputeSchema>['body'];
export type CreateJobInput = z.infer<typeof createJobSchema>['body'];
export type UpdateJobInput = z.infer<typeof updateJobSchema>['body'];
export type SetJobLocationInput = z.infer<typeof setJobLocationSchema>['body'];
export type PublishJobInput = z.infer<typeof publishJobSchema>['body'];
export type JobFormConfigQuery = z.infer<typeof jobFormConfigSchema>['query'];
export type PublishAddressObject = z.infer<typeof publishAddressObjectSchema>;
