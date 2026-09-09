import http from 'http';
import { Server as SocketServer, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { setRealtimeServer, realtimeRooms } from './realtime';
import { RealtimeEvents } from './events';

type SocketUser = {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'TRADER';
};

type AuthedSocket = Socket & { data: { user: SocketUser } };

const verifyAccessToken = async (token: string): Promise<SocketUser> => {
  const decoded = jwt.verify(token, env.JWT_SECRET) as {
    id: string;
    email: string;
    role: 'CUSTOMER' | 'TRADER';
    type?: string;
    tv?: number;
  };

  if (decoded.type && decoded.type !== 'user_access') {
    throw new Error('Invalid token type.');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });
  if (!user) throw new Error('User not found.');
  if ((decoded.tv ?? 0) !== user.tokenVersion) {
    throw new Error('Session invalidated.');
  }

  return { id: user.id, email: user.email, role: user.role };
};

const extractToken = (socket: Socket): string | null => {
  const auth = socket.handshake.auth as { token?: string } | undefined;
  if (auth?.token) return auth.token;
  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  const q = socket.handshake.query.token;
  if (typeof q === 'string' && q) return q;
  return null;
};

export const initSocketServer = (httpServer: http.Server): SocketServer => {
  const io = new SocketServer(httpServer, {
    path: '/socket.io',
    cors: { origin: true, credentials: true },
    transports: ['websocket', 'polling'],
  });

  setRealtimeServer(io);

  io.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) return next(new Error('Authentication required.'));
      const user = await verifyAccessToken(token);
      (socket as AuthedSocket).data.user = user;
      next();
    } catch (err) {
      logger.warn('Socket auth failed', { err: (err as Error).message });
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthedSocket;
    const user = socket.data.user;
    const userRoom = realtimeRooms.roomUser(user.id);
    void socket.join(userRoom);

    logger.info(`Socket connected user=${user.id} role=${user.role} id=${socket.id}`);

    socket.emit('realtime:ready', {
      userId: user.id,
      role: user.role,
      rooms: [userRoom],
      events: Object.values(RealtimeEvents),
      at: new Date().toISOString(),
    });

    socket.on('job:subscribe', async (payload: { jobId?: string }, ack?: (r: unknown) => void) => {
      try {
        const jobId = payload?.jobId;
        if (!jobId) {
          ack?.({ success: false, message: 'jobId required' });
          return;
        }
        const job = await prisma.job.findUnique({
          where: { id: jobId },
          select: {
            id: true,
            customerId: true,
            traderId: true,
            trader: { select: { userId: true } },
          },
        });
        if (!job) {
          ack?.({ success: false, message: 'Job not found' });
          return;
        }
        const isOwner = job.customerId === user.id;
        const isAssignedTrader = job.trader?.userId === user.id;
        if (!isOwner && !isAssignedTrader) {
          ack?.({ success: false, message: 'Forbidden' });
          return;
        }
        await socket.join(realtimeRooms.roomJob(jobId));
        ack?.({ success: true, room: realtimeRooms.roomJob(jobId) });
      } catch (err) {
        ack?.({ success: false, message: (err as Error).message });
      }
    });

    socket.on('job:unsubscribe', async (payload: { jobId?: string }, ack?: (r: unknown) => void) => {
      const jobId = payload?.jobId;
      if (!jobId) {
        ack?.({ success: false, message: 'jobId required' });
        return;
      }
      await socket.leave(realtimeRooms.roomJob(jobId));
      ack?.({ success: true });
    });

    socket.on(
      'booking:subscribe',
      async (payload: { bookingId?: string }, ack?: (r: unknown) => void) => {
        try {
          const bookingId = payload?.bookingId;
          if (!bookingId) {
            ack?.({ success: false, message: 'bookingId required' });
            return;
          }
          const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            select: {
              id: true,
              customerId: true,
              trader: { select: { userId: true } },
            },
          });
          if (!booking) {
            ack?.({ success: false, message: 'Booking not found' });
            return;
          }
          const allowed =
            booking.customerId === user.id || booking.trader?.userId === user.id;
          if (!allowed) {
            ack?.({ success: false, message: 'Forbidden' });
            return;
          }
          await socket.join(realtimeRooms.roomBooking(bookingId));
          ack?.({ success: true, room: realtimeRooms.roomBooking(bookingId) });
        } catch (err) {
          ack?.({ success: false, message: (err as Error).message });
        }
      }
    );

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected user=${user.id} reason=${reason}`);
    });
  });

  logger.info('Socket.IO realtime layer ready on path /socket.io');
  return io;
};
