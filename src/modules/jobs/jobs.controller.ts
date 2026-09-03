import { Response, NextFunction } from 'express';
import { JobStatus } from '@prisma/client';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import * as jobsService from './jobs.service';

export const createJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await jobsService.createJob(req.user!.id, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Job draft created successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listJobs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = req.query.status as JobStatus | undefined;
    const data = await jobsService.listJobs(req.user!.id, status);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Jobs retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await jobsService.getJob(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await jobsService.updateJob(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job updated successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const setJobLocation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await jobsService.setJobLocation(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job location updated successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const publishJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await jobsService.publishJob(req.user!.id, req.params.id, req.body ?? {});
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job published successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
