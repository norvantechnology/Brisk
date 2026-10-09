import { z } from 'zod';
import { sortByParam, sortOrderParam } from '../../../utils/list-sort';
import { minLteMax } from '../../../utils/list-filters';

const loyaltyStatusSchema = z.enum(['active', 'inactive']);

export const loyaltyOfferIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const ADMIN_LOYALTY_OFFER_SORT_FIELDS = [
  'title',
  'pointsRequired',
  'status',
  'redemptionsCount',
  'createdAt',
  'updatedAt',
] as const;

export const listLoyaltyOffersSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(100).optional().default(20),
      search: z.string().optional(),
      status: loyaltyStatusSchema.optional(),
      minPoints: z.coerce.number().int().min(0).optional(),
      maxPoints: z.coerce.number().int().min(0).optional(),
      sortBy: sortByParam(ADMIN_LOYALTY_OFFER_SORT_FIELDS),
      sortOrder: sortOrderParam,
    })
    .superRefine(minLteMax('minPoints', 'maxPoints')),
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
