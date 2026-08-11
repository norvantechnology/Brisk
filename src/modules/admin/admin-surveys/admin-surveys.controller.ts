import { Response, NextFunction } from 'express';
import * as surveyAdminService from './admin-surveys.service';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';

export const getConsumerStats = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await surveyAdminService.getConsumerStats();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Survey consumer stats retrieved successfully.',
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

export const listConsumers = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await surveyAdminService.listConsumers(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Survey consumer registrations retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getConsumer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const registration = await surveyAdminService.getConsumerById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Survey consumer registration retrieved successfully.',
      data: { registration },
    });
  } catch (error) {
    next(error);
  }
};

export const updateConsumer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const registration = await surveyAdminService.updateConsumer(
      adminId,
      adminLabel,
      req.params.id,
      req.body
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Survey consumer registration updated successfully.',
      data: { registration },
    });
  } catch (error) {
    next(error);
  }
};

export const exportConsumers = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const csv = await surveyAdminService.exportConsumersCsv(req.query);
    const filename = `survey-consumer-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

export const getTraderStats = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await surveyAdminService.getTraderStats();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Survey trader stats retrieved successfully.',
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

export const listTraders = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await surveyAdminService.listTraders(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Survey trader registrations retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getTrader = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const registration = await surveyAdminService.getTraderById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Survey trader registration retrieved successfully.',
      data: { registration },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTrader = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const registration = await surveyAdminService.updateTrader(
      adminId,
      adminLabel,
      req.params.id,
      req.body
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Survey trader registration updated successfully.',
      data: { registration },
    });
  } catch (error) {
    next(error);
  }
};

export const exportTraders = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const csv = await surveyAdminService.exportTradersCsv(req.query);
    const filename = `survey-trader-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
