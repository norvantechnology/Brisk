import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as service from './admin-trader-verification.service';

export const getStats = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await service.getVerificationStats();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader verification stats retrieved successfully.',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const listQueue = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listVerificationQueue(req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader verification queue retrieved successfully.',
      data: result.traders,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getDetail = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const detail = await service.getTraderVerificationDetail(req.params.traderId);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader verification detail retrieved successfully.',
      data: detail,
    });
  } catch (error) {
    next(error);
  }
};

export const review = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const detail = await service.reviewTraderVerification(req.params.traderId, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader verification updated successfully.',
      data: detail,
    });
  } catch (error) {
    next(error);
  }
};
