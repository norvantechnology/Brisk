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
