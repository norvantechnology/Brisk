import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';
import { prisma } from '../config/database';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'CUSTOMER' | 'TRADER';
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token is missing or invalid.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
      role: 'CUSTOMER' | 'TRADER';
      tv?: number;
    };

    // Verify user still exists and this token has not been revoked (e.g. trader approved).
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, tokenVersion: true },
    });

    if (!user) {
      throw new UnauthorizedError('User session no longer valid.');
    }

    if ((decoded.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedError('Session expired. Please log in again.', {
        code: 'SESSION_INVALIDATED',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid or expired authentication token.'));
    } else {
      next(error);
    }
  }
};
