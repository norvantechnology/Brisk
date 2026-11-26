import { z } from 'zod';

export const updatePricingConfigSchema = z.object({
  body: z.object({
    platformFee: z
      .object({
        type: z.enum(['PERCENTAGE', 'FIXED']).optional(),
        percentage: z.coerce.number().min(0).max(100).optional(),
        fixedEur: z.coerce.number().min(0).optional(),
        fixedGbp: z.coerce.number().min(0).optional(),
      })
      .optional(),
    loyaltyPoints: z
      .object({
        pointsPerEur: z.coerce.number().int().min(0).optional(),
        pointsPerGbp: z.coerce.number().int().min(0).optional(),
      })
      .optional(),
    vatTax: z
      .object({
        traderStandardRate: z.coerce.number().min(0).max(100).optional(),
        traderTwoThirdsRate: z.coerce.number().min(0).max(100).optional(),
        platformFeeRate: z.coerce.number().min(0).max(100).optional(),
        ukStandardRate: z.coerce.number().min(0).max(100).optional(),
      })
      .optional(),
  }),
});

export type UpdatePricingConfigInput = z.infer<typeof updatePricingConfigSchema>['body'];

export const customPricingBodySchema = z.object({
  enabled: z.boolean(),
  type: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  percentage: z.coerce.number().min(0).max(100).nullable().optional(),
  fixedEur: z.coerce.number().min(0).nullable().optional(),
  fixedGbp: z.coerce.number().min(0).nullable().optional(),
});

export type CustomPricingBodyInput = z.infer<typeof customPricingBodySchema>;

export const updateCategoryPricingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Category ID format.'),
  }),
  body: customPricingBodySchema,
});

export const updateSubcategoryPricingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Subcategory ID format.'),
  }),
  body: customPricingBodySchema,
});

export const listCustomPricingQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().optional(),
    categoryId: z.string().uuid('Invalid Category ID format.').optional(),
    customOnly: z.coerce.boolean().optional(),
  }),
});

export type ListCustomPricingQueryInput = z.infer<typeof listCustomPricingQuerySchema>['query'];

