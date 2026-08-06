import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { ConflictError, NotFoundError, UnauthorizedError, BadRequestError } from '../../utils/errors';
import { generateOtp, verifyOtp } from './otp.service';
import { registerSchema, verifyOtpSchema, loginSchema } from './auth.validation';
import { z } from 'zod';

type RegisterInput = z.infer<typeof registerSchema>;
type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
type LoginInput = z.infer<typeof loginSchema>;

export const registerUser = async (input: RegisterInput) => {
  const { fullName, email, mobileNumber, password, role } = input;

  // Check if email already registered
  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });
  if (existingEmail) {
    throw new ConflictError('Email is already registered.');
  }

  // Check if mobile number already registered
  const existingMobile = await prisma.user.findUnique({
    where: { mobileNumber },
  });
  if (existingMobile) {
    throw new ConflictError('Mobile number is already registered.');
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Create user
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

  // Generate and Mock SMS OTP code
  await generateOtp(mobileNumber);

  return {
    userId: user.id,
    message: 'Registration successful. Verification code has been sent to your mobile number.',
  };
};

export const verifyUserOtp = async (input: VerifyOtpInput) => {
  const { mobileNumber, code } = input;

  // Find user by mobile number
  const user = await prisma.user.findUnique({
    where: { mobileNumber },
  });
  if (!user) {
    throw new NotFoundError('User with this mobile number does not exist.');
  }

  // Check OTP
  const isValid = await verifyOtp(mobileNumber, code);
  if (!isValid) {
    throw new BadRequestError('Invalid or expired verification code.');
  }

  // Update user verified state
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { mobileVerified: true },
    });

    // If user is a trader, auto-initialize their profile record
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

  return {
    message: 'Mobile number verified successfully. Your account is now active.',
  };
};

export const loginUser = async (input: LoginInput) => {
  const { email, password } = input;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  // Check verification state
  if (!user.mobileVerified) {
    // Generate new OTP so they can verify
    await generateOtp(user.mobileNumber);
    throw new UnauthorizedError('Mobile number is not verified. An OTP has been resent to your mobile number.');
  }

  // Generate Access and Refresh JWT Tokens
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
};

export const refreshUserSession = async (token: string) => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedError('User session no longer exists.');
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return {
      accessToken,
    };
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired refresh token.');
  }
};
