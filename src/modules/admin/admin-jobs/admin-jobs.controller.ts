import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as service from './admin-jobs.service';
import type { AdminDisputesListQuery, AdminJobFilters, AdminJobsListQuery } from './admin-jobs.validation';

export const getStats = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await service.getAdminJobsStats(req.query as unknown as AdminJobFilters);
    sendResponse({ res, statusCode: 200, message: 'Jobs stats retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const listJobs = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await service.listAdminJobs(req.query as unknown as AdminJobsListQuery);
    sendResponse({ res, statusCode: 200, message: 'Jobs retrieved successfully.', data: result.jobs, meta: result.meta });
  } catch (error) {
    next(error);
  }
};

export const getJob = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await service.getAdminJob(req.params.id);
    sendResponse({ res, statusCode: 200, message: 'Job detail retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const getJobChat = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await service.getAdminJobChat(req.params.id, req.query as { page?: number; limit?: number });
    sendResponse({ res, statusCode: 200, message: 'Job chat history retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const listDisputes = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await service.listAdminDisputes(req.query as unknown as AdminDisputesListQuery);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Disputes retrieved successfully.',
      data: { items: result.items, stats: result.stats },
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getDispute = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await service.getAdminDispute(req.params.id);
    sendResponse({ res, statusCode: 200, message: 'Dispute retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const updateDispute = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await service.updateAdminDispute(req.params.id, req.body);
    sendResponse({ res, statusCode: 200, message: 'Dispute updated successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const getJobSiteVisits = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getAdminJobSiteVisits(req.params.id);
    sendResponse({ res, statusCode: 200, message: 'Job site visit requests retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

const adminActor = (req: AuthenticatedAdminRequest) => ({
  id: req.adminUser!.id,
  label: req.adminUser!.fullName || req.adminUser!.email,
});

export const cancelJob = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await service.adminCancelJob(req.params.id, req.body.reason, adminActor(req));
    sendResponse({ res, statusCode: 200, message: 'Job cancelled successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const rescheduleJob = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await service.adminRescheduleJob(req.params.id, req.body, adminActor(req));
    sendResponse({ res, statusCode: 200, message: 'Job rescheduled successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const setJobArchived = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await service.adminSetJobArchived(req.params.id, req.body.archived, adminActor(req));
    sendResponse({
      res,
      statusCode: 200,
      message: req.body.archived ? 'Job archived successfully.' : 'Job unarchived successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
