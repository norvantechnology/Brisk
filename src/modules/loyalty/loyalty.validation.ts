import { z } from 'zod';

export const loyaltyOfferIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const redeemLoyaltyOfferBodySchema = z.object({
  body: z
    .object({
      offerId: z.string().uuid().optional(),
      id: z.string().uuid().optional(),
    })
    .refine((data) => data.offerId || data.id, {
      message: 'offerId or id is required in request body.',
    }),
});

export const claimLoyaltyOfferBodySchema = redeemLoyaltyOfferBodySchema;
