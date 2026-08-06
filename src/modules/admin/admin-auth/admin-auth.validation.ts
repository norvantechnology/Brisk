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
