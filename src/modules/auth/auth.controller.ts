import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendResponse } from '../../utils/apiResponse';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.registerUser(req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: result.message,
      data: { userId: result.userId },
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
      message: 'Logged in successfully.',
      data: result,
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
