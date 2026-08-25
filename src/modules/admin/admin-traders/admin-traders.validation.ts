import { z } from 'zod';
import { VerificationStatus } from '@prisma/client';

const traderAccountStatus = z.enum(['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED']);
const traderType = z.enum(['SOLO', 'COMPANY']);
const verificationStatus = z.nativeEnum(VerificationStatus);

export const traderFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    status: traderAccountStatus.optional(),
    categoryId: z.string().uuid('Invalid categoryId.').optional(),
    verification: verificationStatus.optional(),
    country: z.string().optional(),
  }),
});

export const traderIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
});

export const createTraderSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2, 'Full name is required.'),
    email: z.string().trim().email('Invalid email.'),
    mobileNumber: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{1,14}$/, 'Mobile must be E.164 (e.g. +353871234567).'),
    traderType: traderType.optional().default('SOLO'),
    businessName: z.string().trim().max(255).optional(),
    fullLegalName: z.string().trim().max(255).optional(),
    country: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    status: traderAccountStatus.optional().default('ACTIVE'),
    verificationStatus: verificationStatus.optional().default(VerificationStatus.PENDING),
    categoryIds: z.array(z.string().uuid()).optional().default([]),
    profilePhotoUrl: z.string().url().optional(),
    yearsExperience: z.number().int().min(0).max(80).optional(),
    bio: z.string().max(5000).optional(),
  }),
});

export const updateTraderSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  body: z
    .object({
      fullName: z.string().trim().min(2).optional(),
      email: z.string().trim().email().optional(),
      mobileNumber: z
        .string()
        .trim()
        .regex(/^\+[1-9]\d{1,14}$/, 'Mobile must be E.164 (e.g. +353871234567).')
        .optional(),
      traderType: traderType.optional(),
      businessName: z.string().trim().max(255).nullable().optional(),
      fullLegalName: z.string().trim().max(255).nullable().optional(),
      country: z.string().trim().max(100).nullable().optional(),
      city: z.string().trim().max(100).nullable().optional(),
      addressLine1: z.string().trim().max(255).nullable().optional(),
      addressLine2: z.string().trim().max(255).nullable().optional(),
      postcode: z.string().trim().max(32).nullable().optional(),
      status: traderAccountStatus.optional(),
      verificationStatus: verificationStatus.optional(),
      categoryIds: z.array(z.string().uuid()).optional(),
      profilePhotoUrl: z.string().url().nullable().optional(),
      yearsExperience: z.number().int().min(0).max(80).optional(),
      bio: z.string().max(5000).nullable().optional(),
      serviceRadiusKm: z.number().int().min(0).max(500).nullable().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required.',
    }),
});

export const updateTraderStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  body: z.object({
    status: traderAccountStatus,
  }),
});

export const updateTraderVerificationSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  body: z
    .object({
      verificationStatus: verificationStatus,
      rejectionReason: z.string().trim().max(2000).optional(),
    })
    .superRefine((body, ctx) => {
      if (body.verificationStatus === VerificationStatus.REJECTED && !body.rejectionReason?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'rejectionReason is required when verificationStatus is REJECTED.',
          path: ['rejectionReason'],
        });
      }
    }),
});
