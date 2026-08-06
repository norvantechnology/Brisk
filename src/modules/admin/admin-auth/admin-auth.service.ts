import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import { UnauthorizedError, BadRequestError, NotFoundError } from '../../../utils/errors';
import { AdminLoginResponse, AdminUserProfile, AdminAuthTokens } from './admin-auth.types';
import { ActorType, AdminStatus } from '@prisma/client';

/**
 * Generate Access and Refresh JWT tokens for Admin
 */
const generateTokens = (adminId: string, email: string, role: string): AdminAuthTokens => {
  const accessToken = jwt.sign(
    { id: adminId, email, role, type: 'admin_access' },
    env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  const refreshToken = jwt.sign(
    { id: adminId, email, role, type: 'admin_refresh' },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

/**
 * Authenticate Admin User with Email & Password
 */
export const loginAdmin = async (email: string, password: string): Promise<AdminLoginResponse> => {
  const admin = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!admin) {
    throw new UnauthorizedError('Invalid credentials.');
  }

  if (admin.status !== AdminStatus.ACTIVE) {
    throw new UnauthorizedError('Admin account is inactive or suspended.');
  }

  const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid credentials.');
  }

  // Update last login timestamp
  const updatedAdmin = await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobileNumber: true,
      address: true,
      role: true,
      status: true,
      profilePhotoUrl: true,
      joinedAt: true,
      lastLoginAt: true,
    },
  });

  // Write to Audit Log
  await prisma.auditLog.create({
    data: {
      eventType: 'ADMIN_LOGIN',
      actorType: ActorType.ADMIN,
      actorId: admin.id,
      actorLabel: `${admin.fullName} (${admin.role})`,
      description: `Admin logged in successfully from portal.`,
    },
  });

  const tokens = generateTokens(admin.id, admin.email, admin.role);

  return {
    admin: updatedAdmin,
    tokens,
  };
};

/**
 * Refresh Session Access Token
 */
export const refreshAdminToken = async (refreshToken: string): Promise<AdminAuthTokens> => {
  try {
    const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as {
      id: string;
      email: string;
      role: string;
      type?: string;
    };

    if (decoded.type && decoded.type !== 'admin_refresh') {
      throw new UnauthorizedError('Invalid refresh token token type.');
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.id },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedError('Admin session no longer valid.');
    }

    return generateTokens(admin.id, admin.email, admin.role);
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired refresh token.');
  }
};

/**
 * Get Profile of Authenticated Admin
 */
export const getAdminProfile = async (adminId: string): Promise<AdminUserProfile> => {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobileNumber: true,
      address: true,
      role: true,
      status: true,
      profilePhotoUrl: true,
      joinedAt: true,
      lastLoginAt: true,
    },
  });

  if (!admin) {
    throw new NotFoundError('Admin user profile not found.');
  }

  return admin;
};

/**
 * Change Admin Password
 */
export const changeAdminPassword = async (
  adminId: string,
  oldPassword: string,
  newPassword: string
): Promise<void> => {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
  });

  if (!admin) {
    throw new NotFoundError('Admin user not found.');
  }

  const isOldPasswordValid = await bcrypt.compare(oldPassword, admin.passwordHash);
  if (!isOldPasswordValid) {
    throw new BadRequestError('Incorrect current password.');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await prisma.adminUser.update({
    where: { id: adminId },
    data: { passwordHash: newPasswordHash },
  });

  // Write to Audit Log
  await prisma.auditLog.create({
    data: {
      eventType: 'ADMIN_PASSWORD_CHANGED',
      actorType: ActorType.ADMIN,
      actorId: admin.id,
      actorLabel: `${admin.fullName} (${admin.role})`,
      description: `Admin updated their password.`,
    },
  });
};
