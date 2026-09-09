import type { Server as SocketServer } from 'socket.io';
import { logger } from '../utils/logger';
import {
  RealtimeEvents,
  type InvoiceRealtimePayload,
  type JobRealtimePayload,
  type PaymentRealtimePayload,
  type RealtimeEventName,
} from './events';

let io: SocketServer | null = null;

export const setRealtimeServer = (server: SocketServer) => {
  io = server;
};

export const getRealtimeServer = () => io;

const roomUser = (userId: string) => `user:${userId}`;
const roomJob = (jobId: string) => `job:${jobId}`;
const roomBooking = (bookingId: string) => `booking:${bookingId}`;

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
    let target = io.to(unique[0]);
    for (let i = 1; i < unique.length; i++) {
      target = target.to(unique[i]);
    }
    target.emit(event, payload);
  } catch (err) {
    logger.warn('Realtime emit failed', { event, err });
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
  if (payload.traderId) {
    // traderId here is trader profile id — caller should pass trader userId in traderUserId if known
  }
  emit(RealtimeEvents.JOB_UPDATED, rooms, { ...payload });
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

export const realtimeRooms = { roomUser, roomJob, roomBooking };
