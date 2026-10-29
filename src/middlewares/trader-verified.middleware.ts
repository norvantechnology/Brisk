import { Response, NextFunction } from 'express';
import { VerificationStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from './auth.middleware';
import { UnauthorizedError } from '../utils/errors';

/**
 * Blocks trader portal operational APIs (jobs, offers, etc.) until
 * `verificationStatus === VERIFIED`. Login + profile/onboarding remain available.
 */
export const traderVerifiedMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
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
      res.status(200).json({
        success: false,
        message: 'Trader profile not found.',
        data: {
          code: 'TRADER_NOT_FOUND',
        },
      });
      return;
    }

    if (trader.verificationStatus !== VerificationStatus.VERIFIED) {
      res.status(200).json({
        success: false,
        message:
          'Trader account is pending verification. Marketplace access is unavailable until admin approval.',
        data: {
          verificationStatus: trader.verificationStatus,
          onboardingStatus: trader.onboardingStatus,
          nextStep: 'TRADER_PENDING_APPROVAL',
          traderAccountActive: false,
          code: 'TRADER_NOT_VERIFIED',
        },
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
