import { Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import * as service from './notifications.service';

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
    const data = await service.markAllUserNotificationsRead(req.user!.id);
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
