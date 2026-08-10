import { z } from 'zod';

const mobileNumberSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{1,14}$/, 'Mobile number must be in E.164 format (e.g. +353871234567)');

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2, 'Name must be at least 2 characters long').optional(),
    mobileNumber: mobileNumberSchema.optional(),
    alternatePhone: mobileNumberSchema.optional().or(z.literal('').transform(() => undefined)),
    city: z.string().trim().min(1).optional(),
    country: z.string().trim().min(1).optional(),
    profilePhotoUrl: z.string().url('Profile photo must be a valid URL').optional(),
    preferredLanguage: z.string().trim().min(1).optional(),
    preferredTimeSlot: z.string().trim().min(1).optional(),
    emailNotifications: z.boolean().optional(),
    smsAlerts: z.boolean().optional(),
    promoNotifications: z.boolean().optional(),
  }),
});

export const deactivateAccountSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(3, 'Please provide a reason for account deactivation.'),
    additionalComments: z.string().trim().optional(),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>['body'];
