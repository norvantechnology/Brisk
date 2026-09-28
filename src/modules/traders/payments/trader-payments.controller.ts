import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import * as tradersService from '../traders.service';
import * as service from './trader-payments.service';

export const listPaymentHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const result = await service.listPaymentHistory(req.user!.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payment history retrieved successfully.',
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};
