import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import * as service from './trader-payouts.service';

export const createStripeOnboardingLink = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.createStripeOnboardingLink(req.user!.id, req.body ?? {});
    sendResponse({ res, statusCode: 201, message: 'Stripe onboarding link created successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const getStripeConnectStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getStripeConnectStatus(req.user!.id);
    sendResponse({ res, statusCode: 200, message: 'Stripe payout account status fetched successfully.', data });
  } catch (error) {
    next(error);
  }
};
