import { z } from 'zod';

const jobIdParam = z.object({
  id: z.string().uuid('Invalid job ID.'),
});

export const myJobsListQuerySchema = z.object({
  query: z.object({
    tab: z.enum(['ACTIVE', 'COMPLETED', 'OTHER']).optional().default('ACTIVE'),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const myJobIdParamSchema = z.object({
  params: jobIdParam,
});

export const myJobQuoteBodySchema = z.object({
  params: jobIdParam,
  body: z.object({
    amount: z.number().positive('amount must be a positive number.'),
    notes: z.string().max(2000).optional(),
  }),
});

export const myJobAcceptBodySchema = z.object({
  params: jobIdParam,
  body: z
    .object({
      amount: z.number().positive().optional(),
    })
    .optional()
    .default({}),
});

export const myJobMaterialBodySchema = z.object({
  params: jobIdParam,
  body: z.object({
    name: z.string().min(1).max(200),
    detail: z.string().max(1000).optional(),
    price: z.number().nonnegative('price must be >= 0.'),
    photoUrl: z.string().url().optional(),
  }),
});

export const myJobMaterialIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid job ID.'),
    materialId: z.string().uuid('Invalid material ID.'),
  }),
});

export const myJobProofPhotoBodySchema = z.object({
  params: jobIdParam,
  body: z.object({
    photoUrl: z.string().url('photoUrl must be a valid URL.'),
  }),
});

/**
 * Job Progress → Submit & Next
 * One call: attach proof photo URL(s) + finish the job.
 */
export const myJobSubmitCompletionBodySchema = z.object({
  params: jobIdParam,
  body: z
    .object({
      photoUrl: z.string().url('photoUrl must be a valid URL.').optional(),
      photoUrls: z
        .array(z.string().url('Each photoUrl must be a valid URL.'))
        .min(1)
        .max(20)
        .optional(),
      /** false = Mark as Finished (full). true reserved / echoed for screen routing. */
      isPartPayment: z.boolean().optional().default(false),
    })
    .superRefine((body, ctx) => {
      const urls = [
        ...(body.photoUrls ?? []),
        ...(body.photoUrl ? [body.photoUrl] : []),
      ];
      if (urls.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide photoUrl or photoUrls (at least one work-proof image URL).',
          path: ['photoUrls'],
        });
      }
    }),
});

export const myJobMessageBodySchema = z.object({
  params: jobIdParam,
  body: z.object({
    message: z.string().min(1).max(4000),
  }),
});

export const myJobPartialPaymentBodySchema = z.object({
  params: jobIdParam,
  body: z.object({
    amount: z.number().positive('Installment amount must be greater than 0.'),
    description: z
      .string()
      .trim()
      .min(1, 'Description for this installment is required.')
      .max(2000),
    /** Optional work-proof image URL(s). Upload via POST /uploads first. */
    photoUrl: z.string().url('photoUrl must be a valid URL.').optional(),
    photoUrls: z
      .array(z.string().url('Each photoUrl must be a valid URL.'))
      .max(20)
      .optional(),
  }),
});

export const incomingJobIdParamSchema = z.object({
  params: jobIdParam,
});
