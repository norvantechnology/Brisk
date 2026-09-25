import type { Server as SocketServer } from 'socket.io';
import {
  TraderOnboardingStatus,
  VerificationStatus,
} from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import {
  RealtimeEvents,
  type InvoiceRealtimePayload,
  type JobRealtimePayload,
  type PaymentRealtimePayload,
  type RealtimeEventName,
} from './events';

let io: SocketServer | null = null;

const DEFAULT_DISCOVER_RADIUS_KM = 50;
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
      categories: { select: { categoryId: true } },
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
        { categories: { some: { categoryId: payload.categoryId } } },
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
          : DEFAULT_DISCOVER_RADIUS_KM;
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
  emit(RealtimeEvents.NOTIFICATION_NEW, rooms, {
    type: RealtimeEvents.JOB_PUBLISHED,
    title: 'Job published',
    data: payload,
    at: payload.at,
  });

  // Discover: notify nearby / category traders (fire-and-forget)
  void broadcastMarketplaceJobToTraders(payload);
};

export const emitJobStatusChanged = (
  payload: JobRealtimePayload & { traderUserId?: string | null }
) => {
  const rooms = [roomUser(payload.customerId), roomJob(payload.jobId)];
  if (payload.traderUserId) rooms.push(roomUser(payload.traderUserId));
  if (payload.bookingId) rooms.push(roomBooking(payload.bookingId));
  emit(RealtimeEvents.JOB_STATUS_CHANGED, rooms, { ...payload });
  emit(RealtimeEvents.NOTIFICATION_NEW, [roomUser(payload.customerId)], {
    type: RealtimeEvents.JOB_STATUS_CHANGED,
    title: 'Job status updated',
    data: payload,
    at: payload.at,
  });
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
  emit(RealtimeEvents.NOTIFICATION_NEW, [roomUser(payload.customerId)], {
    type: RealtimeEvents.PAYMENT_COMPLETED,
    title: 'Payment successful',
    data: payload,
    at: payload.at,
  });
};

export const emitPaymentFailed = (payload: PaymentRealtimePayload) => {
  const rooms = [roomUser(payload.customerId)];
  if (payload.jobId) rooms.push(roomJob(payload.jobId));
  emit(RealtimeEvents.PAYMENT_FAILED, rooms, { ...payload });
  emit(RealtimeEvents.NOTIFICATION_NEW, [roomUser(payload.customerId)], {
    type: RealtimeEvents.PAYMENT_FAILED,
    title: 'Payment failed',
    data: payload,
    at: payload.at,
  });
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
