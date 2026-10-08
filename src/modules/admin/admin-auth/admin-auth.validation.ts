import { z } from 'zod';

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format.'),
    password: z.string().min(1, 'Password is required.'),
  }),
});

export const adminRefreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required.'),
  }),
});

const clearable = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.literal('').transform(() => null), z.null()]).optional();

export const updateAdminProfileSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(2, 'Name must be at least 2 characters long.').max(100).optional(),
      email: z.string().trim().email('Invalid email address format.').transform((v) => v.toLowerCase()).optional(),
      mobileNumber: clearable(
        z
          .string()
          .trim()
          .regex(/^\+[1-9]\d{1,14}$/, 'Mobile number must be in E.164 format (e.g. +353871234567).')
      ),
      address: clearable(z.string().trim().min(1).max(500)),
      profilePhotoUrl: clearable(z.string().trim().url('Profile photo must be a valid URL.')),
    })
    .refine((body) => Object.values(body).some((v) => v !== undefined), {
      message: 'Provide at least one field to update.',
    }),
});

export type UpdateAdminProfileInput = z.infer<typeof updateAdminProfileSchema>['body'];

export const changePasswordSchema = z.object({
  body: z
    .object({
      oldPassword: z.string().min(1, 'Old password is required.'),
      newPassword: z
        .string()
        .min(8, 'New password must be at least 8 characters long.')
        .regex(/[A-Z]/, 'New password must contain at least one uppercase letter.')
        .regex(/[\d\W]/, 'New password must contain at least one number or special character.'),
      confirmPassword: z.string().min(1, 'Confirm password is required.'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'New password and confirm password do not match.',
      path: ['confirmPassword'],
    }),
});
