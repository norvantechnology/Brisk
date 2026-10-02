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
