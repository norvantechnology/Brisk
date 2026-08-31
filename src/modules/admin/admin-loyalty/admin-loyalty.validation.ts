import { z } from 'zod';

const loyaltyStatusSchema = z.enum(['active', 'inactive']);

export const loyaltyOfferIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const listLoyaltyOffersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().optional(),
    status: loyaltyStatusSchema.optional(),
  }),
});

export const createLoyaltyOfferSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    pointsRequired: z.number().int().min(1),
    description: z.string().optional(),
    imageUrl: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
    status: loyaltyStatusSchema.optional().default('active'),
  }),
});

export const updateLoyaltyOfferSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      title: z.string().min(1).optional(),
      pointsRequired: z.number().int().min(1).optional(),
      description: z.string().optional(),
      imageUrl: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
      status: loyaltyStatusSchema.optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required.',
    }),
});
