import { Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import * as propertyService from './property.service';

export const getMeterHelpTips = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    sendResponse({
      res,
      statusCode: 200,
      message: 'Meter help tips retrieved successfully.',
      data: propertyService.getMeterHelpTips(),
    });
  } catch (error) {
    next(error);
  }
};

export const listAddresses = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await propertyService.listAddresses(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Addresses retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getAddress = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await propertyService.getAddress(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Address retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const createAddress = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await propertyService.createAddress(req.user!.id, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Address created successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAddress = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await propertyService.updateAddress(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Address updated successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await propertyService.deleteAddress(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Address deleted successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listProperties = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await propertyService.listProperties(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Properties retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getPropertyDetail = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await propertyService.getPropertyDetail(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Property details retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const submitMeterReading = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await propertyService.submitMeterReading(req.user!.id, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Meter reading submitted successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listUtilityProviders = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await propertyService.listUtilityProviders();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Utility providers retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const savePropertySubscriptions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await propertyService.savePropertySubscriptions(
      req.user!.id,
      req.params.id,
      req.body.providerIds
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Subscriptions saved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const removePropertySubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await propertyService.removePropertySubscription(
      req.user!.id,
      req.params.id,
      req.params.subscriptionId
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Subscription cancelled successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
