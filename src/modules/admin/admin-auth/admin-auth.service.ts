import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import { UnauthorizedError, BadRequestError, NotFoundError, ConflictError } from '../../../utils/errors';
import { AdminLoginResponse, AdminUserProfile, AdminAuthTokens } from './admin-auth.types';
import type { UpdateAdminProfileInput } from './admin-auth.validation';
import { ActorType, AdminStatus, Prisma } from '@prisma/client';
import { buildTokenExpiry } from '../../../utils/token-expiry';

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

  return { accessToken, refreshToken, ...buildTokenExpiry(accessToken, refreshToken) };
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
const ADMIN_PROFILE_SELECT = {
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
} as const;

export const getAdminProfile = async (adminId: string): Promise<AdminUserProfile> => {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: ADMIN_PROFILE_SELECT,
  });

  if (!admin) {
    throw new NotFoundError('Admin user profile not found.');
  }

  return admin;
};

/**
 * Update own profile (name, email, mobile, address, photo). `null` clears an optional field.
 */
export const updateAdminProfile = async (
  adminId: string,
  input: UpdateAdminProfileInput
): Promise<AdminUserProfile> => {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: ADMIN_PROFILE_SELECT,
  });
  if (!admin) {
    throw new NotFoundError('Admin user profile not found.');
  }

  if (input.email && input.email !== admin.email) {
    const taken = await prisma.adminUser.findUnique({ where: { email: input.email }, select: { id: true } });
    if (taken) {
      throw new ConflictError('This email is already used by another admin account.');
    }
  }

  const data: Prisma.AdminUserUpdateInput = {};
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.email !== undefined) data.email = input.email;
  if (input.mobileNumber !== undefined) data.mobileNumber = input.mobileNumber;
  if (input.address !== undefined) data.address = input.address;
  if (input.profilePhotoUrl !== undefined) data.profilePhotoUrl = input.profilePhotoUrl;

  const changed = (Object.keys(data) as Array<keyof typeof admin>).filter(
    (key) => (data as Record<string, unknown>)[key] !== admin[key]
  );
  if (!changed.length) return admin;

  const updated = await prisma.adminUser.update({
    where: { id: adminId },
    data,
    select: ADMIN_PROFILE_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'ADMIN_PROFILE_UPDATED',
      actorType: ActorType.ADMIN,
      actorId: admin.id,
      actorLabel: `${updated.fullName} (${updated.role})`,
      description: `Admin updated their profile (${changed.join(', ')}).`,
    },
  });

  return updated;
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
