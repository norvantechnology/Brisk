import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
} from '../../utils/errors';
import {
  canResendOtp,
  generateOtp,
  getOtpExpiryMinutes,
  getResendCooldownSeconds,
  verifyOtp,
} from './otp.service';
import type { RegisterInput, VerifyOtpInput, ResendOtpInput, LoginInput } from './auth.validation';

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

export const registerUser = async (input: RegisterInput) => {
  const { fullName, email, mobileNumber, password, role } = input;

  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });
  if (existingEmail) {
    throw new ConflictError('Email is already registered.');
  }

  const existingMobile = await prisma.user.findUnique({
    where: { mobileNumber },
  });
  if (existingMobile) {
    throw new ConflictError('Mobile number is already registered.');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      mobileNumber,
      passwordHash,
      role,
      mobileVerified: false,
    },
  });

  await generateOtp(mobileNumber);

  return {
    userId: user.id,
    mobileNumber: user.mobileNumber,
    email: user.email,
    role: user.role,
    mobileVerified: false,
    message: 'Registration successful. Verification code has been sent to your mobile number.',
    otpExpiresInMinutes: getOtpExpiryMinutes(),
    resendCooldownSeconds: getResendCooldownSeconds(),
  };
};

export const verifyUserOtp = async (input: VerifyOtpInput) => {
  const { mobileNumber, code } = input;

  const user = await prisma.user.findUnique({
    where: { mobileNumber },
  });
  if (!user) {
    throw new NotFoundError('User with this mobile number does not exist.');
  }

  if (user.mobileVerified) {
    throw new BadRequestError('Mobile number is already verified.');
  }

  const isValid = await verifyOtp(mobileNumber, code);
  if (!isValid) {
    throw new BadRequestError('Invalid or expired verification code.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { mobileVerified: true },
    });

    if (user.role === 'TRADER') {
      const existingProfile = await tx.trader.findUnique({
        where: { userId: user.id },
      });
      if (!existingProfile) {
        await tx.trader.create({
          data: {
            userId: user.id,
          },
        });
      }
    }
  });

  const tokens = createAuthTokens(user);

  return {
    message: 'Mobile number verified successfully. Your account is now active.',
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      mobileVerified: true,
    },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};

export const resendUserOtp = async (input: ResendOtpInput) => {
  const { mobileNumber } = input;

  const user = await prisma.user.findUnique({
    where: { mobileNumber },
  });
  if (!user) {
    throw new NotFoundError('User with this mobile number does not exist.');
  }

  if (user.mobileVerified) {
    throw new BadRequestError('Mobile number is already verified.');
  }

  await generateOtp(mobileNumber);

  return {
    message: 'A new verification code has been sent to your mobile number.',
    otpExpiresInMinutes: getOtpExpiryMinutes(),
    resendCooldownSeconds: getResendCooldownSeconds(),
  };
};

export const loginUser = async (input: LoginInput) => {
  const { email, password } = input;

  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  if (!user.mobileVerified) {
    const unverifiedPayload = {
      userId: user.id,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      mobileVerified: false,
      otpExpiresInMinutes: getOtpExpiryMinutes(),
      resendCooldownSeconds: getResendCooldownSeconds(),
    };

    const cooldown = canResendOtp(user.mobileNumber);
    if (cooldown.allowed) {
      await generateOtp(user.mobileNumber);
      throw new ForbiddenError(
        'Mobile number is not verified. A verification code has been sent to your mobile number.',
        {
          code: 'MOBILE_NOT_VERIFIED',
          data: {
            ...unverifiedPayload,
            otpSent: true,
          },
        }
      );
    }

    throw new ForbiddenError(
      `Mobile number is not verified. Please wait ${cooldown.retryAfterSeconds} seconds before requesting a new code, or use POST /auth/resend-otp.`,
      {
        code: 'MOBILE_NOT_VERIFIED',
        data: {
          ...unverifiedPayload,
          otpSent: false,
          retryAfterSeconds: cooldown.retryAfterSeconds,
        },
      }
    );
  }

  const tokens = createAuthTokens(user);

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      mobileVerified: user.mobileVerified,
    },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
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
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedError('User session no longer exists.');
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, type: 'user_access' },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return {
      accessToken,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError('Invalid or expired refresh token.');
  }
};

export const getAuthenticatedUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobileNumber: true,
      role: true,
      mobileVerified: true,
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

export const logoutUser = async () => {
  return {
    message: 'Logged out successfully.',
  };
};
