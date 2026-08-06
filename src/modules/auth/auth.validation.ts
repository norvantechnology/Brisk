import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one number or special character');

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters long'),
  email: z.string().trim().email('Invalid email format').toLowerCase(),
  mobileNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, 'Mobile number must be in E.164 format (e.g. +353871234567)'),
  password: passwordSchema,
  role: z.enum(['CUSTOMER', 'TRADER'], {
    errorMap: () => ({ message: "Role must be either 'CUSTOMER' or 'TRADER'" }),
  }),
});

export const verifyOtpSchema = z.object({
  mobileNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, 'Mobile number must be in E.164 format (e.g. +353871234567)'),
  code: z.string().length(6, 'Verification code must be exactly 6 characters long'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email format').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
