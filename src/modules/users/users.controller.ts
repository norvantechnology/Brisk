import { Response, NextFunction } from 'express';
import * as usersService from './users.service';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const profile = await usersService.getUserProfile(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Profile retrieved successfully.',
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

export const getStats = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await usersService.getUserStats(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Profile stats retrieved successfully.',
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const profile = await usersService.updateUserProfile(req.user!.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Profile updated successfully.',
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

export const deactivateAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await usersService.deactivateUserAccount(req.user!.id, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
