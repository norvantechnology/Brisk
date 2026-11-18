import { Response, NextFunction } from 'express';
import * as service from './admin-property-suppliers.service';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';

// ============================================================================
// CATEGORY CONTROLLERS
// ============================================================================

export const listCategories = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listCategories(req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Property supplier categories retrieved successfully.',
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
    const category = await service.getCategoryById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Property supplier category retrieved successfully.',
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
    const category = await service.createCategory(req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Property supplier category created successfully.',
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
    const category = await service.updateCategory(req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Property supplier category updated successfully.',
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
    const result = await service.deleteCategory(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// SUPPLIER CONTROLLERS
// ============================================================================

export const listSuppliers = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listSuppliers(req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Property suppliers retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSupplier = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supplier = await service.getSupplierById(req.params.id);
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

export const createSupplier = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supplier = await service.createSupplier(req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Property supplier created successfully.',
      data: { supplier },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supplier = await service.updateSupplier(req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Property supplier updated successfully.',
      data: { supplier },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSupplier = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.deleteSupplier(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// COUNTY COVERAGE CONTROLLERS
// ============================================================================

export const getCountyCoverageOverview = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const overview = await service.getCountyCoverageOverview();
    sendResponse({
      res,
      statusCode: 200,
      message: 'County coverage overview retrieved successfully.',
      data: { counties: overview },
    });
  } catch (error) {
    next(error);
  }
};

export const assignCounties = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const counties: string[] = req.body.counties || [];
    const isDomesticCollector = req.body.isDomesticCollector !== false;
    const supplier = await service.assignCountiesToSupplier(
      req.params.id,
      counties,
      isDomesticCollector
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Counties assigned to supplier successfully.',
      data: { supplier },
    });
  } catch (error) {
    next(error);
  }
};

export const removeCounty = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.removeCountyFromSupplier(
      req.params.id,
      req.params.county
    );
    sendResponse({
      res,
      statusCode: 200,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};
