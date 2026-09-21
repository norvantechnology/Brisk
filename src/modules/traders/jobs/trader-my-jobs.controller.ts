import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import * as service from './trader-my-jobs.service';
import * as tradersService from '../traders.service';

export const listMyJobs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.listMyJobs(req.user!.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'My jobs retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyJobDetail = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.getMyJobDetail(req.user!.id, req.params.id);
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

export const getProcessJobDetail = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.getProcessJobDetail(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Process job details fetched successfully.',
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
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.getJobOutcomeDetail(req.user!.id, req.params.id, 'COMPLETED');
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
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.getJobOutcomeDetail(req.user!.id, req.params.id, 'CANCELLED');
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

export const arriveAtJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.arriveAtJob(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Arrival recorded successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const finishJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.finishJob(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job finished successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const submitJobCompletion = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.submitJobCompletion(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Proof uploaded successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const upsertQuote = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.upsertQuote(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Quote submitted successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const acceptJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.acceptJob(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Job accepted successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listMaterials = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.listMaterials(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Materials retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const addMaterial = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.addMaterial(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Material added successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMaterial = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.deleteMaterial(req.user!.id, req.params.id, req.params.materialId);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Material removed successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const addProofPhoto = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.addProofPhoto(req.user!.id, req.params.id, req.body.photoUrl);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Proof photo added successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listMessages = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.listMessages(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Messages retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.sendMessage(req.user!.id, req.params.id, req.body.message);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Message sent successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentSummary = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.getPaymentSummary(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payment details fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentRequestScreen = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.getPaymentRequestScreen(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payment details fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const requestPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.requestPayment(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payment request sent successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getPartialPaymentScreen = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.getPartialPaymentScreen(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Partial payment details fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const requestPartialPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.requestPartialPayment(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Partial payment request sent successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const completeSiteVisit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.completeSiteVisit(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Site visit completed successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const requestSiteVisitPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.requestSiteVisitPayment(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Site visit payment request sent successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getIncomingLatest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.getIncomingLatest(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: data
        ? 'Incoming job retrieved successfully.'
        : 'No incoming jobs available.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const acceptIncomingJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.acceptIncomingJob(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Incoming job accepted.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const declineIncomingJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await tradersService.ensureTraderProfile(req.user!.id);
    const data = await service.declineIncomingJob(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Incoming job declined.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
