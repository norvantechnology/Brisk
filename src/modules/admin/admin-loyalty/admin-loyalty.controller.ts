import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as loyaltyAdminService from './admin-loyalty.service';

export const listLoyaltyOffers = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await loyaltyAdminService.listLoyaltyOffers(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Loyalty offers retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getLoyaltyOffer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await loyaltyAdminService.getLoyaltyOffer(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Loyalty offer retrieved successfully.',
      data: { offer },
    });
  } catch (error) {
    next(error);
  }
};

export const createLoyaltyOffer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await loyaltyAdminService.createLoyaltyOffer(req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Loyalty offer created successfully.',
      data: { offer },
    });
  } catch (error) {
    next(error);
  }
};

export const updateLoyaltyOffer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await loyaltyAdminService.updateLoyaltyOffer(req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Loyalty offer updated successfully.',
      data: { offer },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLoyaltyOffer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await loyaltyAdminService.deleteLoyaltyOffer(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Loyalty offer deleted successfully.',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
