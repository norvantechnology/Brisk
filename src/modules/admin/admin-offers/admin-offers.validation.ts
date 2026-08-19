import { z } from 'zod';

export const offerFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    offerType: z.enum(['PLATFORM', 'TRADER']).optional(),
    status: z.enum(['ACTIVE', 'EXPIRED', 'DISABLED']).optional(),
    categoryId: z.string().optional(),
    subcategoryId: z.string().optional(),
    traderId: z.string().optional(),
    discountType: z.string().optional(),
    dateRange: z.enum(['today', 'yesterday', 'last_7_days', 'last_30_days', 'custom']).optional(),
    date_range: z.enum(['today', 'yesterday', 'last_7_days', 'last_30_days', 'custom']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    trader_ids: z.string().optional(),
    category_id: z.string().optional(),
  }),
});

export const offerIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const offerBodyBase = {
  title: z.string().trim().min(2).max(255),
  couponCode: z.string().trim().min(3).max(40).optional().nullable(),
  shortDescription: z.string().trim().max(300).optional().nullable(),
  fullDescription: z.string().trim().max(4000).optional().nullable(),
  bannerImageUrl: z.string().trim().url().optional().nullable(),
  badgeTag: z.string().trim().max(80).optional().nullable(),
  discountType: z.enum(['FLAT', 'PERCENTAGE', 'FREE_SERVICE']),
  discountValue: z.number().min(0),
  discountLabel: z.string().trim().max(80).optional().nullable(),
  validFrom: z.string().min(1),
  validUntil: z.string().min(1),
  categoryIds: z.array(z.string().uuid()).optional(),
  subcategoryIds: z.array(z.string().uuid()).optional(),
  traderId: z.string().uuid().optional().nullable(),
  ctaLabel: z.string().trim().max(40).optional().nullable(),
  ctaAction: z.enum(['CLAIM', 'BOOK_INSPECTION']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'EXPIRED']).optional(),
};

export const createOfferSchema = z.object({
  body: z
    .object(offerBodyBase)
    .superRefine((body, ctx) => {
      if (body.discountType === 'PERCENTAGE' && body.discountValue > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Percentage discount cannot exceed 100.',
          path: ['discountValue'],
        });
      }
    }),
});

export const updateOfferSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().trim().min(2).max(255).optional(),
    couponCode: z.string().trim().min(3).max(40).optional().nullable(),
    shortDescription: z.string().trim().max(300).optional().nullable(),
    fullDescription: z.string().trim().max(4000).optional().nullable(),
    bannerImageUrl: z.string().trim().url().optional().nullable(),
    badgeTag: z.string().trim().max(80).optional().nullable(),
    discountType: z.enum(['FLAT', 'PERCENTAGE', 'FREE_SERVICE']).optional(),
    discountValue: z.number().min(0).optional(),
    discountLabel: z.string().trim().max(80).optional().nullable(),
    validFrom: z.string().min(1).optional(),
    validUntil: z.string().min(1).optional(),
    categoryIds: z.array(z.string().uuid()).optional(),
    subcategoryIds: z.array(z.string().uuid()).optional(),
    traderId: z.string().uuid().optional().nullable(),
    ctaLabel: z.string().trim().max(40).optional().nullable(),
    ctaAction: z.enum(['CLAIM', 'BOOK_INSPECTION']).optional(),
    status: z.enum(['ACTIVE', 'DISABLED', 'EXPIRED']).optional(),
  }),
});

export const offerStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['ACTIVE', 'DISABLED', 'EXPIRED']),
  }),
});
