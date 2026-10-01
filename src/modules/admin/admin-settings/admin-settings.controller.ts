import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as settingsService from '../../settings/platform-settings.service';
import { PlatformSettingGroup } from '../../settings/platform-settings.registry';

export const listSettings = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await settingsService.listPlatformSettings({
      group: req.query.group as PlatformSettingGroup | undefined,
    });
    sendResponse({ res, statusCode: 200, message: 'Settings retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const getSetting = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await settingsService.getPlatformSettingDetail(req.params.key);
    sendResponse({ res, statusCode: 200, message: 'Setting retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await settingsService.updatePlatformSettings(req.body.settings, {
      id: req.adminUser!.id,
      fullName: req.adminUser!.fullName,
    });
    sendResponse({ res, statusCode: 200, message: 'Settings updated successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const resetSetting = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await settingsService.resetPlatformSetting(req.params.key, {
      id: req.adminUser!.id,
      fullName: req.adminUser!.fullName,
    });
    sendResponse({ res, statusCode: 200, message: 'Setting reset to default.', data });
  } catch (error) {
    next(error);
  }
};
