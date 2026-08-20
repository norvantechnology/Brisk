import { Response, NextFunction } from 'express';
import * as tradersService from './traders.service';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

export const getMyTraderProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const profile = await tradersService.getTraderProfile(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader profile retrieved successfully.',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyTraderProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const trader = await tradersService.updateTraderProfile(req.user!.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader profile updated successfully.',
      data: trader,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyBankDetails = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const profile = await tradersService.updateTraderBankDetails(req.user!.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Bank details updated successfully.',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};
