import { Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import * as checkoutService from './checkout.service';

export const getInvoice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await checkoutService.getInvoice(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Invoice retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const applyPromo = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await checkoutService.applyPromo(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Promo code applied successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const createPaymentIntent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await checkoutService.createPaymentIntent(req.user!.id, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Payment intent created successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const confirmPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await checkoutService.confirmPayment(
      req.user!.id,
      req.params.id,
      req.body ?? {}
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payment confirmed successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const failPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await checkoutService.failPayment(
      req.user!.id,
      req.params.id,
      req.body ?? {}
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payment marked as failed.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentReceipt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await checkoutService.getPaymentReceipt(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Payment receipt retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getBooking = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await checkoutService.getBooking(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Booking retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
