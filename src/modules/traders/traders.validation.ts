import { z } from 'zod';
import { TraderType } from '@prisma/client';

export const updateTraderProfileSchema = z.object({
  body: z.object({
    traderType: z.nativeEnum(TraderType).optional(),
    businessName: z.string().trim().min(1).optional(),
    bio: z.string().trim().max(2000).optional(),
    profilePhotoUrl: z.string().url().optional(),
    coverImageUrl: z.string().url().optional(),
    yearsExperience: z.number().int().min(0).max(80).optional(),
    serviceRadius: z.string().trim().min(1).optional(),
    categoryId: z.string().uuid().optional(),
  }),
});

export const updateTraderBankDetailsSchema = z.object({
  body: z.object({
    bankHolderName: z.string().trim().min(2).max(255),
    bankName: z.string().trim().min(2).max(255),
    accountNumber: z.string().trim().min(4).max(34),
    ifscCode: z.string().trim().min(4).max(20),
  }),
});

export type UpdateTraderProfileInput = z.infer<typeof updateTraderProfileSchema>['body'];
export type UpdateTraderBankDetailsInput = z.infer<typeof updateTraderBankDetailsSchema>['body'];
