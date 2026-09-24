import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import { NotificationListFilters } from '../../notifications/notifications.types';
import { resolveAdminNotificationActionUrl } from '../../notifications/notification-action-urls';

const parsePage = (v?: string) => Math.max(1, Number(v) || 1);
const parseLimit = (v?: string) => Math.max(1, Math.min(100, Number(v) || 20));

export const serializeAdminNotification = (n: {
  id: string;
  type: string;
  title: string;
  message: string;
  payload: Prisma.JsonValue | null;
  actionUrl: string | null;
  read: boolean;
  createdAt: Date;
}) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  message: n.message,
  desc: n.message,
  read: n.read,
  isRead: n.read,
  actionUrl: resolveAdminNotificationActionUrl(n.type, n.actionUrl, n.payload),
  data: n.payload,
  createdAt: n.createdAt,
  timestamp: n.createdAt,
});

export const listAdminNotifications = async (
  adminUserId: string,
  filters: NotificationListFilters
) => {
  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const unreadOnly =
    filters.unreadOnly === true || filters.unreadOnly === 'true';

  const where: Prisma.AdminNotificationWhereInput = { adminUserId };
  if (unreadOnly) where.read = false;
  if (filters.type?.trim()) where.type = filters.type.trim();
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { message: { contains: q, mode: 'insensitive' } },
      { type: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [total, unreadCount, rows] = await Promise.all([
    prisma.adminNotification.count({ where }),
    prisma.adminNotification.count({ where: { adminUserId, read: false } }),
    prisma.adminNotification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
      unreadCount,
    },
    notifications: rows.map(serializeAdminNotification),
  };
};

export const getAdminUnreadCount = async (adminUserId: string) => {
  const count = await prisma.adminNotification.count({
    where: { adminUserId, read: false },
  });
  return { count };
};

export const markAdminNotificationRead = async (adminUserId: string, id: string) => {
  const existing = await prisma.adminNotification.findFirst({
    where: { id, adminUserId },
  });
  if (!existing) throw new NotFoundError('Notification not found.');

  const updated = await prisma.adminNotification.update({
    where: { id },
    data: { read: true },
  });
  return serializeAdminNotification(updated);
};

export const markAllAdminNotificationsRead = async (adminUserId: string) => {
  const result = await prisma.adminNotification.updateMany({
    where: { adminUserId, read: false },
    data: { read: true },
  });
  return { updatedCount: result.count };
};

export const deleteAdminNotification = async (adminUserId: string, id: string) => {
  const existing = await prisma.adminNotification.findFirst({
    where: { id, adminUserId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Notification not found.');
  await prisma.adminNotification.delete({ where: { id } });
  return { deleted: true };
};

/** Create inbox rows for all active admins (or one admin). */
export const createAdminNotifications = async (input: {
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  payload?: Record<string, unknown>;
  adminUserId?: string;
}) => {
  const admins = input.adminUserId
    ? [{ id: input.adminUserId }]
    : await prisma.adminUser.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
        take: 100,
      });

  if (!admins.length) return { createdCount: 0 };

  const result = await prisma.adminNotification.createMany({
    data: admins.map((a) => ({
      adminUserId: a.id,
      type: input.type,
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl ?? null,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    })),
  });
  return { createdCount: result.count };
};
