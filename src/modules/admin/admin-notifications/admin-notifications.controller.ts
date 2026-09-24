import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as service from './admin-notifications.service';

export const listNotifications = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.listAdminNotifications(req.adminUser!.id, req.query as any);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Admin notifications retrieved successfully.',
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
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getAdminUnreadCount(req.adminUser!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Unread admin notification count retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const notification = await service.markAdminNotificationRead(
      req.adminUser!.id,
      req.params.id
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Admin notification marked as read.',
      data: { notification },
    });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.markAllAdminNotificationsRead(req.adminUser!.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'All admin notifications marked as read.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.deleteAdminNotification(req.adminUser!.id, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Admin notification deleted successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
