import { Response, NextFunction } from 'express';
import { VerificationStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from './auth.middleware';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Blocks trader portal operational APIs (jobs, offers, etc.) until
 * `verificationStatus === VERIFIED`. Login + profile/onboarding remain available.
 */
export const traderVerifiedMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required.'));
      return;
    }

    const trader = await prisma.trader.findUnique({
      where: { userId: req.user.id },
      select: { verificationStatus: true, onboardingStatus: true },
    });

    if (!trader) {
      next(
        new ForbiddenError('Trader profile not found.', {
          code: 'TRADER_NOT_FOUND',
        })
      );
      return;
    }

    if (trader.verificationStatus !== VerificationStatus.VERIFIED) {
      next(
        new ForbiddenError(
          'Trader account is pending verification. Marketplace access is unavailable until admin approval.',
          {
            code: 'TRADER_NOT_VERIFIED',
            data: {
              verificationStatus: trader.verificationStatus,
              onboardingStatus: trader.onboardingStatus,
              nextStep: 'TRADER_PENDING_APPROVAL',
              traderAccountActive: false,
            },
          }
        )
      );
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
