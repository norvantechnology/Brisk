import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as service from './admin-trader-details.service';
import type { TraderSiteVisitListQuery } from '../../site-visits/site-visits.service';

export const getDocumentsStats = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getTraderDocumentsStats(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader document stats retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listDocuments = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listTraderDocuments(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader documents retrieved successfully.',
      data: result.documents,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getJobsStats = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getTraderJobsStats(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader jobs stats retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listJobs = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listTraderJobs(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader jobs retrieved successfully.',
      data: result.jobs,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const listSiteVisits = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.listTraderSiteVisitRequests(
      req.params.id,
      req.query as TraderSiteVisitListQuery
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader site visits retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getReviewsStats = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getTraderReviewsStats(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader reviews stats retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listReviews = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listTraderReviews(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader reviews retrieved successfully.',
      data: result.reviews,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getEarningsSummary = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getTraderEarningsSummary(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader earnings summary retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listPayouts = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listTraderPayouts(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader payouts retrieved successfully.',
      data: result.payouts,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const createPayout = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const data = await service.createTraderPayout(req.adminUser!.id, adminLabel, req.params.id, req.body);
    sendResponse({ res, statusCode: 201, message: 'Payout sent successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const getOffersStats = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getTraderOffersStats(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader offers stats retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listOffers = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listTraderOffers(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader offers retrieved successfully.',
      data: result.offers,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};
