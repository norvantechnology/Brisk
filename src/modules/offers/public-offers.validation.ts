import { z } from 'zod';

const idQuery = z.union([z.string(), z.array(z.string())]).optional();

export const publicOfferFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    date_range: z.enum(['today', 'yesterday', 'last_7_days', 'last_30_days', 'custom']).optional(),
    dateRange: z.enum(['today', 'yesterday', 'last_7_days', 'last_30_days', 'custom']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    trader_ids: idQuery,
    trader_id: idQuery,
    traderId: idQuery,
    traderIds: idQuery,
    offer_type: z.enum(['percentage', 'flat_amount', 'free_visit']).optional(),
    offerType: z.enum(['percentage', 'flat_amount', 'free_visit', 'PERCENTAGE', 'FLAT', 'FREE_SERVICE']).optional(),
    discountType: z.string().optional(),
    category_id: idQuery,
    categoryId: idQuery,
    subcategory_id: idQuery,
    subcategoryId: idQuery,
  }),
});

export const offerIdParamSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Offer identifier or promo code is required'),
  }),
  body: z.object({
    code: z.string().trim().optional(),
    promoCode: z.string().trim().optional(),
  }).optional(),
});

export const claimPromoCodeSchema = z.object({
  body: z.object({
    code: z.string().trim().min(1, 'Promo code is required').max(64).optional(),
    promoCode: z.string().trim().min(1, 'Promo code is required').max(64).optional(),
  }).refine((data) => Boolean(data.code || data.promoCode), {
    message: 'Promo code is required (send "code" or "promoCode")',
    path: ['code'],
  }),
});

export const promoListSchema = z.object({
  query: z.object({
    categoryId: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
  }),
});

export const validatePromoSchema = z.object({
  body: z.object({
    code: z.string().trim().min(3).max(40),
    categoryId: z.string().uuid().optional(),
  }),
});
