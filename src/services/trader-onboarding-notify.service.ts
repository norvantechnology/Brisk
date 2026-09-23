import { AdminStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { sendMail } from './email.service';

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

/** After trader verifies both email + mobile OTP. */
export const notifyAdminTraderOtpVerified = async (input: {
  traderUserId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
}) => {
  const subject = `[BRISK] New trader verified OTP — ${input.fullName}`;
  const text = [
    'A trader has successfully verified email and mobile OTP.',
    '',
    `Name: ${input.fullName}`,
    `Email: ${input.email}`,
    `Mobile: ${input.mobileNumber}`,
    `User ID: ${input.traderUserId}`,
    '',
    'They can now continue onboarding.',
  ].join('\n');

  await notifyAdminsByEmail(subject, text);

  // No User-linked admin inbox for in-app — email is the admin channel.
  logger.info('[NOTIFY] Admin informed of trader OTP verification', {
    traderUserId: input.traderUserId,
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
  const subject = `[BRISK] Trader pending approval — ${input.fullName}`;
  const text = [
    'A trader has submitted onboarding documents and is pending admin verification.',
    '',
    `Name: ${input.fullName}`,
    `Email: ${input.email}`,
    `Mobile: ${input.mobileNumber}`,
    `Trader ID: ${input.traderId}`,
    `User ID: ${input.traderUserId}`,
    '',
    'Review in Admin → Trader Verification.',
  ].join('\n');

  await notifyAdminsByEmail(subject, text);
  logger.info('[NOTIFY] Admin informed of pending trader approval', {
    traderId: input.traderId,
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
    'Great news — your BRISK trader profile has been approved.',
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
  });
};
