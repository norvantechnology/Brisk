import { Response, NextFunction } from 'express';
import * as categoryAdminService from './admin-categories.service';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';

// ==========================================
// CATEGORY CONTROLLERS
// ==========================================

export const listCategories = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await categoryAdminService.listCategories(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Master Categories retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const category = await categoryAdminService.getCategoryById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Category retrieved successfully.',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const category = await categoryAdminService.createCategory(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Master Category created successfully.',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const category = await categoryAdminService.updateCategory(adminId, adminLabel, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Master Category updated successfully.',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    await categoryAdminService.deleteCategory(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Master Category deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// SUB-CATEGORY CONTROLLERS
// ==========================================

export const listSubcategories = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await categoryAdminService.listSubcategories(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Sub-Categories retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubcategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const subcategory = await categoryAdminService.getSubcategoryById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Sub-Category retrieved successfully.',
      data: { subcategory },
    });
  } catch (error) {
    next(error);
  }
};

export const createSubcategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const subcategory = await categoryAdminService.createSubcategory(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Sub-Category created successfully.',
      data: { subcategory },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubcategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const subcategory = await categoryAdminService.updateSubcategory(adminId, adminLabel, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Sub-Category updated successfully.',
      data: { subcategory },
    });
  } catch (error) {
    next(error);
  }
};

export const listCategoriesDropdown = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await categoryAdminService.listCategoriesDropdown();
    sendResponse({ res, statusCode: 200, message: 'Categories dropdown retrieved.', data });
  } catch (error) {
    next(error);
  }
};

export const listSubcategoriesDropdown = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
    const data = await categoryAdminService.listSubcategoriesDropdown(categoryId);
    sendResponse({ res, statusCode: 200, message: 'Sub-categories dropdown retrieved.', data });
  } catch (error) {
    next(error);
  }
};

export const deleteSubcategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    await categoryAdminService.deleteSubcategory(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Sub-Category deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
