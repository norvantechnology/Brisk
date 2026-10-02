import { randomUUID } from 'crypto';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { pushUserNotification } from '../../sockets/realtime';
import type { COMPANY_UPDATE_TYPES } from './notification-types';

const USER_BATCH = 1000;

export type CompanyUpdateInput = {
  type: (typeof COMPANY_UPDATE_TYPES)[number];
  title: string;
  message: string;
  audience: 'ALL' | 'TRADERS' | 'CUSTOMERS';
  actionLabel?: string;
  actionUrl?: string;
};

/** Admin → BRISK tab (Company Updates) for every active trader and/or customer. */
export const sendCompanyUpdate = async (input: CompanyUpdateInput) => {
  const where: Prisma.UserWhereInput = {
    status: { notIn: [UserStatus.BLOCKED, UserStatus.SUSPENDED, UserStatus.INACTIVE] },
    ...(input.audience === 'TRADERS'
      ? { role: UserRole.TRADER }
      : input.audience === 'CUSTOMERS'
        ? { role: UserRole.CUSTOMER }
        : {}),
  };
  const broadcastId = randomUUID();
  const at = new Date().toISOString();
  let recipients = 0;
  let cursor: string | undefined;

  for (;;) {
    const users = await prisma.user.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      take: USER_BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!users.length) break;
    await pushUserNotification(
      users.map((u) => u.id),
      {
        type: input.type,
        title: input.title,
        message: input.message,
        data: {
          broadcastId,
          audience: input.audience,
          actionLabel: input.actionLabel ?? null,
          ...(input.actionUrl ? { actionUrl: input.actionUrl } : {}),
        },
        at,
      }
    );
    recipients += users.length;
    if (users.length < USER_BATCH) break;
    cursor = users[users.length - 1].id;
  }

  return { broadcastId, type: input.type, audience: input.audience, recipients, sentAt: at };
};
