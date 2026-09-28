import { Prisma, TraderDocumentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { absoluteAdminWebUrl, absoluteTraderWebUrl, escapeHtml, sendBrandedMail } from './email.service';
import {
  createUserNotification,
  notifyAdminsByEmail,
  notifyAdminsInApp,
} from './trader-onboarding-notify.service';
import {
  adminNotificationActionUrl,
  traderNotificationActionUrl,
} from '../modules/notifications/notification-action-urls';
import { formatDocumentExpiryDate } from '../modules/document-rules/document-expiry';

/** Reminder stages = days before expiry. 0 = on (or after) the expiry day. */
const REMINDER_STAGES = [30, 7, 1, 0] as const;
const MAX_STAGE = REMINDER_STAGES[0];
/** Days before expiry when a document counts as "expiring soon" (first reminder). */
export const EXPIRY_REMINDER_WINDOW_DAYS = MAX_STAGE;
const REMINDER_TIME_ZONE = 'Europe/Dublin';
const RUN_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;
const BATCH_SIZE = 200;
export const DAY_MS = 24 * 60 * 60 * 1000;

const reminderDocSelect = {
  id: true,
  expiryDate: true,
  expiryReminderStage: true,
  documentRule: { select: { name: true } },
  trader: {
    select: {
      id: true,
      userId: true,
      traderCode: true,
      user: { select: { fullName: true, email: true } },
    },
  },
} satisfies Prisma.TraderDocumentSelect;

type ReminderDoc = Prisma.TraderDocumentGetPayload<{ select: typeof reminderDocSelect }>;

type SentReminder = {
  doc: ReminderDoc;
  daysLeft: number;
  expiryDate: string;
};

/** Today's calendar date in Ireland as a UTC-midnight Date (matches @db.Date storage). */
export const todayInReminderZone = (now = new Date()): Date => {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: REMINDER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
};

const stageForDaysLeft = (daysLeft: number): number | null => {
  if (daysLeft > MAX_STAGE) return null;
  let stage: number = MAX_STAGE;
  for (const s of REMINDER_STAGES) {
    if (daysLeft <= s) stage = s;
  }
  return stage;
};

const expiryPhrase = (daysLeft: number, expiryDate: string): string => {
  if (daysLeft < 0) return `expired on ${expiryDate}`;
  if (daysLeft === 0) return `expires today (${expiryDate})`;
  if (daysLeft === 1) return `expires tomorrow (${expiryDate})`;
  return `expires in ${daysLeft} days (${expiryDate})`;
};

const notifyTrader = async ({ doc, daysLeft, expiryDate }: SentReminder) => {
  const { trader } = doc;
  const docName = doc.documentRule.name;
  const phrase = expiryPhrase(daysLeft, expiryDate);
  const name = trader.user.fullName?.trim() || 'there';
  const actionUrl = traderNotificationActionUrl.documentDetail(doc.id);
  const expired = daysLeft <= 0;
  const title = expired ? 'Document expired' : 'Document expiring soon';

  await createUserNotification(trader.userId, 'DOCUMENT_EXPIRY_REMINDER', {
    title,
    message: `Your document "${docName}" ${phrase}. Please upload a renewed copy.`,
    actionUrl,
    documentId: doc.id,
    documentName: docName,
    expiryDate,
    daysLeft: String(daysLeft),
  });

  await sendBrandedMail({
    to: trader.user.email,
    subject: expired
      ? `Action needed: your BRISK document "${docName}" has expired`
      : `Reminder: your BRISK document "${docName}" ${phrase}`,
    title,
    audience: 'trader',
    paragraphs: [
      `Hi ${escapeHtml(name)},`,
      `Your document "<strong>${escapeHtml(docName)}</strong>" ${escapeHtml(phrase)}.`,
      'Please upload a renewed copy in the BRISK trader app to keep your profile active.',
    ],
    cta: { label: 'Upload renewed document', url: absoluteTraderWebUrl(actionUrl) },
  }).catch((err) => {
    logger.warn('[DOC_EXPIRY] Trader reminder email failed', {
      documentId: doc.id,
      err: String(err),
    });
  });
};

const notifyAdminsForReminder = async ({ doc, daysLeft, expiryDate }: SentReminder) => {
  const { trader } = doc;
  await notifyAdminsInApp({
    type: 'TRADER_DOCUMENT_EXPIRY',
    title: daysLeft <= 0 ? 'Trader document expired' : 'Trader document expiring soon',
    message: `${trader.user.fullName}: "${doc.documentRule.name}" ${expiryPhrase(daysLeft, expiryDate)}.`,
    actionUrl: adminNotificationActionUrl.traderDetail(trader.id),
    payload: {
      traderId: trader.id,
      traderUserId: trader.userId,
      documentId: doc.id,
      documentName: doc.documentRule.name,
      expiryDate,
      daysLeft,
    },
  });
};

/** One admin email per run listing every reminder sent (avoids one email per document). */
const sendAdminDigest = async (sent: SentReminder[]) => {
  if (sent.length === 0) return;
  const lines = sent
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .map(({ doc, daysLeft, expiryDate }) => {
      const code = doc.trader.traderCode ? ` (${doc.trader.traderCode})` : '';
      return `- ${doc.trader.user.fullName}${code}: ${doc.documentRule.name} ${expiryPhrase(daysLeft, expiryDate)}`;
    });
  await notifyAdminsByEmail({
    subject: `[BRISK] Trader document expiry reminders (${sent.length})`,
    title: 'Trader document expiry reminders',
    text: ['These trader documents are expiring or have expired:', '', ...lines].join('\n'),
    cta: { label: 'Open traders', url: absoluteAdminWebUrl('/traders') },
  });
};

/**
 * Sends each reminder stage once per document (30 / 7 / 1 days before, and on the expiry day).
 * Idempotent: the stage is claimed atomically before notifying, so overlapping runs never double-send.
 */
export const runDocumentExpiryReminders = async (now = new Date()) => {
  const today = todayInReminderZone(now);
  const windowEnd = new Date(today.getTime() + MAX_STAGE * DAY_MS);
  const sent: SentReminder[] = [];
  let cursor: string | undefined;

  for (;;) {
    const docs = await prisma.traderDocument.findMany({
      where: {
        expiryDate: { not: null, lte: windowEnd },
        status: { not: TraderDocumentStatus.REJECTED },
        OR: [{ expiryReminderStage: null }, { expiryReminderStage: { gt: 0 } }],
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: reminderDocSelect,
    });
    if (docs.length === 0) break;
    cursor = docs[docs.length - 1].id;

    for (const doc of docs) {
      if (!doc.expiryDate) continue;
      const daysLeft = Math.round((doc.expiryDate.getTime() - today.getTime()) / DAY_MS);
      const stage = stageForDaysLeft(daysLeft);
      if (stage === null) continue;
      if (doc.expiryReminderStage !== null && stage >= doc.expiryReminderStage) continue;

      const claimed = await prisma.traderDocument.updateMany({
        where: {
          id: doc.id,
          expiryDate: doc.expiryDate,
          expiryReminderStage: doc.expiryReminderStage,
        },
        data: { expiryReminderStage: stage },
      });
      if (claimed.count === 0) continue;

      const reminder: SentReminder = {
        doc,
        daysLeft,
        expiryDate: formatDocumentExpiryDate(doc.expiryDate)!,
      };
      await notifyTrader(reminder);
      await notifyAdminsForReminder(reminder);
      sent.push(reminder);
    }

    if (docs.length < BATCH_SIZE) break;
  }

  await sendAdminDigest(sent);
  if (sent.length > 0) {
    logger.info(`[DOC_EXPIRY] Sent ${sent.length} document expiry reminder(s).`);
  }
  return { sent: sent.length };
};

let running = false;

const runSafely = async () => {
  if (running) return;
  running = true;
  try {
    await runDocumentExpiryReminders();
  } catch (err) {
    logger.error('[DOC_EXPIRY] Reminder run failed', err);
  } finally {
    running = false;
  }
};

/** Hourly check; each stage is still sent only once per document. Disable with DOCUMENT_EXPIRY_REMINDERS=off. */
export const startDocumentExpiryReminderScheduler = () => {
  if (process.env.DOCUMENT_EXPIRY_REMINDERS === 'off') {
    logger.info('[DOC_EXPIRY] Reminder scheduler disabled (DOCUMENT_EXPIRY_REMINDERS=off).');
    return;
  }
  setTimeout(runSafely, FIRST_RUN_DELAY_MS).unref();
  setInterval(runSafely, RUN_INTERVAL_MS).unref();
  logger.info('[DOC_EXPIRY] Reminder scheduler started (30 / 7 / 1 / 0 days before expiry).');
};
