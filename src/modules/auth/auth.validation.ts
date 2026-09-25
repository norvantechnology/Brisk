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

const acceptedTermsField = z.preprocess(
  (value) =>
    value === true ||
    value === 1 ||
    value === 'true' ||
    value === 'True' ||
    value === '1',
  z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms & Privacy Policy.' }),
  })
);

const optionalProfilePhotoUrl = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.string().trim().url('Invalid profile photo URL').optional()
);

const registerBodySchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters long'),
  email: z.string().trim().email('Invalid email format').toLowerCase(),
  mobileNumber: mobileNumberSchema,
  password: passwordSchema,
  role: z.enum(['CUSTOMER', 'TRADER'], {
    errorMap: () => ({ message: "Role must be either 'CUSTOMER' or 'TRADER'" }),
  }),
  acceptedTerms: acceptedTermsField,
  /** Country selected during sign-up (e.g. Ireland, United Kingdom). Saved on user profile. */
  country: z.string().trim().min(1, 'Country is required').max(100).optional(),
  profilePhotoUrl: optionalProfilePhotoUrl,
});

export const registerSchema = z.object({
  body: registerBodySchema,
});

const verifyOtpBodySchema = z
  .object({
    mobileNumber: mobileNumberSchema,
    /** Mobile OTP code. Alias: `code` kept for backward compatibility. */
    mobileCode: otpCodeSchema.optional(),
    code: otpCodeSchema.optional(),
    /** Required for traders when email is still unverified — same screen as mobile. */
    email: z.string().trim().email('Invalid email format').toLowerCase().optional(),
    emailCode: otpCodeSchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (!body.mobileCode && !body.code && !body.emailCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide mobileCode (or code) and/or emailCode.',
        path: ['mobileCode'],
      });
    }
  });

export const verifyOtpSchema = z.object({
  body: verifyOtpBodySchema,
});

const resendOtpBodySchema = z
  .object({
    mobileNumber: mobileNumberSchema.optional(),
    email: z.string().trim().email('Invalid email format').toLowerCase().optional(),
    /** Which channel to resend. Default: both when trader provides both identifiers. */
    channel: z.enum(['mobile', 'email', 'both']).optional().default('both'),
  })
  .superRefine((body, ctx) => {
    if (body.channel === 'mobile' && !body.mobileNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mobileNumber is required when channel is mobile.',
        path: ['mobileNumber'],
      });
    }
    if (body.channel === 'email' && !body.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'email is required when channel is email.',
        path: ['email'],
      });
    }
    if (body.channel === 'both' && !body.mobileNumber && !body.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide mobileNumber and/or email to resend OTP.',
        path: ['mobileNumber'],
      });
    }
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

const forgotPasswordBodySchema = z
  .object({
    email: z.string().trim().email('Invalid email format').toLowerCase().optional(),
    mobileNumber: mobileNumberSchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (!body.email && !body.mobileNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide email or mobileNumber.',
        path: ['email'],
      });
    }
  });

export const forgotPasswordSchema = z.object({
  body: forgotPasswordBodySchema,
});

/** Step 2 of forgot-password: verify OTP only (does not change password). */
const verifyResetOtpBodySchema = z
  .object({
    email: z.string().trim().email('Invalid email format').toLowerCase().optional(),
    mobileNumber: mobileNumberSchema.optional(),
    code: otpCodeSchema,
  })
  .superRefine((body, ctx) => {
    if (!body.email && !body.mobileNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide email or mobileNumber.',
        path: ['email'],
      });
    }
  });

export const verifyResetOtpSchema = z.object({
  body: verifyResetOtpBodySchema,
});

/**
 * Next screen after forgot-password OTP:
 * code + newPassword + confirmPassword (email or mobileNumber).
 * Legacy: resetToken + newPassword (+ confirmPassword) still accepted.
 */
const resetPasswordBodySchema = z
  .object({
    resetToken: z.string().trim().min(1).optional(),
    email: z.string().trim().email('Invalid email format').toLowerCase().optional(),
    mobileNumber: mobileNumberSchema.optional(),
    code: otpCodeSchema.optional(),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .superRefine((body, ctx) => {
    if (body.newPassword !== body.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'New password and confirm password do not match.',
        path: ['confirmPassword'],
      });
    }
    if (body.resetToken) {
      return;
    }
    if (!body.code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide code from the OTP screen, or resetToken from verify-reset-otp.',
        path: ['code'],
      });
      return;
    }
    if (!body.email && !body.mobileNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide email or mobileNumber with the OTP code.',
        path: ['email'],
      });
    }
  });

export const resetPasswordSchema = z.object({
  body: resetPasswordBodySchema,
});

const verifyEmailBodySchema = z.object({
  email: z.string().trim().email('Invalid email format').toLowerCase(),
  code: otpCodeSchema,
});

export const verifyEmailSchema = z.object({
  body: verifyEmailBodySchema,
});

const resendEmailOtpBodySchema = z.object({
  email: z.string().trim().email('Invalid email format').toLowerCase(),
});

export const resendEmailOtpSchema = z.object({
  body: resendEmailOtpBodySchema,
});

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpBodySchema>;
export type ResendOtpInput = z.infer<typeof resendOtpBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordBodySchema>;
export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpBodySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordBodySchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailBodySchema>;
export type ResendEmailOtpInput = z.infer<typeof resendEmailOtpBodySchema>;
