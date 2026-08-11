import { Request, Response, NextFunction } from 'express';
import {
  createConsumerRegistration,
  createTraderRegistration,
} from '../admin/admin-surveys/admin-surveys.service';
import { sendResponse } from '../../utils/apiResponse';

export const createConsumer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const registration = await createConsumerRegistration(req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Survey consumer registration submitted successfully.',
      data: { registration },
    });
  } catch (error) {
    next(error);
  }
};

export const createTrader = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const registration = await createTraderRegistration(req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Survey trader registration submitted successfully.',
      data: { registration },
    });
  } catch (error) {
    next(error);
  }
};
