import { Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import * as service from './notifications.service';
import { registerDeviceToken, removeDeviceToken, sendTestPush } from '../../services/push.service';

export const listNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listUserNotifications(req.user!.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Notifications retrieved successfully.',
      data: {
        notifications: result.notifications,
        unreadCount: result.meta.unreadCount,
        unreadByTab: result.meta.unreadByTab,
        sections: result.sections,
      },
      meta: {
        total: result.meta.total,
        page: result.meta.page,
        limit: result.meta.limit,
        totalPages: result.meta.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const registerDevice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const device = await registerDeviceToken(req.user!.id, req.body.token, req.body.platform);
    sendResponse({ res, statusCode: 200, message: 'Device registered for push notifications.', data: { device } });
  } catch (error) {
    next(error);
  }
};

export const testPush = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await sendTestPush(req.user!.id);
    const message = !data.pushEnabled
      ? 'Push notifications are not configured on the server.'
      : !data.devicesCount
        ? 'No device registered for this account. Call POST /notifications/devices first.'
        : `Test notification sent to ${data.sentCount} of ${data.devicesCount} device(s).`;
    sendResponse({ res, statusCode: 200, message, data });
  } catch (error) {
    next(error);
  }
};

export const unregisterDevice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await removeDeviceToken(req.user!.id, req.body.token);
    sendResponse({ res, statusCode: 200, message: 'Device unregistered from push notifications.', data });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getUserUnreadCount(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Unread notification count retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listTypes = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.listUserNotificationTypes(req.user!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Notification types retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const notification = await service.markUserNotificationRead(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Notification marked as read.',
      data: { notification },
    });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.markAllUserNotificationsRead(
      req.user!.id,
      req.query.tab as string | undefined
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'All notifications marked as read.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.deleteUserNotification(req.user!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Notification deleted successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
