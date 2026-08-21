import { Response, NextFunction } from 'express';
import { OfferStatus } from '@prisma/client';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import * as traderOffersService from './trader-offers.service';

export const listMyOffers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await traderOffersService.listMyOffers(req.user!.id, req.query as Record<string, unknown>);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Your offers retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyOffer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await traderOffersService.getMyOffer(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Offer retrieved successfully.',
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};

export const createMyOffer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await traderOffersService.createMyOffer(req.user!.id, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Trader offer created successfully.',
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyOffer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await traderOffersService.updateMyOffer(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Offer updated successfully.',
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyOfferStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await traderOffersService.updateMyOfferStatus(
      req.user!.id,
      req.params.id,
      req.body.status as OfferStatus
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Offer status updated successfully.',
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMyOffer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await traderOffersService.deleteMyOffer(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Offer deleted successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
