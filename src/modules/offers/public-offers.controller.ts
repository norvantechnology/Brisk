import { Response, NextFunction } from 'express';
import { OfferType } from '@prisma/client';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import * as publicOffersService from './public-offers.service';

export const listTraderOffers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await publicOffersService.listPublicOffers(
      OfferType.TRADER,
      req.query as Record<string, unknown>,
      req.user?.id
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader offers retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listBriskOffers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await publicOffersService.listPublicOffers(
      OfferType.PLATFORM,
      req.query as Record<string, unknown>,
      req.user?.id
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Brisk offers retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getTraderOffer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await publicOffersService.getPublicOffer(req.params.id, req.user?.id);
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

export const claimTraderOffer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await publicOffersService.claimOffer(req.user!.id, req.params.id, OfferType.TRADER);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Trader offer claimed successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

/** Alias of claim — maps to Figma "Accept Offer" on offer detail. */
export const acceptTraderOffer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await publicOffersService.claimOffer(req.user!.id, req.params.id, OfferType.TRADER);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Offer accepted. Continue to Post a New Job.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const claimBriskOffer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await publicOffersService.claimOffer(req.user!.id, req.params.id, OfferType.PLATFORM);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Brisk offer claimed successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listMyClaims = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await publicOffersService.listMyClaims(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Claimed offers retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listPromoCodes = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categoryId = (req.query.categoryId ?? req.query.category_id) as string | undefined;
    const data = await publicOffersService.listPromoCodes(categoryId);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Promo codes retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const validatePromoCode = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await publicOffersService.validatePromoCode(
      req.user!.id,
      req.body.code,
      req.body.categoryId
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Promo code is valid.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
