import { AdminRole, AdminStatus } from '@prisma/client';

export interface AdminAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AdminUserProfile {
  id: string;
  fullName: string;
  email: string;
  mobileNumber?: string | null;
  address?: string | null;
  role: AdminRole;
  status: AdminStatus;
  profilePhotoUrl?: string | null;
  joinedAt: Date;
  lastLoginAt?: Date | null;
}

export interface AdminLoginResponse {
  admin: AdminUserProfile;
  tokens: AdminAuthTokens;
}
