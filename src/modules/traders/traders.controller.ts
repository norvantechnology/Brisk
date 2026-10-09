import { Response, NextFunction } from 'express';
import * as tradersService from './traders.service';
import * as onboardingService from './onboarding/onboarding.service';
import { listExpiringDocuments } from './trader-document-expiry.service';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import type { MyReviewsQuery } from './traders.validation';

export const getMyTraderProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const profile = await tradersService.getTraderProfile(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader profile retrieved successfully.',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyTraderProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const trader = await tradersService.updateTraderProfile(req.user!.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader profile updated successfully.',
      data: trader,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const profile = await tradersService.updateTraderAccount(req.user!.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Account updated successfully.',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyPersonalInfo = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    await onboardingService.saveSoloProfile(req.user!.id, req.body, { allowAfterSubmit: true });
    const profile = await tradersService.getTraderProfile(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Personal information updated successfully.',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyCompanyInfo = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    await onboardingService.saveCompanyProfile(req.user!.id, req.body, { allowAfterSubmit: true });
    const profile = await tradersService.getTraderProfile(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Company information updated successfully.',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyBankDetails = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const profile = await tradersService.updateTraderBankDetails(req.user!.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Bank details updated successfully.',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyDocuments = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await onboardingService.uploadDocument(req.user!.id, req.body, {
      allowAfterSubmit: true,
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Document uploaded successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const removeMyDocument = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await onboardingService.removeDocument(req.user!.id, req.params.documentRuleId, {
      allowAfterSubmit: true,
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Document removed successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyCategories = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await onboardingService.saveCategories(req.user!.id, req.body, {
      allowAfterSubmit: true,
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Categories updated successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const setMyCategoryActive = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await onboardingService.setTraderCategoryActive(
      req.user!.id,
      req.params.categoryId,
      req.body.isActive
    );
    sendResponse({
      res,
      statusCode: 200,
      message: req.body.isActive ? 'Category activated.' : 'Category deactivated.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyExpiringDocuments = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await listExpiringDocuments(
      req.user!.id,
      req.query.withinDays as number | undefined
    );
    sendResponse({ res, statusCode: 200, message: 'Expiring documents retrieved.', data });
  } catch (error) {
    next(error);
  }
};

export const getFeaturedTraders = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await tradersService.listFeaturedTraders(
      req.query as { traderLimit?: number; categoryId?: string; trendingLimit?: number }
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Featured traders retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyReviews = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { summary, items, meta } = await tradersService.listMyReviews(
      req.user!.id,
      req.query as MyReviewsQuery
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Reviews retrieved successfully.',
      data: { summary, items },
      meta,
    });
  } catch (error) {
    next(error);
  }
};
