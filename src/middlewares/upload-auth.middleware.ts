import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { UnauthorizedError } from '../utils/errors';
import { AdminStatus } from '@prisma/client';
import { UploadActor } from '../modules/uploads/uploads.types';
import { Request } from 'express';

export interface UploadAuthRequest extends Request {
  uploadActor?: UploadActor;
}

export const uploadAuthMiddleware = async (
  req: UploadAuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token is missing or invalid.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
      role?: string;
      type?: string;
      tv?: number;
    };

    if (decoded.type === 'admin_access') {
      const admin = await prisma.adminUser.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, status: true },
      });
      if (!admin || admin.status !== AdminStatus.ACTIVE) {
        throw new UnauthorizedError('Admin session no longer valid.');
      }
      req.uploadActor = { kind: 'admin', id: admin.id, role: admin.role };
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, tokenVersion: true },
    });
    if (!user) {
      throw new UnauthorizedError('User session no longer valid.');
    }

    const tv = decoded.tv ?? 0;
    if (tv !== user.tokenVersion) {
      throw new UnauthorizedError('Session expired. Please log in again.');
    }

    req.uploadActor = { kind: 'user', id: user.id, role: user.role };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid or expired authentication token.'));
    } else {
      next(error);
    }
  }
};
