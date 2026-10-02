import { Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import * as service from './payment-requests.service';

export const listJobPaymentRequests = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.listJobPaymentRequests(req.user!.id, req.params.id);
    sendResponse({ res, statusCode: 200, message: 'Payment requests fetched successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const getPaymentRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getPaymentRequest(req.user!.id, req.params.id);
    sendResponse({ res, statusCode: 200, message: 'Payment request fetched successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const createPaymentRequestIntent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.createPaymentRequestIntent(req.user!.id, req.params.id);
    sendResponse({ res, statusCode: 201, message: 'Payment intent created successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const confirmPaymentRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.confirmPaymentRequest(req.user!.id, req.params.id);
    sendResponse({ res, statusCode: 200, message: 'Payment confirmed successfully.', data });
  } catch (error) {
    next(error);
  }
};
