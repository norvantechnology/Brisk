import { JobQuoteType, JobStatus } from '@prisma/client';
import { z } from 'zod';

const uuid = z.string().uuid();

const budgetFields = {
  quoteType: z.nativeEnum(JobQuoteType).optional(),
  minBudget: z.coerce.number().nonnegative().nullable().optional(),
  maxBudget: z.coerce.number().nonnegative().nullable().optional(),
  siteVisitRequested: z.boolean().optional(),
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

export type CreateJobInput = z.infer<typeof createJobSchema>['body'];
export type UpdateJobInput = z.infer<typeof updateJobSchema>['body'];
export type SetJobLocationInput = z.infer<typeof setJobLocationSchema>['body'];
export type PublishJobInput = z.infer<typeof publishJobSchema>['body'];
export type JobFormConfigQuery = z.infer<typeof jobFormConfigSchema>['query'];
export type PublishAddressObject = z.infer<typeof publishAddressObjectSchema>;
