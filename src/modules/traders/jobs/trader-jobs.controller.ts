import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import * as service from './trader-jobs.service';
import * as myJobsService from './trader-my-jobs.service';
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

export const getSiteVisitSlots = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.getSiteVisitSlots(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Site visit slots retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const requestSiteVisit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.requestSiteVisit(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Site visit requested successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const rescheduleSiteVisit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.rescheduleSiteVisit(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Site visit reschedule requested successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

/** Submit quote from Discover Job Details (same as My Jobs quotes). */
export const submitDiscoverQuote = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await myJobsService.upsertQuote(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: data.hasSubmittedQuote && data.canUpdateQuote
        ? 'Quote submitted successfully.'
        : 'Quote submitted successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

/** Request / Accept Job — waiting for customer confirmation (stays on Discover). */
export const requestDiscoverJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.requestDiscoverJob(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job requested. Waiting for customer confirmation.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

/** Home Active/Waiting (blue) cards — awaiting customer confirmation. */
export const listWaitingJobs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.listWaitingJobs(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Waiting jobs retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
