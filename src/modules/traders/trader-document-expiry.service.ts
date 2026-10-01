import { TraderDocumentStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { formatDocumentExpiryDate } from '../document-rules/document-expiry';
import {
  DAY_MS,
  EXPIRY_REMINDER_WINDOW_DAYS,
  todayInReminderZone,
} from '../../services/document-expiry-reminder.service';

export type DocumentExpiryStatus = 'EXPIRED' | 'EXPIRES_TODAY' | 'EXPIRING_SOON';

export const expiryStatusFor = (daysLeft: number): DocumentExpiryStatus => {
  if (daysLeft < 0) return 'EXPIRED';
  if (daysLeft === 0) return 'EXPIRES_TODAY';
  return 'EXPIRING_SOON';
};

/** Trader dashboard: uploaded documents already expired or expiring within `withinDays` (soonest first). */
export const listExpiringDocuments = async (userId: string, withinDays?: number) => {
  const trader = await prisma.trader.findUnique({ where: { userId }, select: { id: true } });
  if (!trader) throw new NotFoundError('Trader profile not found.');

  const window = withinDays ?? EXPIRY_REMINDER_WINDOW_DAYS;
  const today = todayInReminderZone();
  const windowEnd = new Date(today.getTime() + window * DAY_MS);

  const docs = await prisma.traderDocument.findMany({
    where: {
      traderId: trader.id,
      expiryDate: { not: null, lte: windowEnd },
      status: { not: TraderDocumentStatus.REJECTED },
    },
    orderBy: { expiryDate: 'asc' },
    select: {
      id: true,
      documentRuleId: true,
      fileUrl: true,
      fileName: true,
      status: true,
      expiryDate: true,
      uploadedAt: true,
      documentRule: {
        select: { documentKey: true, name: true, scope: true, categoryId: true, required: true },
      },
    },
  });

  const items = docs.map((doc) => {
    const daysLeft = Math.round((doc.expiryDate!.getTime() - today.getTime()) / DAY_MS);
    return {
      id: doc.id,
      documentRuleId: doc.documentRuleId,
      documentKey: doc.documentRule.documentKey,
      documentName: doc.documentRule.name,
      scope: doc.documentRule.scope,
      categoryId: doc.documentRule.categoryId,
      required: doc.documentRule.required,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      status: doc.status,
      expiryDate: formatDocumentExpiryDate(doc.expiryDate),
      daysLeft,
      expiryStatus: expiryStatusFor(daysLeft),
      uploadedAt: doc.uploadedAt,
    };
  });

  return {
    items,
    total: items.length,
    expiredCount: items.filter((i) => i.expiryStatus === 'EXPIRED').length,
    expiringSoonCount: items.filter((i) => i.expiryStatus !== 'EXPIRED').length,
    withinDays: window,
  };
};
