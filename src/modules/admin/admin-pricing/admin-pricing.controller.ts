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

export const getCustomPricingOverview = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pricingService.getAllCustomPricingOverview();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Custom pricing overview retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listCategoriesPricing = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pricingService.listCategoriesPricing(req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Categories pricing retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryPricing = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pricingService.getCategoryPricing(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Category pricing retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategoryPricing = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pricingService.updateCategoryPricing(req.params.id, req.body, {
      id: req.adminUser!.id,
      fullName: req.adminUser!.fullName,
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Category pricing updated successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategoryPricing = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pricingService.updateCategoryPricing(
      req.params.id,
      { enabled: false },
      {
        id: req.adminUser!.id,
        fullName: req.adminUser!.fullName,
      }
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Category custom pricing disabled, reverted to default 10%.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listSubcategoriesPricing = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pricingService.listSubcategoriesPricing(req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Subcategories pricing retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubcategoryPricing = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pricingService.getSubcategoryPricing(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Subcategory pricing retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubcategoryPricing = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pricingService.updateSubcategoryPricing(req.params.id, req.body, {
      id: req.adminUser!.id,
      fullName: req.adminUser!.fullName,
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Subcategory pricing updated successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSubcategoryPricing = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pricingService.updateSubcategoryPricing(
      req.params.id,
      { enabled: false },
      {
        id: req.adminUser!.id,
        fullName: req.adminUser!.fullName,
      }
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Subcategory custom pricing disabled, reverted to Category/Default rule.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
