import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as pricingService from './admin-pricing.service';

export const getPricing = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pricingService.getPricingConfig();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Pricing configuration retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePricing = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pricingService.updatePricingConfig(req.body, {
      id: req.adminUser!.id,
      fullName: req.adminUser!.fullName,
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Pricing configuration updated successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
