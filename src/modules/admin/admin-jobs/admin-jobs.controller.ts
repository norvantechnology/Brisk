import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as service from './admin-jobs.service';
import type { AdminJobFilters, AdminJobsListQuery } from './admin-jobs.validation';

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
