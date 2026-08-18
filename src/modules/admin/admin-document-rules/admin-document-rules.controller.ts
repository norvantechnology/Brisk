import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import {
  listEntityDocumentRules,
  listCategoryDocumentRulesByCategoryId,
  replaceEntityDocumentRules,
  replaceCategoryDocumentRules,
  createEntityDocumentRule,
  createCategoryDocumentRule,
  deleteDocumentRule,
} from '../../document-rules/document-rules.service';
import { traderTypeFromParam } from './admin-document-rules.validation';

export const getEntityRules = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const traderType = traderTypeFromParam(req.params.traderType);
    const rules = await listEntityDocumentRules(traderType);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Entity document rules retrieved successfully.',
      data: { traderType, rules },
    });
  } catch (error) {
    next(error);
  }
};

export const postEntityRule = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const traderType = traderTypeFromParam(req.params.traderType);
    const rule = await createEntityDocumentRule(traderType, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Document rule created successfully.',
      data: { rule },
    });
  } catch (error) {
    next(error);
  }
};

export const postCategoryRule = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rule = await createCategoryDocumentRule(req.params.categoryId, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Document rule created successfully.',
      data: { rule },
    });
  } catch (error) {
    next(error);
  }
};

export const removeDocumentRule = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rule = await deleteDocumentRule(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Document rule deleted successfully.',
      data: { rule },
    });
  } catch (error) {
    next(error);
  }
};

export const putEntityRules = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const traderType = traderTypeFromParam(req.params.traderType);
    const rules = await replaceEntityDocumentRules(traderType, req.body.rules);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Entity document rules updated successfully.',
      data: { traderType, rules },
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryRules = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rules = await listCategoryDocumentRulesByCategoryId(req.params.categoryId);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Category document rules retrieved successfully.',
      data: {
        categoryId: req.params.categoryId,
        rules,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const putCategoryRules = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rules = await replaceCategoryDocumentRules(req.params.categoryId, req.body.rules);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Category document rules updated successfully.',
      data: { categoryId: req.params.categoryId, rules },
    });
  } catch (error) {
    next(error);
  }
};
