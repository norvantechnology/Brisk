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
      offerId: uuid.optional(),
      appliedTraderOfferId: uuid.optional(),
      claimId: uuid.optional(),
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

export const setJobLocationSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    addressId: uuid,
  }),
});

export const publishJobSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      addressId: uuid.optional(),
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
