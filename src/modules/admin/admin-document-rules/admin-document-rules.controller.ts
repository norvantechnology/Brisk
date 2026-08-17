import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import {
  listEntityDocumentRules,
  listCategoryDocumentRulesByCategoryId,
  replaceEntityDocumentRules,
  replaceCategoryDocumentRules,
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
