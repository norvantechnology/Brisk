import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma, User, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
  TooManyRequestsError,
} from '../../utils/errors';
import {
  generateOtp,
  getOtpMeta,
  getResendCooldownSeconds,
  trySendOtp,
  verifyOtp,
} from './otp.service';
import type {
  RegisterInput,
  VerifyOtpInput,
  ResendOtpInput,
  LoginInput,
  ForgotPasswordInput,
  VerifyResetOtpInput,
  ResetPasswordInput,
} from './auth.validation';

type AuthUser = Pick<
  User,
  'id' | 'fullName' | 'email' | 'mobileNumber' | 'role' | 'mobileVerified' | 'status' | 'passwordHash'
>;

const PUBLIC_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  mobileNumber: true,
  role: true,
  mobileVerified: true,
} as const;

const toPublicUser = (
  user: Pick<User, 'id' | 'fullName' | 'email' | 'mobileNumber' | 'role' | 'mobileVerified'>,
  mobileVerifiedOverride?: boolean
) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  mobileNumber: user.mobileNumber,
  role: user.role,
  mobileVerified: mobileVerifiedOverride ?? user.mobileVerified,
});

const createAuthTokens = (user: { id: string; email: string; role: string }) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, type: 'user_access' },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, type: 'user_refresh' },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

const buildSessionPayload = (
  user: Pick<User, 'id' | 'fullName' | 'email' | 'mobileNumber' | 'role' | 'mobileVerified'>
) => {
  const tokens = createAuthTokens(user);
  return {
    requiresOtpVerification: false as const,
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};

const buildOtpRequiredPayload = async (user: AuthUser) => {
  const sendResult = await trySendOtp(user.mobileNumber);
  const otpMeta = getOtpMeta();

  if (sendResult.sent) {
    return {
      requiresOtpVerification: true as const,
      code: 'MOBILE_NOT_VERIFIED' as const,
      userId: user.id,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      mobileVerified: false as const,
      otpSent: true as const,
      ...otpMeta,
      message:
        'Mobile number is not verified. A verification code has been sent to your mobile number.',
    };
  }

  return {
    requiresOtpVerification: true as const,
    code: 'MOBILE_NOT_VERIFIED' as const,
    userId: user.id,
    email: user.email,
    mobileNumber: user.mobileNumber,
    role: user.role,
    mobileVerified: false as const,
    otpSent: false as const,
    retryAfterSeconds: sendResult.retryAfterSeconds,
    ...otpMeta,
    message: `Mobile number is not verified. Please wait ${sendResult.retryAfterSeconds} seconds before requesting a new code, or use POST /auth/resend-otp.`,
  };
};

const assertAccountCanAuthenticate = (user: Pick<User, 'status'>) => {
  if (user.status === UserStatus.BLOCKED || user.status === UserStatus.SUSPENDED) {
    throw new ForbiddenError('Your account has been restricted. Please contact support.');
  }
  if (user.status === UserStatus.INACTIVE) {
    throw new ForbiddenError('Your account is inactive. Please contact support.');
  }
};

const findUserByMobileOrThrow = async (mobileNumber: string) => {
  const user = await prisma.user.findUnique({ where: { mobileNumber } });
  if (!user) {
    throw new NotFoundError('User with this mobile number does not exist.');
  }
  return user;
};

const assertMobileAwaitingVerification = (user: Pick<User, 'mobileVerified'>) => {
  if (user.mobileVerified) {
    throw new BadRequestError('Mobile number is already verified.');
  }
};

const ensureTraderProfile = async (
  tx: Prisma.TransactionClient,
  user: Pick<User, 'id' | 'role'>
) => {
  if (user.role !== UserRole.TRADER) {
    return;
  }

  const existingProfile = await tx.trader.findUnique({
    where: { userId: user.id },
  });

  if (!existingProfile) {
    await tx.trader.create({
      data: { userId: user.id },
    });
  }
};

// ==========================================
// AUTH FLOWS
// ==========================================

export const registerUser = async (input: RegisterInput) => {
  const { fullName, email, mobileNumber, password, role } = input;

  const [existingEmail, existingMobile] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findUnique({ where: { mobileNumber }, select: { id: true } }),
  ]);

  if (existingEmail) {
    throw new ConflictError('Email is already registered.');
  }
  if (existingMobile) {
    throw new ConflictError('Mobile number is already registered.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      mobileNumber,
      passwordHash,
      role,
      mobileVerified: false,
      status: UserStatus.PENDING,
    },
  });

  await generateOtp(mobileNumber);

  return {
    message: 'Registration successful. Verification code has been sent to your mobile number.',
    data: {
      userId: user.id,
      mobileNumber: user.mobileNumber,
      email: user.email,
      role: user.role,
      mobileVerified: false,
      requiresOtpVerification: true,
      ...getOtpMeta(),
    },
  };
};

export const verifyUserOtp = async (input: VerifyOtpInput) => {
  const { mobileNumber, code } = input;
  const user = await findUserByMobileOrThrow(mobileNumber);

  assertMobileAwaitingVerification(user);
  assertAccountCanAuthenticate(user);

  const isValid = await verifyOtp(mobileNumber, code);
  if (!isValid) {
    throw new BadRequestError('Invalid or expired verification code.');
  }

  const verifiedUser = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        mobileVerified: true,
        status: UserStatus.ACTIVE,
      },
      select: PUBLIC_USER_SELECT,
    });

    await ensureTraderProfile(tx, user);
    return updated;
  });

  return {
    message: 'Mobile number verified successfully. Your account is now active.',
    data: buildSessionPayload({ ...verifiedUser, mobileVerified: true }),
  };
};

export const resendUserOtp = async (input: ResendOtpInput) => {
  const { mobileNumber } = input;
  const user = await findUserByMobileOrThrow(mobileNumber);

  assertMobileAwaitingVerification(user);
  assertAccountCanAuthenticate(user);

  await generateOtp(mobileNumber);

  return {
    message: 'A new verification code has been sent to your mobile number.',
    data: {
      mobileNumber: user.mobileNumber,
      requiresOtpVerification: true,
      otpSent: true,
      ...getOtpMeta(),
    },
  };
};

export const loginUser = async (input: LoginInput) => {
  const { email, password } = input;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  assertAccountCanAuthenticate(user);

  // Valid credentials, but OTP still pending → soft success for mobile apps.
  if (!user.mobileVerified) {
    const otpPayload = await buildOtpRequiredPayload(user);
    return {
      message: otpPayload.message,
      data: otpPayload,
    };
  }

  return {
    message: 'Logged in successfully.',
    data: buildSessionPayload(user),
  };
};

export const refreshUserSession = async (token: string) => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; type?: string };

    if (decoded.type && decoded.type !== 'user_refresh') {
      throw new UnauthorizedError('Invalid or expired refresh token.');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, status: true, mobileVerified: true },
    });

    if (!user) {
      throw new UnauthorizedError('User session no longer exists.');
    }

    assertAccountCanAuthenticate(user);

    if (!user.mobileVerified) {
      throw new ForbiddenError('Mobile number is not verified.', {
        code: 'MOBILE_NOT_VERIFIED',
      });
    }

    const { accessToken } = createAuthTokens(user);
    return { accessToken };
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      throw error;
    }
    throw new UnauthorizedError('Invalid or expired refresh token.');
  }
};

export const getAuthenticatedUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...PUBLIC_USER_SELECT,
      emailVerified: true,
      profilePhotoUrl: true,
      status: true,
      preferredLanguage: true,
      preferredTimeSlot: true,
      emailNotifications: true,
      smsAlerts: true,
      promoNotifications: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found.');
  }

  return user;
};

export const logoutUser = async () => ({
  message: 'Logged out successfully.',
});

const FORGOT_PASSWORD_GENERIC_MESSAGE =
  'If an account exists for this email, a verification code has been sent to the registered mobile number.';

const RESET_TOKEN_EXPIRES_IN = '15m';

const createPasswordResetToken = (user: { id: string; mobileNumber: string }) =>
  jwt.sign(
    {
      id: user.id,
      mobileNumber: user.mobileNumber,
      type: 'password_reset',
    },
    env.JWT_SECRET,
    { expiresIn: RESET_TOKEN_EXPIRES_IN }
  );

export const forgotPassword = async (input: ForgotPasswordInput) => {
  const { email } = input;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      mobileNumber: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    return {
      message: FORGOT_PASSWORD_GENERIC_MESSAGE,
      data: {
        requiresPasswordReset: false as const,
        otpSent: false as const,
        ...getOtpMeta(),
      },
    };
  }

  assertAccountCanAuthenticate(user);

  try {
    await generateOtp(user.mobileNumber, 'password_reset');
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      return {
        message: FORGOT_PASSWORD_GENERIC_MESSAGE,
        data: {
          requiresPasswordReset: true as const,
          userId: user.id,
          email: user.email,
          mobileNumber: user.mobileNumber,
          role: user.role,
          otpSent: false as const,
          retryAfterSeconds: getResendCooldownSeconds(),
          ...getOtpMeta(),
        },
      };
    }
    throw error;
  }

  return {
    message: FORGOT_PASSWORD_GENERIC_MESSAGE,
    data: {
      requiresPasswordReset: true as const,
      userId: user.id,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      otpSent: true as const,
      ...getOtpMeta(),
    },
  };
};

/**
 * Forgot-password step 2 — verify OTP only.
 * Do NOT use POST /auth/verify-otp (that is for signup mobile activation).
 */
export const verifyPasswordResetOtp = async (input: VerifyResetOtpInput) => {
  const { mobileNumber, code } = input;

  const user = await prisma.user.findUnique({
    where: { mobileNumber },
    select: {
      id: true,
      email: true,
      mobileNumber: true,
      role: true,
      status: true,
      mobileVerified: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User with this mobile number does not exist.');
  }

  assertAccountCanAuthenticate(user);

  const isValid = await verifyOtp(mobileNumber, code, 'password_reset');
  if (!isValid) {
    throw new BadRequestError('Invalid or expired verification code.');
  }

  const resetToken = createPasswordResetToken(user);

  return {
    message: 'Verification code confirmed. You can now set a new password.',
    data: {
      resetToken,
      resetTokenExpiresInMinutes: 15,
      userId: user.id,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      mobileVerified: user.mobileVerified,
    },
  };
};

const applyNewPassword = async (userId: string, newPassword: string) => {
  const fullUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, mobileVerified: true },
  });

  if (!fullUser) {
    throw new NotFoundError('User not found.');
  }

  assertAccountCanAuthenticate(fullUser);

  const passwordHash = await bcrypt.hash(newPassword, 10);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
    select: PUBLIC_USER_SELECT,
  });

  if (fullUser.mobileVerified) {
    return {
      message: 'Password reset successfully. You are now logged in.',
      data: buildSessionPayload(updatedUser),
    };
  }

  return {
    message: 'Password reset successfully. Please verify your mobile number to activate your account.',
    data: {
      requiresOtpVerification: true as const,
      userId: updatedUser.id,
      email: updatedUser.email,
      mobileNumber: updatedUser.mobileNumber,
      role: updatedUser.role,
      mobileVerified: false as const,
      ...getOtpMeta(),
    },
  };
};

export const resetPassword = async (input: ResetPasswordInput) => {
  const { resetToken, mobileNumber, code, newPassword } = input;

  // Preferred app flow: OTP already verified → resetToken only
  if (resetToken) {
    try {
      const decoded = jwt.verify(resetToken, env.JWT_SECRET) as {
        id: string;
        mobileNumber?: string;
        type?: string;
      };

      if (decoded.type !== 'password_reset') {
        throw new UnauthorizedError('Invalid or expired reset token.');
      }

      return applyNewPassword(decoded.id, newPassword);
    } catch (error) {
      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        throw error;
      }
      throw new UnauthorizedError('Invalid or expired reset token.');
    }
  }

  // Legacy one-shot: mobileNumber + code + newPassword
  if (!mobileNumber || !code) {
    throw new BadRequestError('Provide resetToken, or mobileNumber + code.');
  }

  const user = await prisma.user.findUnique({
    where: { mobileNumber },
    select: { id: true },
  });

  if (!user) {
    throw new NotFoundError('User with this mobile number does not exist.');
  }

  const isValid = await verifyOtp(mobileNumber, code, 'password_reset');
  if (!isValid) {
    throw new BadRequestError('Invalid or expired verification code.');
  }

  return applyNewPassword(user.id, newPassword);
};
