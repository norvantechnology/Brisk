import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import * as tradersService from '../traders.service';
import * as service from './trader-earnings.service';

export const getEarningsDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.getEarningsDashboard(req.user!.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Earnings dashboard retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listPaymentTransactions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const result = await service.listPaymentTransactions(req.user!.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payment transactions fetched successfully.',
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};
