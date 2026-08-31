import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as currencyAdminService from './admin-currency.service';

export const getCurrencyOverview = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await currencyAdminService.getCurrencyOverview();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Currency settings retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePlatformBaseCurrency = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const settings = await currencyAdminService.updatePlatformBaseCurrency(
      req.body.baseCurrency,
      req.adminUser!.id
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Platform base currency updated successfully.',
      data: { settings },
    });
  } catch (error) {
    next(error);
  }
};

export const upsertCurrency = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currency = await currencyAdminService.upsertCurrency(req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Currency saved successfully.',
      data: { currency },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCurrency = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currency = await currencyAdminService.updateCurrency(req.params.code, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Currency updated successfully.',
      data: { currency },
    });
  } catch (error) {
    next(error);
  }
};

export const upsertExchangeRates = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rates = await currencyAdminService.upsertExchangeRates(req.body, req.adminUser!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Exchange rates updated successfully.',
      data: { rates },
    });
  } catch (error) {
    next(error);
  }
};
