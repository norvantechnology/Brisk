import { JobStatus, Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { buildPaginationMeta } from '../../utils/pagination';
import { emitChatMessage } from '../../sockets/realtime';
import type { ChatListQuery, ChatMessagesQuery } from './chat.validation';

/** conversationId === jobId (same as customer/trader job payloads). */
type ChatJobAccess = {
  id: string;
  jobRef: string | null;
  title: string;
  status: JobStatus;
  customerId: string;
  traderId: string | null;
  bookingId: string | null;
  customer: {
    id: string;
    fullName: string;
    profilePhotoUrl: string | null;
  };
  trader: {
    id: string;
    businessName: string | null;
    userId: string;
    user: { id: string; fullName: string; profilePhotoUrl: string | null };
  } | null;
};

const jobChatSelect = {
  id: true,
  jobRef: true,
  title: true,
  status: true,
  customerId: true,
  traderId: true,
  booking: { select: { id: true } },
  customer: { select: { id: true, fullName: true, profilePhotoUrl: true } },
  trader: {
    select: {
      id: true,
      businessName: true,
      userId: true,
      user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
    },
  },
} satisfies Prisma.JobSelect;

const assertChatAccess = async (userId: string, role: UserRole, jobId: string): Promise<ChatJobAccess> => {
  let where: Prisma.JobWhereInput = { id: jobId };
  if (role === UserRole.CUSTOMER) {
    where = { id: jobId, customerId: userId };
  } else if (role === UserRole.TRADER) {
    const traderIds = await traderIdsForUser(userId);
    if (!traderIds.length) throw new NotFoundError('Conversation not found.');
    where = {
      id: jobId,
      OR: [
        { traderId: { in: traderIds } },
        { siteVisitRequests: { some: { traderId: { in: traderIds } } } },
        { quotes: { some: { traderId: { in: traderIds } } } },
      ],
    };
  } else {
    throw new ForbiddenError('Chat is available for customers and traders.');
  }

  const job = await prisma.job.findFirst({
    where,
    select: jobChatSelect,
  });
  if (!job) throw new NotFoundError('Conversation not found.');
  return {
    ...job,
    bookingId: job.booking?.id ?? null,
  };
};

const traderIdsForUser = async (userId: string): Promise<string[]> => {
  const rows = await prisma.trader.findMany({
    where: { userId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
};

const counterpartFor = (job: ChatJobAccess, _userId: string, role: UserRole) => {
  if (role === UserRole.CUSTOMER) {
    const t = job.trader;
    return {
      id: t?.user.id ?? t?.userId ?? null,
      traderId: t?.id ?? null,
      name: t ? t.businessName || t.user.fullName : null,
      profilePhotoUrl: t?.user.profilePhotoUrl ?? null,
      role: 'TRADER' as const,
    };
  }
  return {
    id: job.customer.id,
    traderId: null as string | null,
    name: job.customer.fullName,
    profilePhotoUrl: job.customer.profilePhotoUrl,
    role: 'CUSTOMER' as const,
  };
};

const serializeMessage = (
  m: {
    id: string;
    message: string;
    imageUrl?: string | null;
    readAt?: Date | null;
    sentAt: Date;
    senderId: string;
    sender: { id: string; fullName: string; role: UserRole; profilePhotoUrl: string | null };
  },
  userId: string
) => ({
  id: m.id,
  senderId: m.sender.id,
  senderRole: m.sender.role,
  senderName: m.sender.fullName,
  senderPhotoUrl: m.sender.profilePhotoUrl,
  message: m.message,
  imageUrl: m.imageUrl ?? null,
  /** null = unread (single tick); set = counterpart opened chat (blue double tick on isMine). */
  readAt: m.readAt ?? null,
  sentAt: m.sentAt,
  isMine: m.senderId === userId,
});

/** When viewer opens the thread, mark counterpart's unread messages as read. */
const markCounterpartMessagesRead = async (jobId: string, viewerUserId: string) => {
  const now = new Date();
  await prisma.chatMessage.updateMany({
    where: {
      jobId,
      senderId: { not: viewerUserId },
      readAt: null,
    },
    data: { readAt: now },
  });
};

/** Messages inbox — one row per job that has chat (or assigned counterpart). */
export const listConversations = async (
  userId: string,
  role: UserRole,
  query: ChatListQuery
) => {
  if (role !== UserRole.CUSTOMER && role !== UserRole.TRADER) {
    throw new ForbiddenError('Chat is available for customers and traders.');
  }

  const page = query.page;
  const limit = query.limit;
  const search = query.search?.trim();

  const traderIds = role === UserRole.TRADER ? await traderIdsForUser(userId) : [];
  if (role === UserRole.TRADER && !traderIds.length) {
    return { items: [], meta: buildPaginationMeta(0, page, limit) };
  }

  const accessWhere: Prisma.JobWhereInput =
    role === UserRole.CUSTOMER
      ? { customerId: userId }
      : {
          OR: [
            { traderId: { in: traderIds } },
            { siteVisitRequests: { some: { traderId: { in: traderIds } } } },
            { quotes: { some: { traderId: { in: traderIds } } } },
          ],
        };

  const searchWhere: Prisma.JobWhereInput | undefined = search
    ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { jobRef: { contains: search, mode: 'insensitive' } },
          { customer: { fullName: { contains: search, mode: 'insensitive' } } },
          { trader: { businessName: { contains: search, mode: 'insensitive' } } },
          { trader: { user: { fullName: { contains: search, mode: 'insensitive' } } } },
        ],
      }
    : undefined;

  const where: Prisma.JobWhereInput = {
    AND: [{ chatMessages: { some: {} } }, accessWhere, ...(searchWhere ? [searchWhere] : [])],
  };

  const jobs = await prisma.job.findMany({
    where,
    select: {
      ...jobChatSelect,
      chatMessages: {
        orderBy: { sentAt: 'desc' },
        take: 1,
        select: {
          id: true,
          message: true,
          imageUrl: true,
          readAt: true,
          sentAt: true,
          senderId: true,
          sender: { select: { id: true, fullName: true, role: true } },
        },
      },
      _count: { select: { chatMessages: true } },
    },
  });

  const sorted = jobs
    .map((j) => {
      const last = j.chatMessages[0] ?? null;
      const access: ChatJobAccess = { ...j, bookingId: j.booking?.id ?? null };
      const preview =
        last?.message?.trim() ||
        (last?.imageUrl ? 'Photo' : null);
      return {
        conversationId: j.id,
        jobId: j.id,
        jobRef: j.jobRef,
        title: j.title,
        jobStatus: j.status,
        counterpart: counterpartFor(access, userId, role),
        lastMessage: last
          ? {
              id: last.id,
              message: last.message,
              imageUrl: last.imageUrl ?? null,
              readAt: last.readAt ?? null,
              preview,
              sentAt: last.sentAt,
              senderId: last.senderId,
              senderName: last.sender.fullName,
              senderRole: last.sender.role,
              isMine: last.senderId === userId,
            }
          : null,
        messagesCount: j._count.chatMessages,
        updatedAt: last?.sentAt ?? null,
      };
    })
    .sort((a, b) => {
      const at = a.updatedAt?.getTime() ?? 0;
      const bt = b.updatedAt?.getTime() ?? 0;
      return bt - at;
    });

  const total = sorted.length;
  const items = sorted.slice((page - 1) * limit, page * limit);

  return {
    items,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const listMessages = async (
  userId: string,
  role: UserRole,
  jobId: string,
  query: ChatMessagesQuery
) => {
  const job = await assertChatAccess(userId, role, jobId);
  const page = query.page;
  const limit = query.limit;

  // Opening the thread = mark counterpart's unread messages as read (read receipts).
  await markCounterpartMessagesRead(job.id, userId);

  const where: Prisma.ChatMessageWhereInput = { jobId: job.id };
  const [total, rows] = await Promise.all([
    prisma.chatMessage.count({ where }),
    prisma.chatMessage.findMany({
      where,
      orderBy: { sentAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sender: { select: { id: true, fullName: true, role: true, profilePhotoUrl: true } },
      },
    }),
  ]);

  return {
    conversationId: job.id,
    jobId: job.id,
    jobRef: job.jobRef,
    title: job.title,
    counterpart: counterpartFor(job, userId, role),
    items: rows.map((m) => serializeMessage(m, userId)),
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const sendMessage = async (
  userId: string,
  role: UserRole,
  jobId: string,
  input: { message?: string; imageUrl?: string | null }
) => {
  const text = (input.message ?? '').trim();
  const imageUrl = input.imageUrl?.trim() || null;
  if (!text && !imageUrl) {
    throw new BadRequestError('Provide message and/or imageUrl.');
  }
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    throw new BadRequestError('imageUrl must be a valid http(s) URL from POST /uploads.');
  }

  const job = await assertChatAccess(userId, role, jobId);

  const recipientUserId =
    role === UserRole.CUSTOMER
      ? job.trader?.userId ?? null
      : job.customerId;

  if (!recipientUserId) {
    throw new BadRequestError('No chat counterpart on this job yet.');
  }

  const created = await prisma.chatMessage.create({
    data: {
      jobId: job.id,
      bookingId: job.bookingId,
      senderId: userId,
      message: text,
      imageUrl,
    },
    include: {
      sender: { select: { id: true, fullName: true, role: true, profilePhotoUrl: true } },
    },
  });

  const pushText = text || (imageUrl ? 'Sent a photo' : '');

  emitChatMessage({
    recipientUserId,
    jobId: job.id,
    bookingId: created.bookingId,
    messageId: created.id,
    senderName: created.sender.fullName,
    senderPhotoUrl: created.sender.profilePhotoUrl,
    message: pushText,
  });

  return {
    conversationId: job.id,
    jobId: job.id,
    ...serializeMessage(created, userId),
  };
};
