import { Request, Response, NextFunction } from 'express';
import * as adminAuthService from './admin-auth.service';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    const result = await adminAuthService.loginAdmin(email, password);

    sendResponse({
      res,
      statusCode: 200,
      message: 'Admin logged in successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    const tokens = await adminAuthService.refreshAdminToken(refreshToken);

    sendResponse({
      res,
      statusCode: 200,
      message: 'Admin session refreshed successfully.',
      data: { tokens },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const profile = await adminAuthService.getAdminProfile(adminId);

    sendResponse({
      res,
      statusCode: 200,
      message: 'Admin profile retrieved successfully.',
      data: { admin: profile },
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const { oldPassword, newPassword } = req.body;
    await adminAuthService.changeAdminPassword(adminId, oldPassword, newPassword);

    sendResponse({
      res,
      statusCode: 200,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    sendResponse({
      res,
      statusCode: 200,
      message: 'Admin logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};
