import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.registerUser(req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.verifyUserOtp(req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const resendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.resendUserOtp(req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.loginUser(req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.refreshUserSession(req.body.refreshToken);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Session token refreshed successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await authService.getAuthenticatedUser(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Profile retrieved successfully.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.logoutUser();
    sendResponse({
      res,
      statusCode: 200,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.forgotPassword(req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.resetPassword(req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};
