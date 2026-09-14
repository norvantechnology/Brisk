import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import * as service from './trader-jobs.service';
import * as tradersService from '../traders.service';

export const listDiscoverJobs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const jobs = await service.listDiscoverJobs(req.user!.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Nearby opportunities retrieved successfully.',
      data: jobs,
    });
  } catch (error) {
    next(error);
  }
};

export const getDiscoverJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.getDiscoverJob(req.user!.id, req.params.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job details retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const bookmarkDiscoverJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.bookmarkDiscoverJob(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job bookmarked successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const unbookmarkDiscoverJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.unbookmarkDiscoverJob(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job bookmark removed successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
