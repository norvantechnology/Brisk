import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as offerAdminService from './admin-offers.service';
import { OfferStatus } from '@prisma/client';

const adminLabel = (req: AuthenticatedAdminRequest) =>
  `${req.adminUser!.fullName} (${req.adminUser!.role})`;

export const getStats = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await offerAdminService.getOfferStats();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Offer stats retrieved successfully.',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const listOffers = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await offerAdminService.listOffers(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Offers retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getOffer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await offerAdminService.getOfferById(req.params.id);
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

export const createOffer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await offerAdminService.createPlatformOffer(
      req.adminUser!.id,
      adminLabel(req),
      req.body
    );
    sendResponse({
      res,
      statusCode: 201,
      message: 'Platform offer created successfully.',
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};

export const updateOffer = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await offerAdminService.updateOffer(
      req.adminUser!.id,
      adminLabel(req),
      req.params.id,
      req.body
    );
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

export const updateOfferStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await offerAdminService.updateOfferStatus(
      req.adminUser!.id,
      adminLabel(req),
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

export const getAnalytics = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await offerAdminService.getOfferAnalytics();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Offer analytics retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
