import { Response, NextFunction } from 'express';
import { JobStatus } from '@prisma/client';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import * as jobsService from './jobs.service';
import * as myJobService from './jobs.my-job.service';
import { downloadCustomerJobInvoicePdf } from '../traders/jobs/trader-my-jobs.service';

type Handler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
const respond =
  (
    statusCode: number,
    message: string,
    run: (req: AuthenticatedRequest) => Promise<unknown>
  ): Handler =>
  async (req, res, next) => {
    try {
      sendResponse({ res, statusCode, message, data: await run(req) });
    } catch (error) {
      next(error);
    }
  };

export const getJobQuoteDetail = respond(200, 'Quotation retrieved successfully.', (req) =>
  myJobService.getJobQuoteDetail(req.user!.id, req.params.id, req.params.quoteId, req.query as unknown as { reviewsLimit: number })
);

export const getJobProgress = respond(200, 'Job progress retrieved successfully.', (req) =>
  myJobService.getJobProgress(req.user!.id, req.params.id)
);

export const rescheduleJob = respond(200, 'Job rescheduled successfully.', (req) =>
  myJobService.rescheduleJob(req.user!.id, req.params.id, req.body)
);

export const submitJobReview = respond(201, 'Thank you! Your review has been submitted.', (req) =>
  myJobService.submitJobReview(req.user!.id, req.params.id, req.body)
);

export const confirmJobCompletion = respond(200, 'Job completion confirmed. Thank you!', (req) =>
  myJobService.confirmJobCompletion(req.user!.id, req.params.id)
);

export const createJobDispute = respond(201, 'Dispute submitted successfully.', (req) =>
  myJobService.createJobDispute(req.user!.id, req.params.id, req.body)
);

export const listJobDisputes = respond(200, 'Job disputes retrieved successfully.', (req) =>
  myJobService.listJobDisputes(req.user!.id, req.params.id)
);

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

export const listMyJobsByTab = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await jobsService.listMyJobsByTab(
      req.user!.id,
      req.query as unknown as { tab: jobsService.CustomerJobsTab; page: number; limit: number }
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'My jobs retrieved successfully.',
      data: result.items,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

/** Streams invoice PDF — Content-Type application/pdf (not JSON). */
export const downloadJobInvoice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { buffer, filename } = await downloadCustomerJobInvoicePdf(req.user!.id, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).send(buffer);
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

export const getCompletedJobDetail = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await jobsService.getJobOutcomeDetail(req.user!.id, req.params.id, 'COMPLETED');
    sendResponse({
      res,
      statusCode: 200,
      message: 'Completed job details fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getCancelledJobDetail = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await jobsService.getJobOutcomeDetail(req.user!.id, req.params.id, 'CANCELLED');
    sendResponse({
      res,
      statusCode: 200,
      message: 'Cancelled job details fetched successfully.',
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

export const getJobFormConfig = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await jobsService.getJobFormConfig(req.user!.id, req.query as {
      categoryId?: string;
      subcategoryId?: string;
      offerId?: string;
      entryPoint?: 'OFFER' | 'HOME_CATEGORY' | 'HOME_SUBCATEGORY' | 'DIRECT' | 'TRADER_PROFILE';
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job form config retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listJobQuotes = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await jobsService.listJobQuotes(req.user!.id, req.params.id);
    sendResponse({ res, statusCode: 200, message: 'Quotations fetched successfully.', data });
  } catch (error) {
    next(error);
  }
};

/** Customer accepts a trader quotation → trader gets `job:accept` sheet to confirm. */
export const acceptJobQuote = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { confirmQuoteAssignment } = await import(
      '../traders/jobs/trader-my-jobs.service'
    );
    const data = await confirmQuoteAssignment({
      customerId: req.user!.id,
      jobId: req.params.id,
      quoteId: req.params.quoteId,
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Quotation accepted. Waiting for the trader to confirm.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await jobsService.cancelJob(req.user!.id, req.params.id, req.body?.reason);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job cancelled successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const confirmSiteVisitProposal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await jobsService.confirmSiteVisitProposal(
      req.user!.id,
      req.params.id,
      req.params.requestId
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Site visit confirmed successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectSiteVisitProposal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await jobsService.rejectSiteVisitProposal(
      req.user!.id,
      req.params.id,
      req.params.requestId
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Site visit rejected. Trader must propose a new date.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
