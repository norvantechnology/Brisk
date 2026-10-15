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

export const listPayoutJobs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.listPayoutJobs(req.user!.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payout jobs retrieved successfully.',
      data: data.items,
      meta: data.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getJobPayoutSummary = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getJobPayoutSummary(req.user!.id, req.params.jobId);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job payout summary retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listMyPayouts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.listMyPayouts(req.user!.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payout requests retrieved successfully.',
      data: data.items,
      meta: data.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const requestJobPayout = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.requestJobPayout(req.user!.id, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Payout request submitted successfully. Awaiting admin approval.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelPayoutRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.cancelPayoutRequest(req.user!.id, req.params.payoutId);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payout request cancelled successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
