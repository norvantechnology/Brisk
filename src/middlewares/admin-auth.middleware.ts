import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { prisma } from '../config/database';
import { AdminRole, AdminStatus } from '@prisma/client';

export interface AuthenticatedAdminRequest extends Request {
  adminUser?: {
    id: string;
    email: string;
    role: AdminRole;
    fullName: string;
  };
}

export const adminAuthMiddleware = async (
  req: AuthenticatedAdminRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Admin access token is missing or invalid.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
      role: AdminRole;
      type?: string;
    };

    if (decoded.type && decoded.type !== 'admin_access') {
      throw new UnauthorizedError('Token is not an admin access token.');
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedError('Admin account is inactive or session no longer valid.');
    }

    req.adminUser = {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid or expired admin authentication token.'));
    } else {
      next(error);
    }
  }
};

export const adminRoleMiddleware = (allowedRoles: AdminRole[]) => {
  return (req: AuthenticatedAdminRequest, _res: Response, next: NextFunction): void => {
    if (!req.adminUser) {
      next(new UnauthorizedError('Admin authentication required.'));
      return;
    }

    if (!allowedRoles.includes(req.adminUser.role)) {
      next(new ForbiddenError('Forbidden: Access denied for your admin role level.'));
      return;
    }

    next();
  };
};
