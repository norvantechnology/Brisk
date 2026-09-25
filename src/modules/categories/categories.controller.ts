import { Request, Response, NextFunction } from 'express';
import * as categoriesService from './categories.service';
import { sendResponse } from '../../utils/apiResponse';
import type { AuthenticatedRequest } from '../../middlewares/auth.middleware';

const traderUserIdFrom = (req: Request): string | null => {
  const user = (req as AuthenticatedRequest).user;
  return user?.role === 'TRADER' ? user.id : null;
};

export const listCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await categoriesService.listActiveCategories(req.query, {
      traderUserId: traderUserIdFrom(req),
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Categories retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await categoriesService.getActiveCategoryById(req.params.id, {
      traderUserId: traderUserIdFrom(req),
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Category retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await categoriesService.getActiveCategoryBySlug(req.params.slug, {
      traderUserId: traderUserIdFrom(req),
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Category retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listSubcategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await categoriesService.listActiveSubcategories(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Sub-categories retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubcategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await categoriesService.getActiveSubcategoryById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Sub-category retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
