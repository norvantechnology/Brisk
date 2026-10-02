import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { NotificationListFilters } from './notifications.types';
import { resolveUserNotificationActionUrl } from './notification-action-urls';
import {
  BRISK_TAB_TYPES,
  USER_NOTIFICATION_SECTIONS,
  USER_NOTIFICATION_TABS,
  USER_NOTIFICATION_TAB_LABELS,
  USER_NOTIFICATION_TYPE_CATALOG,
  type UserNotificationTab,
  userNotificationMeta,
} from './notification-types';

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
    ...userNotificationMeta(n.type),
    title,
    message,
    read: n.read,
    actionUrl: resolveUserNotificationActionUrl(n.type, payload),
    data: payload,
    createdAt: n.createdAt,
  };
};

export type SerializedUserNotification = ReturnType<typeof serializeUserNotification>;

const KNOWN_TYPES = USER_NOTIFICATION_TYPE_CATALOG.map((t) => t.type);

const parseTab = (v?: string): UserNotificationTab | undefined => {
  const tab = v?.trim().toUpperCase();
  return USER_NOTIFICATION_TABS.find((t) => t === tab);
};

/** Regular = everything not in BRISK (so unknown/future types are never hidden). */
const tabWhere = (tab?: UserNotificationTab): Prisma.NotificationWhereInput =>
  tab === 'BRISK'
    ? { type: { in: BRISK_TAB_TYPES } }
    : tab === 'REGULAR'
      ? { type: { notIn: BRISK_TAB_TYPES } }
      : {};

const sectionWhere = (section?: string): Prisma.NotificationWhereInput => {
  const key = section?.trim().toUpperCase();
  if (!key) return {};
  if (key === 'OTHER') return { type: { notIn: KNOWN_TYPES } };
  return {
    type: { in: USER_NOTIFICATION_TYPE_CATALOG.filter((t) => t.section === key).map((t) => t.type) },
  };
};

const unreadByTab = async (userId: string): Promise<Record<UserNotificationTab, number>> => {
  const [brisk, total] = await Promise.all([
    prisma.notification.count({ where: { userId, read: false, ...tabWhere('BRISK') } }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { REGULAR: total - brisk, BRISK: brisk };
};

/** Group a page of notifications under their section headers (display order). */
const groupBySection = (items: SerializedUserNotification[]) =>
  USER_NOTIFICATION_SECTIONS.map((s) => ({
    key: s.key,
    title: s.title,
    tab: s.tab,
    notifications: items.filter((n) => n.section === s.key),
  })).filter((s) => s.notifications.length > 0);

/** Filter catalog for Trader/Customer FE — known types + counts for this user. */
export const listUserNotificationTypes = async (userId: string) => {
  const [grouped, unreadGrouped] = await Promise.all([
    prisma.notification.groupBy({ by: ['type'], where: { userId }, _count: { _all: true } }),
    prisma.notification.groupBy({
      by: ['type'],
      where: { userId, read: false },
      _count: { _all: true },
    }),
  ]);
  const countByType = new Map(grouped.map((g) => [g.type, g._count._all]));
  const unreadByType = new Map(unreadGrouped.map((g) => [g.type, g._count._all]));

  const known = new Set(KNOWN_TYPES);
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
        ...userNotificationMeta(g.type),
        audience: 'ALL' as const,
        count: g._count._all,
        unreadCount: unreadByType.get(g.type) ?? 0,
      })),
  ];

  const tabs = USER_NOTIFICATION_TABS.map((tab) => ({
    key: tab,
    label: USER_NOTIFICATION_TAB_LABELS[tab],
    unreadCount: types.filter((t) => t.tab === tab).reduce((s, t) => s + t.unreadCount, 0),
    sections: USER_NOTIFICATION_SECTIONS.filter((s) => s.tab === tab).map((s) => ({
      key: s.key,
      title: s.title,
      types: types.filter((t) => t.section === s.key).map((t) => t.type),
    })),
  }));

  return { types, tabs };
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

  const and: Prisma.NotificationWhereInput[] = [
    tabWhere(parseTab(filters.tab)),
    sectionWhere(filters.section),
  ];
  const where: Prisma.NotificationWhereInput = { userId, AND: and };
  if (unreadOnly) where.read = false;
  if (filters.type?.trim()) where.type = filters.type.trim();
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { type: { contains: q, mode: 'insensitive' } },
      // JSON search is limited — type match covers most filters
    ];
  }

  const [total, unread, rows] = await Promise.all([
    prisma.notification.count({ where }),
    unreadByTab(userId),
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const notifications = rows.map(serializeUserNotification);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
      unreadCount: unread.REGULAR + unread.BRISK,
      unreadByTab: unread,
    },
    notifications,
    sections: groupBySection(notifications),
  };
};

export const getUserUnreadCount = async (userId: string) => {
  const byTab = await unreadByTab(userId);
  return { count: byTab.REGULAR + byTab.BRISK, byTab };
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

/** Optional `tab` scopes "Mark all as read" to the visible tab. */
export const markAllUserNotificationsRead = async (userId: string, tab?: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false, ...tabWhere(parseTab(tab)) },
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

const CREATE_BATCH = 1000;

/**
 * Persist one notification per user. With `dedupeKey`, users who already have
 * the same (type, dedupeKey) are skipped (webhook retries, re-publish).
 */
export const createUserNotifications = async (
  userIds: string[],
  input: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    dedupeKey?: string;
  }
): Promise<Array<{ userId: string; notification: SerializedUserNotification }>> => {
  const targets = [...new Set(userIds.filter(Boolean))];
  if (!targets.length) return [];

  const payload = JSON.parse(
    JSON.stringify({
      ...(input.data ?? {}),
      title: input.title,
      message: input.message,
      ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
    })
  ) as Prisma.InputJsonObject;

  const insert = async (tx: Prisma.TransactionClient, userIds: string[]) => {
    const out: Array<{ userId: string; notification: SerializedUserNotification }> = [];
    for (let i = 0; i < userIds.length; i += CREATE_BATCH) {
      const rows = await tx.notification.createManyAndReturn({
        data: userIds.slice(i, i + CREATE_BATCH).map((userId) => ({
          userId,
          type: input.type,
          payload,
        })),
      });
      for (const r of rows) out.push({ userId: r.userId, notification: serializeUserNotification(r) });
    }
    return out;
  };

  if (!input.dedupeKey) return insert(prisma, targets);

  const dedupeKey = input.dedupeKey;
  // Advisory lock per (type, key): concurrent retries can't both pass the "already sent" check.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.type}:${dedupeKey}`}))::text`;
    const existing = await tx.notification.findMany({
      where: {
        type: input.type,
        userId: { in: targets },
        payload: { path: ['dedupeKey'], equals: dedupeKey },
      },
      select: { userId: true },
    });
    const done = new Set(existing.map((e) => e.userId));
    return insert(
      tx,
      targets.filter((id) => !done.has(id))
    );
  });
};
