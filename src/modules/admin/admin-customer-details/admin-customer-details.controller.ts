import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as service from './admin-customer-details.service';

export const getStats = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getCustomerDetailsStats(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer details stats retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getVerification = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getCustomerVerification(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer verification status retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listAddresses = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listCustomerAddresses(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer addresses retrieved successfully.',
      data: result.addresses,
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
    const data = await service.getCustomerJobsStats(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer jobs stats retrieved successfully.',
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
    const result = await service.listCustomerJobs(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer jobs retrieved successfully.',
      data: result.jobs,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getJob = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getCustomerJobById(req.params.id, req.params.jobId);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer job detail retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentsStats = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getCustomerPaymentsStats(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer payments stats retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listPayments = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listCustomerPayments(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer payments retrieved successfully.',
      data: result.payments,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const listRefunds = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listCustomerRefunds(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer refunds retrieved successfully.',
      data: result.refunds,
      meta: result.meta,
    });
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
    const data = await service.getCustomerOffersStats(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer offers stats retrieved successfully.',
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
    const result = await service.listCustomerOffers(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer offers retrieved successfully.',
      data: result.offers,
      meta: result.meta,
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
    const data = await service.getCustomerReviewsStats(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer reviews stats retrieved successfully.',
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
    const result = await service.listCustomerReviews(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer reviews retrieved successfully.',
      data: result.reviews,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const listNotifications = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listCustomerNotifications(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer notifications retrieved successfully.',
      data: result.notifications,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationsRead = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.markCustomerNotificationsRead(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer notifications marked as read.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listActivity = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listCustomerActivity(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer activity retrieved successfully.',
      data: result.activity,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const listChats = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listCustomerChats(req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer chats retrieved successfully.',
      data: result.conversations,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getChatThread = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getCustomerChatThread(
      req.params.id,
      req.params.jobId,
      req.query as any
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Customer chat thread retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
