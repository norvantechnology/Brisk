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

export const claimOffer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offerId = req.params.id || req.body?.offerId || req.body?.id;
    const data = await loyaltyService.redeemLoyaltyOffer(req.user!.id, offerId);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Loyalty offer claimed successfully.',
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

export const addTestPoints = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const points = typeof req.body?.points === 'number' ? req.body.points : 500;
    const account = await loyaltyService.addTestPoints(req.user!.id, points);
    sendResponse({
      res,
      statusCode: 200,
      message: `${points} test loyalty points added successfully.`,
      data: {
        pointsBalance: account.pointsBalance,
        accountId: account.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

