import { Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import * as checkoutService from './checkout.service';
import type { PaymentHistoryQuery } from './checkout.validation';

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
      message: data.alreadyApplied
        ? 'Promo code already applied.'
        : 'Promo code applied successfully.',
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
    const data = await checkoutService.confirmPayment(req.user!.id, req.params.id);
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

export const listPaymentHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, meta } = await checkoutService.listPaymentHistory(
      req.user!.id,
      req.query as unknown as PaymentHistoryQuery
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Transaction history retrieved successfully.',
      data,
      meta,
    });
  } catch (error) {
    next(error);
  }
};

/** Streams receipt PDF — Content-Type application/pdf (not JSON). */
export const downloadInvoiceReceipt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { buffer, filename } = await checkoutService.downloadInvoiceReceiptPdf(
      req.user!,
      req.params.id
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).send(buffer);
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
