import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { NotificationListFilters } from './notifications.types';
import { resolveUserNotificationActionUrl } from './notification-action-urls';
import { USER_NOTIFICATION_TYPE_CATALOG } from './notification-types';

const parsePage = (v?: string) => Math.max(1, Number(v) || 1);
const parseLimit = (v?: string) => Math.max(1, Math.min(100, Number(v) || 20));

const asPayload = (payload: Prisma.JsonValue | null): Record<string, unknown> => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
};

export const serializeUserNotification = (n: {
  id: string;
  type: string;
  payload: Prisma.JsonValue | null;
  read: boolean;
  createdAt: Date;
}) => {
  const payload = asPayload(n.payload);
  const title =
    (typeof payload.title === 'string' && payload.title) ||
    n.type.replace(/_/g, ' ');
  const message =
    (typeof payload.message === 'string' && payload.message) ||
    (typeof payload.body === 'string' && payload.body) ||
    (typeof payload.desc === 'string' && payload.desc) ||
    '';

  return {
    id: n.id,
    type: n.type,
    title,
    message,
    read: n.read,
    actionUrl: resolveUserNotificationActionUrl(n.type, payload),
    data: payload,
    createdAt: n.createdAt,
  };
};

/** Filter catalog for Trader/Customer FE — known types + counts for this user. */
export const listUserNotificationTypes = async (userId: string) => {
  const grouped = await prisma.notification.groupBy({
    by: ['type'],
    where: { userId },
    _count: { _all: true },
  });
  const unreadGrouped = await prisma.notification.groupBy({
    by: ['type'],
    where: { userId, read: false },
    _count: { _all: true },
  });
  const countByType = new Map(grouped.map((g) => [g.type, g._count._all]));
  const unreadByType = new Map(unreadGrouped.map((g) => [g.type, g._count._all]));

  const known = new Set(USER_NOTIFICATION_TYPE_CATALOG.map((t) => t.type));
  const types = [
    ...USER_NOTIFICATION_TYPE_CATALOG.map((t) => ({
      ...t,
      count: countByType.get(t.type) ?? 0,
      unreadCount: unreadByType.get(t.type) ?? 0,
    })),
    ...grouped
      .filter((g) => !known.has(g.type))
      .map((g) => ({
        type: g.type,
        label: g.type.replace(/_/g, ' '),
        category: 'other',
        description: 'Additional notification type.',
        count: g._count._all,
        unreadCount: unreadByType.get(g.type) ?? 0,
      })),
  ];

  return { types };
};

export const listUserNotifications = async (
  userId: string,
  filters: NotificationListFilters
) => {
  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const unreadOnly =
    filters.unreadOnly === true || filters.unreadOnly === 'true';

  const where: Prisma.NotificationWhereInput = { userId };
  if (unreadOnly) where.read = false;
  if (filters.type?.trim()) where.type = filters.type.trim();
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { type: { contains: q, mode: 'insensitive' } },
      // JSON search is limited — type match covers most filters
    ];
  }

  const [total, unreadCount, rows] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.notification.findMany({
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
    notifications: rows.map(serializeUserNotification),
  };
};

export const getUserUnreadCount = async (userId: string) => {
  const count = await prisma.notification.count({
    where: { userId, read: false },
  });
  return { count };
};

export const markUserNotificationRead = async (userId: string, id: string) => {
  const existing = await prisma.notification.findFirst({
    where: { id, userId },
  });
  if (!existing) throw new NotFoundError('Notification not found.');

  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true },
  });
  return serializeUserNotification(updated);
};

export const markAllUserNotificationsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return { updatedCount: result.count };
};

export const deleteUserNotification = async (userId: string, id: string) => {
  const existing = await prisma.notification.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Notification not found.');
  await prisma.notification.delete({ where: { id } });
  return { deleted: true };
};
