import { z } from 'zod';
import { TraderType } from '@prisma/client';

const mobileNumberSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{1,14}$/, 'Mobile number must be in E.164 format (e.g. +353871234567)');

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

/** Profile → Edit account (fullName, phone, photo). Email is locked. */
export const updateTraderAccountSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(2).max(255).optional(),
      mobileNumber: mobileNumberSchema.optional(),
      profilePhotoUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
      email: z.string().optional(),
    })
    .superRefine((body, ctx) => {
      if (body.email !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Email cannot be changed from the app. Contact support if you need to update it.',
          path: ['email'],
        });
      }
      if (!body.fullName && !body.mobileNumber && body.profilePhotoUrl === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide at least one of fullName, mobileNumber, or profilePhotoUrl.',
          path: ['fullName'],
        });
      }
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
export type UpdateTraderAccountInput = z.infer<typeof updateTraderAccountSchema>['body'];
export type UpdateTraderBankDetailsInput = z.infer<typeof updateTraderBankDetailsSchema>['body'];
