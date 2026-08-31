import { Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import * as loyaltyService from './loyalty.service';

export const getAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await loyaltyService.getAccount(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Loyalty account retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listOffers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await loyaltyService.listLoyaltyOffers(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Loyalty offers retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const redeemOffer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await loyaltyService.redeemLoyaltyOffer(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Loyalty offer redeemed successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listRedemptions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await loyaltyService.listRedemptions(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Loyalty redemptions retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
