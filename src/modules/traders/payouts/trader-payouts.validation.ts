import { PayoutStatus } from '@prisma/client';
import { z } from 'zod';

export const stripeOnboardingLinkSchema = z.object({
  body: z
    .object({
      /** Where Stripe sends the trader after onboarding (falls back to STRIPE_CONNECT_RETURN_URL). */
      returnUrl: z.string().trim().url().optional(),
      /** Where Stripe sends the trader if the link expires (falls back to STRIPE_CONNECT_REFRESH_URL). */
      refreshUrl: z.string().trim().url().optional(),
    })
    .optional()
    .default({}),
});

export type StripeOnboardingLinkInput = z.infer<typeof stripeOnboardingLinkSchema>['body'];

const pageQuery = {
  page: z.string().optional(),
  limit: z.string().optional(),
};

export const traderPayoutJobsQuerySchema = z.object({
  query: z.object({
    ...pageQuery,
    search: z.string().trim().max(100).optional(),
    payoutStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
    eligibleOnly: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    sortBy: z
      .enum([
        'updatedAt',
        'jobRef',
        'title',
        'totalPayable',
        'amountPaid',
        'remainingBalance',
        'availableToRequest',
        'payoutStatus',
      ])
      .optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export type TraderPayoutJobsQuery = z.infer<typeof traderPayoutJobsQuerySchema>['query'];

export const traderJobPayoutSummarySchema = z.object({
  params: z.object({
    jobId: z.string().uuid('Invalid job ID format.'),
  }),
});

export const traderPayoutsListQuerySchema = z.object({
  query: z.object({
    ...pageQuery,
    status: z.nativeEnum(PayoutStatus).optional(),
    jobId: z.string().uuid('Invalid job ID format.').optional(),
  }),
});

export type TraderPayoutsListQuery = z.infer<typeof traderPayoutsListQuerySchema>['query'];

export const createPayoutRequestSchema = z.object({
  body: z.object({
    jobId: z.string().uuid('Invalid job ID format.'),
    /** Full remaining or any partial amount ≤ availableToRequest. */
    amount: z.coerce.number().positive('Amount must be greater than 0.').multipleOf(0.01),
    currencyCode: z.string().trim().length(3).toUpperCase().optional(),
    note: z.string().trim().max(500).optional(),
  }),
});

export type CreatePayoutRequestInput = z.infer<typeof createPayoutRequestSchema>['body'];

export const payoutIdParamSchema = z.object({
  params: z.object({
    payoutId: z.string().uuid('Invalid payout ID format.'),
  }),
});
