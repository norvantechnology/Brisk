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
    sendResponse({
      res,
      statusCode: 200,
      message: 'Installment payment details retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getJobPaymentHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, limit } = req.query as any;
    const result = await service.getJobPaymentHistory(req.user!.id, req.params.id, { page, limit });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Installment payment history retrieved successfully.',
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};
