import type { Server as SocketServer } from 'socket.io';
import {
  TraderOnboardingStatus,
  VerificationStatus,
} from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { getPlatformSetting } from '../modules/settings/platform-settings.service';
import { createUserNotifications } from '../modules/notifications/notifications.service';
import { userNotificationMeta } from '../modules/notifications/notification-types';
import { getCurrencyMeta } from '../services/currency.service';
import { sendPushToUsers } from '../services/push.service';
import {
  RealtimeEvents,
  type InvoiceRealtimePayload,
  type JobRealtimePayload,
  type PaymentRealtimePayload,
  type PaymentRequestRealtimePayload,
  type QuoteRealtimePayload,
  type RealtimeEventName,
  type RefundRealtimePayload,
} from './events';

let io: SocketServer | null = null;

const DUBLIN_ORIGIN = { lat: 53.3498, lng: -6.2603 };

export const setRealtimeServer = (server: SocketServer) => {
  io = server;
};

export const getRealtimeServer = () => io;

const roomUser = (userId: string) => `user:${userId}`;
const roomJob = (jobId: string) => `job:${jobId}`;
const roomBooking = (bookingId: string) => `booking:${bookingId}`;
/** All verified traders listening for Discover updates */
const roomTradersDiscover = () => 'traders:discover';
/** Traders subscribed to a trade category */
const roomTraderCategory = (categoryId: string) => `traders:category:${categoryId}`;

/** Safe emit — never throws into REST handlers. Same socket in multiple rooms gets one delivery. */
const emit = (
  event: RealtimeEventName,
  rooms: string[],
  payload: Record<string, unknown>
) => {
  if (!io) return;
  try {
    const unique = [...new Set(rooms.filter(Boolean))];
    if (!unique.length) return;
    // Socket.IO: chained .to() = union (OR) of rooms
    let target = io.to(unique[0]);
    for (let i = 1; i < unique.length; i++) {
      target = target.to(unique[i]);
    }
    target.emit(event, payload);
  } catch (err) {
    logger.warn('Realtime emit failed', { event, err });
  }
};

export type UserNotificationPush = {
  /** Inbox type (see USER_NOTIFICATION_TYPE_CATALOG). */
  type: string;
  title: string;
  message: string;
  /** Stored in the inbox row (`notification.data`) — ids for mobile navigation. */
  data?: Record<string, unknown>;
  /** Legacy socket `type` / `data` kept for existing listeners (e.g. `job:accept` + sheet). */
  legacyEvent?: string;
  legacyData?: Record<string, unknown>;
  at?: string;
  dedupeKey?: string;
};

/**
 * Single path for user notifications: persist to the inbox (GET /notifications)
 * and emit `notification:new` so list + live toast never differ. Never throws.
 */
export const pushUserNotification = async (
  userIds: Array<string | null | undefined>,
  input: UserNotificationPush
) => {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return;
  const at = input.at ?? new Date().toISOString();

  let persisted: Awaited<ReturnType<typeof createUserNotifications>> | null = null;
  try {
    persisted = await createUserNotifications(ids, {
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data,
      dedupeKey: input.dedupeKey,
    });
  } catch (err) {
    logger.warn('Notification persist failed', { type: input.type, err: String(err) });
  }

  const byUser = new Map((persisted ?? []).map((p) => [p.userId, p.notification]));
  const meta = userNotificationMeta(input.type);
  const pushItems: Parameters<typeof sendPushToUsers>[0] = [];
  for (const userId of ids) {
    const notification = byUser.get(userId);
    // Deduped (already notified) — skip the duplicate toast too.
    if (persisted && !notification) continue;
    pushItems.push({
      userId,
      payload: {
        title: input.title,
        body: input.message,
        data: {
          ...(input.data ?? {}),
          type: input.type,
          tab: meta.tab,
          section: meta.section,
          ...(notification ? { notificationId: notification.id } : {}),
        },
      },
    });
    emit(RealtimeEvents.NOTIFICATION_NEW, [roomUser(userId)], {
      type: input.legacyEvent ?? input.type,
      notificationType: input.type,
      title: input.title,
      message: input.message,
      data: input.legacyData ?? input.data ?? {},
      at,
      ...meta,
      ...(notification ? { id: notification.id, notification } : {}),
    });
  }
  // Fire-and-forget: a slow FCM call must not delay the REST response.
  void sendPushToUsers(pushItems);
};

const jobTitleOf = async (jobId?: string | null): Promise<string> => {
  if (!jobId) return 'your job';
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { title: true } });
  return job?.title ?? 'your job';
};

const formatMoney = async (amount?: number | null, currencyCode?: string | null) => {
  if (amount == null) return '';
  const symbol = currencyCode ? (await getCurrencyMeta(currencyCode)).symbol : '';
  return `${symbol}${Number(amount).toFixed(2)}`;
};

const formatDay = (d?: Date | string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

const haversineKm = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Rooms a verified trader should join for Discover broadcasts.
 * Called on socket connect.
 */
export const resolveTraderDiscoverRooms = async (userId: string): Promise<string[]> => {
  const trader = await prisma.trader.findUnique({
    where: { userId },
    select: {
      verificationStatus: true,
      onboardingStatus: true,
      categoryId: true,
      categories: { where: { isActive: true }, select: { categoryId: true } },
    },
  });

  if (
    !trader ||
    trader.verificationStatus !== VerificationStatus.VERIFIED ||
    trader.onboardingStatus !== TraderOnboardingStatus.APPROVED
  ) {
    return [];
  }

  const categoryIds = [
    ...new Set(
      [trader.categoryId, ...trader.categories.map((c) => c.categoryId)].filter(
        (id): id is string => Boolean(id)
      )
    ),
  ];

  return [roomTradersDiscover(), ...categoryIds.map(roomTraderCategory)];
};

/** Nearby verified traders (same category + within service radius) for marketplace jobs. */
const findNearbyDiscoverTraderUserIds = async (payload: JobRealtimePayload): Promise<string[]> => {
  if (!payload.categoryId) return [];

  const traders = await prisma.trader.findMany({
    where: {
      verificationStatus: VerificationStatus.VERIFIED,
      onboardingStatus: TraderOnboardingStatus.APPROVED,
      OR: [
        { categoryId: payload.categoryId },
        { categories: { some: { categoryId: payload.categoryId, isActive: true } } },
      ],
    },
    select: {
      userId: true,
      serviceRadiusKm: true,
      serviceCenterLat: true,
      serviceCenterLng: true,
    },
    take: 500,
  });

  const jobLat =
    payload.latitude != null && Number.isFinite(payload.latitude) ? payload.latitude : null;
  const jobLng =
    payload.longitude != null && Number.isFinite(payload.longitude) ? payload.longitude : null;

  // No job coords → notify all category-matched verified traders (rooms also cover this).
  if (jobLat == null || jobLng == null || (jobLat === 0 && jobLng === 0)) {
    return traders.map((t) => t.userId);
  }

  const jobPoint = { lat: jobLat, lng: jobLng };
  return traders
    .filter((t) => {
      const origin =
        t.serviceCenterLat != null && t.serviceCenterLng != null
          ? { lat: Number(t.serviceCenterLat), lng: Number(t.serviceCenterLng) }
          : DUBLIN_ORIGIN;
      const radiusKm =
        t.serviceRadiusKm && t.serviceRadiusKm > 0
          ? t.serviceRadiusKm
          : getPlatformSetting('jobs.default_discover_radius_km');
      return haversineKm(origin, jobPoint) <= radiusKm;
    })
    .map((t) => t.userId);
};

/**
 * Push marketplace job to Discover listeners (verified traders in category / area).
 * Emits both `job:published` and `job:created` so either mobile listener works.
 */
const broadcastMarketplaceJobToTraders = async (payload: JobRealtimePayload) => {
  if (payload.status !== 'PUBLISHED') return;
  // Assigned / direct-hire jobs are not Discover marketplace cards
  if (payload.traderId) return;

  try {
    const rooms = [roomTradersDiscover()];
    if (payload.categoryId) {
      rooms.push(roomTraderCategory(payload.categoryId));
    }

    const nearbyUserIds = await findNearbyDiscoverTraderUserIds(payload);
    for (const userId of nearbyUserIds) {
      rooms.push(roomUser(userId));
    }

    const body = {
      ...payload,
      source: 'marketplace' as const,
    };

    emit(RealtimeEvents.JOB_PUBLISHED, rooms, body);
    emit(RealtimeEvents.JOB_CREATED, rooms, body);

    if (nearbyUserIds.length) {
      const category = payload.categoryId
        ? await prisma.category.findUnique({
            where: { id: payload.categoryId },
            select: { name: true },
          })
        : null;
      const jobTitle = payload.title ?? (await jobTitleOf(payload.jobId));
      await pushUserNotification(nearbyUserIds, {
        type: 'NEW_MATCHING_JOB',
        title: category?.name ? `New ${category.name} Job` : 'New Matching Job',
        message: payload.city ? `${jobTitle} requested in ${payload.city}.` : jobTitle,
        data: {
          jobId: payload.jobId,
          jobRef: payload.jobRef ?? null,
          jobTitle,
          categoryId: payload.categoryId ?? null,
          categoryName: category?.name ?? null,
          city: payload.city ?? null,
          siteVisitRequested: payload.siteVisitRequested ?? false,
        },
        at: payload.at,
        dedupeKey: `job:${payload.jobId}`,
      });
    }

    logger.info('Realtime marketplace job broadcast', {
      jobId: payload.jobId,
      categoryId: payload.categoryId,
      nearbyTraders: nearbyUserIds.length,
      rooms: [...new Set(rooms)].length,
    });
  } catch (err) {
    logger.warn('Realtime marketplace broadcast failed', { err, jobId: payload.jobId });
  }
};

export const emitJobCreated = (payload: JobRealtimePayload) => {
  emit(RealtimeEvents.JOB_CREATED, [roomUser(payload.customerId), roomJob(payload.jobId)], {
    ...payload,
  });
  emit(RealtimeEvents.NOTIFICATION_NEW, [roomUser(payload.customerId)], {
    type: RealtimeEvents.JOB_CREATED,
    title: 'Job created',
    data: payload,
    at: payload.at,
  });
};

export const emitJobUpdated = (payload: JobRealtimePayload) => {
  const rooms = [roomUser(payload.customerId), roomJob(payload.jobId)];
  emit(RealtimeEvents.JOB_UPDATED, rooms, { ...payload });
  // Marketplace card refresh for Discover listeners
  void broadcastMarketplaceJobUpdateToTraders(payload);
};

/**
 * Push job field changes to Discover so traders soft-refresh / upsert the card.
 */
const broadcastMarketplaceJobUpdateToTraders = async (payload: JobRealtimePayload) => {
  if (payload.status !== 'PUBLISHED') return;
  if (payload.traderId) return;

  try {
    const rooms = [roomTradersDiscover()];
    if (payload.categoryId) {
      rooms.push(roomTraderCategory(payload.categoryId));
    }
    const nearbyUserIds = await findNearbyDiscoverTraderUserIds(payload);
    for (const userId of nearbyUserIds) {
      rooms.push(roomUser(userId));
    }
    emit(RealtimeEvents.JOB_UPDATED, rooms, {
      ...payload,
      source: 'marketplace',
    });
  } catch (err) {
    logger.warn('Realtime marketplace update broadcast failed', { err, jobId: payload.jobId });
  }
};

export const emitJobPublished = (
  payload: JobRealtimePayload & { traderUserId?: string | null }
) => {
  const rooms = [roomUser(payload.customerId), roomJob(payload.jobId)];
  if (payload.traderUserId) rooms.push(roomUser(payload.traderUserId));
  if (payload.bookingId) rooms.push(roomBooking(payload.bookingId));
  emit(RealtimeEvents.JOB_PUBLISHED, rooms, { ...payload });
  emit(RealtimeEvents.JOB_STATUS_CHANGED, rooms, { ...payload });

  const jobTitle = payload.title ?? 'your job';
  const data = {
    jobId: payload.jobId,
    jobRef: payload.jobRef ?? null,
    jobTitle,
    bookingId: payload.bookingId ?? null,
    invoiceId: payload.invoiceId ?? null,
    status: payload.status,
  };
  void pushUserNotification([payload.customerId], {
    type: 'JOB_PUBLISHED',
    title: 'Your job is live',
    message: payload.traderId
      ? `"${jobTitle}" has been sent to your trader.`
      : `"${jobTitle}" is now visible to traders.`,
    data,
    legacyEvent: RealtimeEvents.JOB_PUBLISHED,
    legacyData: payload,
    at: payload.at,
  });
  void pushUserNotification([payload.traderUserId], {
    type: 'DIRECT_JOB_RECEIVED',
    title: 'New booking',
    message: `A customer booked "${jobTitle}" with you.`,
    data,
    legacyEvent: RealtimeEvents.JOB_PUBLISHED,
    legacyData: payload,
    at: payload.at,
  });

  // Discover: notify nearby / category traders (fire-and-forget)
  void broadcastMarketplaceJobToTraders(payload);
};

const jobStatusCopy = (status: string, jobTitle: string, actor?: string) => {
  switch (status) {
    case 'ACCEPTED':
    case 'SCHEDULED':
      return { title: 'Job confirmed', message: `"${jobTitle}" is confirmed and scheduled.` };
    case 'CANCELLED':
      return {
        title: 'Job cancelled',
        message: `"${jobTitle}" was cancelled${
          actor === 'CUSTOMER' ? ' by the customer' : actor === 'ADMIN' ? ' by BRISK support' : ''
        }.`,
      };
    case 'COMPLETED':
      return { title: 'Job completed', message: `"${jobTitle}" is completed.` };
    case 'PAYMENT_PENDING':
      return { title: 'Work finished', message: `"${jobTitle}" is finished and awaiting payment.` };
    default:
      return {
        title: 'Job status updated',
        message: `"${jobTitle}" is now ${status.toLowerCase().replace(/_/g, ' ')}.`,
      };
  }
};

/**
 * `actor` = who caused the change; the inbox notification goes to the other party
 * (no actor → customer, legacy behaviour; ADMIN → both customer and trader).
 */
export const emitJobStatusChanged = (
  payload: JobRealtimePayload & {
    traderUserId?: string | null;
    actor?: 'CUSTOMER' | 'TRADER' | 'SYSTEM' | 'ADMIN';
  }
) => {
  const rooms = [roomUser(payload.customerId), roomJob(payload.jobId)];
  if (payload.traderUserId) rooms.push(roomUser(payload.traderUserId));
  if (payload.bookingId) rooms.push(roomBooking(payload.bookingId));
  emit(RealtimeEvents.JOB_STATUS_CHANGED, rooms, { ...payload });

  const recipients =
    payload.actor === 'ADMIN'
      ? [payload.customerId, payload.traderUserId]
      : [payload.actor === 'CUSTOMER' ? payload.traderUserId : payload.customerId];
  if (!recipients.some(Boolean)) return;
  void (async () => {
    const jobTitle = payload.title ?? (await jobTitleOf(payload.jobId));
    await pushUserNotification(recipients, {
      type: 'JOB_STATUS_CHANGED',
      ...jobStatusCopy(payload.status, jobTitle, payload.actor),
      data: {
        jobId: payload.jobId,
        jobRef: payload.jobRef ?? null,
        jobTitle,
        status: payload.status,
        bookingId: payload.bookingId ?? null,
      },
      legacyEvent: RealtimeEvents.JOB_STATUS_CHANGED,
      legacyData: payload,
      at: payload.at,
    });
  })();
};

/** Customer accepted this trader's quote — payload matches GET /traders/jobs/incoming/latest. */
export const emitJobAccept = (traderUserId: string, sheet: Record<string, unknown> & { at: string }) => {
  emit(RealtimeEvents.JOB_ACCEPT, [roomUser(traderUserId)], sheet);
  const customer = sheet.customer as { fullName?: string } | undefined;
  const jobTitle = typeof sheet.title === 'string' ? sheet.title : 'your job';
  void pushUserNotification([traderUserId], {
    type: 'QUOTE_ACCEPTED',
    title: 'Customer accepted your quotation',
    message: `${customer?.fullName ?? 'The customer'} accepted your quotation for "${jobTitle}". Tap View & Accept to start.`,
    data: {
      jobId: sheet.jobId,
      quoteId: sheet.quoteId,
      jobTitle,
      amount: sheet.charges ?? null,
      currencyCode: sheet.currencyCode ?? null,
      customerName: customer?.fullName ?? null,
    },
    legacyEvent: RealtimeEvents.JOB_ACCEPT,
    legacyData: sheet,
    at: sheet.at,
  });
};

export const emitJobAcceptCancelled = (traderUserId: string, payload: QuoteRealtimePayload) => {
  emit(RealtimeEvents.JOB_ACCEPT_CANCELLED, [roomUser(traderUserId)], { ...payload });
  void (async () => {
    const jobTitle = await jobTitleOf(payload.jobId);
    await pushUserNotification([traderUserId], {
      type: 'QUOTE_SELECTION_CANCELLED',
      title: 'Quotation no longer selected',
      message: `The customer chose another quotation or cancelled "${jobTitle}".`,
      data: { jobId: payload.jobId, quoteId: payload.quoteId, jobTitle },
      legacyEvent: RealtimeEvents.JOB_ACCEPT_CANCELLED,
      legacyData: payload,
      at: payload.at,
    });
  })();
};

export const emitJobDeclined = (payload: QuoteRealtimePayload) => {
  const rooms = [roomUser(payload.customerId), roomJob(payload.jobId)];
  emit(RealtimeEvents.JOB_DECLINED, rooms, { ...payload });
  void (async () => {
    const jobTitle = await jobTitleOf(payload.jobId);
    await pushUserNotification([payload.customerId], {
      type: 'JOB_DECLINED',
      title: 'Trader declined the job',
      message: `${payload.traderName ?? 'The trader'} declined "${jobTitle}". You can accept another quotation.`,
      data: {
        jobId: payload.jobId,
        quoteId: payload.quoteId,
        traderId: payload.traderId,
        traderName: payload.traderName ?? null,
        jobTitle,
      },
      legacyEvent: RealtimeEvents.JOB_DECLINED,
      legacyData: payload,
      at: payload.at,
    });
  })();
};

export const emitQuoteReceived = (payload: QuoteRealtimePayload) => {
  const rooms = [roomUser(payload.customerId), roomJob(payload.jobId)];
  emit(RealtimeEvents.QUOTE_RECEIVED, rooms, { ...payload });
  void (async () => {
    const [jobTitle, amount] = await Promise.all([
      jobTitleOf(payload.jobId),
      formatMoney(payload.amount, payload.currencyCode),
    ]);
    const trader = payload.traderName ?? 'A trader';
    const copy =
      payload.kind === 'REQUESTED'
        ? { title: 'Job request received', message: `${trader} requested "${jobTitle}" for ${amount}.` }
        : payload.kind === 'UPDATED'
          ? { title: 'Quotation updated', message: `${trader} updated their quotation to ${amount} for "${jobTitle}".` }
          : { title: 'New quotation received', message: `${trader} sent a quotation of ${amount} for "${jobTitle}".` };
    await pushUserNotification([payload.customerId], {
      type: 'QUOTE_RECEIVED',
      ...copy,
      data: {
        jobId: payload.jobId,
        quoteId: payload.quoteId,
        traderId: payload.traderId,
        traderName: payload.traderName ?? null,
        amount: payload.amount ?? null,
        currencyCode: payload.currencyCode ?? null,
        kind: payload.kind ?? 'NEW',
        jobTitle,
      },
      legacyEvent: RealtimeEvents.QUOTE_RECEIVED,
      legacyData: payload,
      at: payload.at,
    });
  })();
};

export const emitPaymentCompleted = (
  payload: PaymentRealtimePayload & { traderUserId?: string | null }
) => {
  const rooms = [roomUser(payload.customerId)];
  if (payload.jobId) rooms.push(roomJob(payload.jobId));
  if (payload.bookingId) rooms.push(roomBooking(payload.bookingId));
  if (payload.traderUserId) rooms.push(roomUser(payload.traderUserId));
  emit(RealtimeEvents.PAYMENT_COMPLETED, rooms, { ...payload });
  if (payload.jobId) {
    emit(RealtimeEvents.JOB_STATUS_CHANGED, rooms, {
      jobId: payload.jobId,
      status: 'SCHEDULED',
      customerId: payload.customerId,
      traderId: payload.traderId ?? null,
      invoiceId: payload.invoiceId,
      bookingId: payload.bookingId ?? null,
      at: payload.at,
    });
  }
  void (async () => {
    const [jobTitle, currency] = await Promise.all([
      jobTitleOf(payload.jobId),
      payload.invoiceId
        ? prisma.invoice.findUnique({
            where: { id: payload.invoiceId },
            select: { currencyCode: true },
          })
        : null,
    ]);
    const amount = await formatMoney(payload.amount, currency?.currencyCode);
    const data = {
      jobId: payload.jobId ?? null,
      jobTitle,
      paymentId: payload.paymentId,
      invoiceId: payload.invoiceId,
      bookingId: payload.bookingId ?? null,
      amount: payload.amount ?? null,
      currencyCode: currency?.currencyCode ?? null,
    };
    await pushUserNotification([payload.customerId], {
      type: 'PAYMENT_SUCCESSFUL',
      title: 'Payment successful',
      message: `Payment${amount ? ` of ${amount}` : ''} for "${jobTitle}" was successful.`,
      data,
      legacyEvent: RealtimeEvents.PAYMENT_COMPLETED,
      legacyData: payload,
      at: payload.at,
    });
    await pushUserNotification([payload.traderUserId], {
      type: 'PAYMENT_RECEIVED',
      title: 'Payment received',
      message: `The customer paid${amount ? ` ${amount}` : ''} for "${jobTitle}".`,
      data,
      legacyEvent: RealtimeEvents.PAYMENT_COMPLETED,
      legacyData: payload,
      at: payload.at,
    });
  })();
};

export const emitPaymentFailed = (payload: PaymentRealtimePayload) => {
  const rooms = [roomUser(payload.customerId)];
  if (payload.jobId) rooms.push(roomJob(payload.jobId));
  emit(RealtimeEvents.PAYMENT_FAILED, rooms, { ...payload });
  void (async () => {
    const jobTitle = await jobTitleOf(payload.jobId);
    await pushUserNotification([payload.customerId], {
      type: 'PAYMENT_FAILED',
      title: 'Payment failed',
      message: `Your payment for "${jobTitle}" failed. Please try again.`,
      data: {
        jobId: payload.jobId ?? null,
        jobTitle,
        paymentId: payload.paymentId,
        invoiceId: payload.invoiceId,
      },
      legacyEvent: RealtimeEvents.PAYMENT_FAILED,
      legacyData: payload,
      at: payload.at,
    });
  })();
};

export const emitPaymentRequestPaid = (payload: PaymentRequestRealtimePayload) => {
  const rooms = [roomUser(payload.customerId), roomJob(payload.jobId)];
  if (payload.traderUserId) rooms.push(roomUser(payload.traderUserId));
  emit(RealtimeEvents.PAYMENT_REQUEST_PAID, rooms, { ...payload });
  if (payload.jobStatus) {
    emit(RealtimeEvents.JOB_STATUS_CHANGED, rooms, {
      jobId: payload.jobId,
      status: payload.jobStatus,
      customerId: payload.customerId,
      traderId: payload.traderId,
      at: payload.at,
    });
  }
  void (async () => {
    const [jobTitle, amount] = await Promise.all([
      jobTitleOf(payload.jobId),
      formatMoney(payload.amount, payload.currencyCode),
    ]);
    await pushUserNotification([payload.traderUserId], {
      type: 'PAYMENT_RECEIVED',
      title: payload.jobStatus === 'COMPLETED' ? 'Job Completed & Paid' : 'Payment received',
      message: `Payment of ${amount} for "${jobTitle}" has been received.`,
      data: {
        jobId: payload.jobId,
        jobTitle,
        paymentRequestId: payload.paymentRequestId,
        paymentRequestType: payload.type,
        amount: payload.amount,
        currencyCode: payload.currencyCode,
        jobStatus: payload.jobStatus ?? null,
      },
      legacyEvent: RealtimeEvents.PAYMENT_REQUEST_PAID,
      legacyData: payload,
      at: payload.at,
    });
  })();
};

const REFUND_COPY: Record<string, { title: string; verb: string }> = {
  APPROVED: { title: 'Refund approved', verb: 'has been approved' },
  COMPLETED: { title: 'Refund completed', verb: 'has been sent to your payment method' },
  REJECTED: { title: 'Refund rejected', verb: 'was rejected' },
};

export const emitRefundUpdated = (payload: RefundRealtimePayload) => {
  emit(RealtimeEvents.REFUND_UPDATED, [roomUser(payload.customerId)], { ...payload });
  const copy = REFUND_COPY[payload.status];
  if (!copy) return;
  void (async () => {
    const amount = await formatMoney(payload.amount, payload.currencyCode);
    await pushUserNotification([payload.customerId], {
      type: 'REFUND_UPDATE',
      title: copy.title,
      message: `Your refund of ${amount} ${copy.verb}.`,
      data: {
        refundId: payload.refundId,
        paymentId: payload.paymentId ?? null,
        status: payload.status,
        amount: payload.amount,
        currencyCode: payload.currencyCode,
      },
      legacyEvent: RealtimeEvents.REFUND_UPDATED,
      legacyData: payload,
      at: payload.at,
      dedupeKey: `refund:${payload.refundId}:${payload.status}`,
    });
  })();
};

/** Trader sent a chat message on a job → the other party's Incoming Chats. */
export const emitChatMessage = (input: {
  recipientUserId: string;
  jobId: string;
  bookingId?: string | null;
  messageId: string;
  senderName: string;
  senderPhotoUrl?: string | null;
  message: string;
}) => {
  void (async () => {
    const jobTitle = await jobTitleOf(input.jobId);
    const text = input.message.length > 140 ? `${input.message.slice(0, 137)}...` : input.message;
    await pushUserNotification([input.recipientUserId], {
      type: 'NEW_CHAT_MESSAGE',
      title: input.senderName,
      message: text,
      data: {
        jobId: input.jobId,
        jobTitle,
        bookingId: input.bookingId ?? null,
        messageId: input.messageId,
        senderName: input.senderName,
        senderPhotoUrl: input.senderPhotoUrl ?? null,
      },
    });
  })();
};

const SITE_VISIT_COPY = {
  SITE_VISIT_REQUESTED: (who: string, job: string, day: string) => ({
    title: 'Site visit requested',
    message: `${who} proposed a site visit for "${job}"${day ? ` on ${day}` : ''}.`,
  }),
  SITE_VISIT_RESCHEDULED: (who: string, job: string, day: string) => ({
    title: 'Site visit rescheduled',
    message: `${who} proposed a new site visit time for "${job}"${day ? ` (${day})` : ''}.`,
  }),
  SITE_VISIT_CONFIRMED: (_who: string, job: string, day: string) => ({
    title: 'Site visit confirmed',
    message: `The customer confirmed your site visit for "${job}"${day ? ` on ${day}` : ''}.`,
  }),
  SITE_VISIT_RESCHEDULE_REQUESTED: (_who: string, job: string, day: string) => ({
    title: 'Rescheduling Request',
    message: `The customer asked to move the site visit for "${job}"${day ? ` from ${day}` : ''}. Please pick a new time.`,
  }),
} as const;

export const emitSiteVisitUpdate = (input: {
  type: keyof typeof SITE_VISIT_COPY;
  recipientUserId: string;
  jobId: string;
  requestId: string;
  traderName?: string | null;
  visitDate?: Date | null;
  timeSlot?: string | null;
}) => {
  void (async () => {
    const jobTitle = await jobTitleOf(input.jobId);
    await pushUserNotification([input.recipientUserId], {
      type: input.type,
      ...SITE_VISIT_COPY[input.type](
        input.traderName ?? 'The trader',
        jobTitle,
        formatDay(input.visitDate)
      ),
      data: {
        jobId: input.jobId,
        jobTitle,
        siteVisitRequestId: input.requestId,
        traderName: input.traderName ?? null,
        visitDate: input.visitDate ?? null,
        timeSlot: input.timeSlot ?? null,
      },
    });
  })();
};

const PAYMENT_REQUEST_LABEL: Record<string, string> = {
  FULL_JOB: 'the job',
  PARTIAL: 'a part payment',
  SITE_VISIT_FEE: 'the site visit fee',
};

/** Trader requested a payment → customer Booking Updates. */
export const emitPaymentRequested = (input: {
  customerId: string;
  jobId: string;
  paymentRequestId: string;
  type: string;
  amount: number;
  currencyCode: string;
  traderName?: string | null;
}) => {
  void (async () => {
    const [jobTitle, amount] = await Promise.all([
      jobTitleOf(input.jobId),
      formatMoney(input.amount, input.currencyCode),
    ]);
    await pushUserNotification([input.customerId], {
      type: 'PAYMENT_REQUESTED',
      title: 'Payment requested',
      message: `${input.traderName ?? 'Your trader'} requested ${amount} for ${PAYMENT_REQUEST_LABEL[input.type] ?? 'the job'} on "${jobTitle}".`,
      data: {
        jobId: input.jobId,
        jobTitle,
        paymentRequestId: input.paymentRequestId,
        paymentRequestType: input.type,
        amount: input.amount,
        currencyCode: input.currencyCode,
        traderName: input.traderName ?? null,
      },
    });
  })();
};

export const emitInvoiceUpdated = (payload: InvoiceRealtimePayload) => {
  const rooms = [roomUser(payload.customerId)];
  if (payload.jobId) rooms.push(roomJob(payload.jobId));
  emit(RealtimeEvents.INVOICE_UPDATED, rooms, { ...payload });
};

export const realtimeRooms = {
  roomUser,
  roomJob,
  roomBooking,
  roomTradersDiscover,
  roomTraderCategory,
};
