import { AdminStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { sendMail } from './email.service';
import { createAdminNotifications } from '../modules/admin/admin-notifications/admin-notifications.service';
import {
  adminNotificationActionUrl,
  traderNotificationActionUrl,
} from '../modules/notifications/notification-action-urls';

const getAdminInbox = (): string =>
  process.env.CONTACT_ADMIN_EMAIL?.trim() || 'support@brisk.ie';

const listActiveAdminEmails = async (): Promise<string[]> => {
  const admins = await prisma.adminUser.findMany({
    where: { status: AdminStatus.ACTIVE },
    select: { email: true },
    take: 50,
  });
  const emails = admins.map((a) => a.email).filter(Boolean);
  const inbox = getAdminInbox();
  return [...new Set([inbox, ...emails])];
};

const notifyAdminsByEmail = async (subject: string, text: string, html?: string) => {
  const recipients = await listActiveAdminEmails();
  await Promise.all(
    recipients.map((to) =>
      sendMail({ to, subject, text, html }).catch((err) => {
        logger.warn('[NOTIFY] Admin email failed', { to, subject, err: String(err) });
      })
    )
  );
};

const notifyAdminsInApp = async (input: {
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  payload?: Record<string, unknown>;
}) => {
  await createAdminNotifications(input).catch((err) => {
    logger.warn('[NOTIFY] Admin in-app notification failed', {
      type: input.type,
      err: String(err),
    });
  });
};

const createUserNotification = async (
  userId: string,
  type: string,
  payload: Record<string, string>
) => {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        payload,
      },
    });
  } catch (err) {
    logger.warn('[NOTIFY] In-app notification failed', { userId, type, err: String(err) });
  }
};

const resolveTraderIdForUser = async (traderUserId: string): Promise<string | null> => {
  const trader = await prisma.trader.findUnique({
    where: { userId: traderUserId },
    select: { id: true },
  });
  return trader?.id ?? null;
};

/** After trader verifies both email + mobile OTP. */
export const notifyAdminTraderOtpVerified = async (input: {
  traderUserId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
}) => {
  const traderId = await resolveTraderIdForUser(input.traderUserId);
  const subject = `[BRISK] New trader verified OTP - ${input.fullName}`;
  const text = [
    'A trader has successfully verified email and mobile OTP.',
    '',
    `Name: ${input.fullName}`,
    `Email: ${input.email}`,
    `Mobile: ${input.mobileNumber}`,
    `User ID: ${input.traderUserId}`,
    traderId ? `Trader ID: ${traderId}` : null,
    '',
    'They can now continue onboarding.',
  ]
    .filter(Boolean)
    .join('\n');

  await notifyAdminsByEmail(subject, text);
  await notifyAdminsInApp({
    type: 'TRADER_OTP_VERIFIED',
    title: 'New trader verified OTP',
    message: `${input.fullName} verified email and mobile OTP.`,
    actionUrl: traderId ? adminNotificationActionUrl.traderDetail(traderId) : '/traders',
    payload: {
      ...(traderId ? { traderId } : {}),
      traderUserId: input.traderUserId,
      email: input.email,
      mobileNumber: input.mobileNumber,
    },
  });
};

/** After trader submits onboarding documents (pending approval). */
export const notifyAdminTraderPendingApproval = async (input: {
  traderId: string;
  traderUserId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
}) => {
  const subject = `[BRISK] Trader pending approval - ${input.fullName}`;
  const text = [
    'A trader has submitted onboarding documents and is pending admin verification.',
    '',
    `Name: ${input.fullName}`,
    `Email: ${input.email}`,
    `Mobile: ${input.mobileNumber}`,
    `Trader ID: ${input.traderId}`,
    `User ID: ${input.traderUserId}`,
    '',
    'Review in Admin > Trader Verification.',
  ].join('\n');

  await notifyAdminsByEmail(subject, text);
  await notifyAdminsInApp({
    type: 'TRADER_PENDING_APPROVAL',
    title: 'Trader pending approval',
    message: `${input.fullName} submitted documents and is awaiting verification.`,
    actionUrl: adminNotificationActionUrl.traderVerificationDetail(input.traderId),
    payload: {
      traderId: input.traderId,
      traderUserId: input.traderUserId,
      email: input.email,
    },
  });
};

/** After admin approves trader profile. */
export const notifyTraderProfileApproved = async (input: {
  userId: string;
  fullName: string;
  email: string;
}) => {
  const subject = 'Your BRISK trader profile has been approved';
  const text = [
    `Hi ${input.fullName},`,
    '',
    'Great news - your BRISK trader profile has been approved.',
    'You can now log in and start discovering jobs.',
    '',
    'Regards,',
    'BRISK Team',
  ].join('\n');

  await sendMail({
    to: input.email,
    subject,
    text,
  }).catch((err) => {
    logger.warn('[NOTIFY] Trader approval email failed', { email: input.email, err: String(err) });
  });

  await createUserNotification(input.userId, 'TRADER_PROFILE_APPROVED', {
    title: 'Profile approved',
    message: 'Your BRISK trader profile has been approved. You can now use the app.',
    actionUrl: traderNotificationActionUrl.dashboard(),
  });
};

/** Optional: after admin rejects trader profile. */
export const notifyTraderProfileRejected = async (input: {
  userId: string;
  fullName: string;
  email: string;
  reason?: string | null;
}) => {
  const subject = 'Update on your BRISK trader application';
  const reasonLine = input.reason?.trim()
    ? `Reason: ${input.reason.trim()}`
    : 'Please review your documents and resubmit if needed.';
  const text = [
    `Hi ${input.fullName},`,
    '',
    'Your BRISK trader application was not approved at this time.',
    reasonLine,
    '',
    'Regards,',
    'BRISK Team',
  ].join('\n');

  await sendMail({ to: input.email, subject, text }).catch((err) => {
    logger.warn('[NOTIFY] Trader rejection email failed', { email: input.email, err: String(err) });
  });

  await createUserNotification(input.userId, 'TRADER_PROFILE_REJECTED', {
    title: 'Application update',
    message: input.reason?.trim() || 'Your trader application was not approved.',
    actionUrl: traderNotificationActionUrl.onboardingPendingReview(),
  });
};
