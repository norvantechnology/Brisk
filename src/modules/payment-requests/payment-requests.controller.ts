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
