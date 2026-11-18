import { Request, Response, NextFunction } from 'express';
import * as service from './property-suppliers.service';
import { sendResponse } from '../../utils/apiResponse';

export const listCategories = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categories = await service.listActiveCategories();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Property supplier categories retrieved successfully.',
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};

export const listSuppliers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const suppliers = await service.listActiveSuppliers(req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Property suppliers retrieved successfully.',
      data: { suppliers },
    });
  } catch (error) {
    next(error);
  }
};

export const listCounties = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const counties = await service.listCountiesWithSuppliers();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Counties with available suppliers retrieved successfully.',
      data: { counties },
    });
  } catch (error) {
    next(error);
  }
};

export const getSupplierDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supplier = await service.getSupplierDetail(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Property supplier retrieved successfully.',
      data: { supplier },
    });
  } catch (error) {
    next(error);
  }
};
