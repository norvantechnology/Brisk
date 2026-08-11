import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one number or special character');

const mobileNumberSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{1,14}$/, 'Mobile number must be in E.164 format (e.g. +353871234567)');

const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Verification code must be exactly 6 digits');

const registerBodySchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters long'),
  email: z.string().trim().email('Invalid email format').toLowerCase(),
  mobileNumber: mobileNumberSchema,
  password: passwordSchema,
  role: z.enum(['CUSTOMER', 'TRADER'], {
    errorMap: () => ({ message: "Role must be either 'CUSTOMER' or 'TRADER'" }),
  }),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms & Privacy Policy.' }),
  }),
});

export const registerSchema = z.object({
  body: registerBodySchema,
});

const verifyOtpBodySchema = z.object({
  mobileNumber: mobileNumberSchema,
  code: otpCodeSchema,
});

export const verifyOtpSchema = z.object({
  body: verifyOtpBodySchema,
});

const resendOtpBodySchema = z.object({
  mobileNumber: mobileNumberSchema,
});

export const resendOtpSchema = z.object({
  body: resendOtpBodySchema,
});

const loginBodySchema = z.object({
  email: z.string().trim().email('Invalid email format').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const loginSchema = z.object({
  body: loginBodySchema,
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const refreshSchema = z.object({
  body: refreshBodySchema,
});

const forgotPasswordBodySchema = z.object({
  email: z.string().trim().email('Invalid email format').toLowerCase(),
});

export const forgotPasswordSchema = z.object({
  body: forgotPasswordBodySchema,
});

const resetPasswordBodySchema = z.object({
  mobileNumber: mobileNumberSchema,
  code: otpCodeSchema,
  newPassword: passwordSchema,
});

export const resetPasswordSchema = z.object({
  body: resetPasswordBodySchema,
});

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpBodySchema>;
export type ResendOtpInput = z.infer<typeof resendOtpBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordBodySchema>;
