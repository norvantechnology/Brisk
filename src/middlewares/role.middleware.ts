import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export const roleMiddleware = (allowedRoles: ('CUSTOMER' | 'TRADER')[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required.'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError('Forbidden: Access denied for this user role.'));
      return;
    }

    next();
  };
};
