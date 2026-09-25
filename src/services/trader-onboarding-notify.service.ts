import { AdminStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import {
  absoluteAdminWebUrl,
  absoluteTraderWebUrl,
  buildBrandedEmailHtml,
  escapeHtml,
  getAdminEmailCc,
  sendBrandedMail,
  sendMail,
} from './email.service';
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

/**
 * One branded admin email: To = primary inbox, CC = other admins + monitoring CC.
 * Same Survey white-card layout; optional blue CTA to Admin portal.
 */
const notifyAdminsByEmail = async (input: {
  subject: string;
  text: string;
  title: string;
  cta?: { label: string; url: string };
}) => {
  const paragraphs = input.text
    .split(/\n\n+/)
    .map((block) => escapeHtml(block.trim()).replace(/\n/g, '<br/>'))
    .filter(Boolean);
  const html = buildBrandedEmailHtml({
    title: input.title,
    paragraphs,
    audience: 'customer',
    cta: input.cta,
  });

  const recipients = await listActiveAdminEmails();
  const primary = recipients[0] || getAdminInbox();
  const cc = [
    ...new Set([
      ...recipients.slice(1),
      ...getAdminEmailCc(),
    ].map((e) => e.trim()).filter(Boolean)),
  ].filter((e) => e.toLowerCase() !== primary.toLowerCase());

  const textWithCta = input.cta
    ? `${input.text}\n\n${input.cta.label}: ${input.cta.url}`
    : input.text;

  await sendMail({
    to: primary,
    cc,
    subject: input.subject,
    text: textWithCta,
    html,
  }).catch((err) => {
    logger.warn('[NOTIFY] Admin email failed', {
      to: primary,
      subject: input.subject,
      err: String(err),
    });
  });
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

  const path = traderId
    ? adminNotificationActionUrl.traderDetail(traderId)
    : '/traders';

  await notifyAdminsByEmail({
    subject,
    text,
    title: 'New trader verified OTP',
    cta: { label: 'View trader', url: absoluteAdminWebUrl(path) },
  });
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

  await notifyAdminsByEmail({
    subject,
    text,
    title: 'Trader pending approval',
    cta: {
      label: 'Open trader details',
      url: absoluteAdminWebUrl(adminNotificationActionUrl.traderDetail(input.traderId)),
    },
  });
  await notifyAdminsInApp({
    type: 'TRADER_PENDING_APPROVAL',
    title: 'Trader pending approval',
    message: `${input.fullName} submitted documents and is awaiting verification.`,
    actionUrl: adminNotificationActionUrl.traderDetail(input.traderId),
    payload: {
      traderId: input.traderId,
      traderUserId: input.traderUserId,
      email: input.email,
    },
  });

  await notifyTraderOnboardingSubmitted({
    userId: input.traderUserId,
    fullName: input.fullName,
    email: input.email,
  });
};

/** After trader submits onboarding - confirmation to the trader. */
export const notifyTraderOnboardingSubmitted = async (input: {
  userId: string;
  fullName: string;
  email: string;
}) => {
  const subject = 'We received your BRISK trader application';
  const name = escapeHtml(input.fullName);
  const text = [
    `Hi ${input.fullName},`,
    '',
    'Thanks for submitting your BRISK trader application.',
    'Our team is reviewing your documents. You will receive another email once your profile is approved or if we need more information.',
    '',
    'Regards,',
    'BRISK Team',
  ].join('\n');

  await sendBrandedMail({
    to: input.email,
    subject,
    title: 'Application received',
    audience: 'trader',
    text,
    paragraphs: [
      `Hi ${name},`,
      'Thanks for submitting your BRISK trader application.',
      'Our team is reviewing your documents. You will receive another email once your profile is approved or if we need more information.',
    ],
    cta: {
      label: 'View application status',
      url: absoluteTraderWebUrl(traderNotificationActionUrl.onboardingPendingReview()),
    },
  }).catch((err) => {
    logger.warn('[NOTIFY] Trader submit confirmation email failed', {
      email: input.email,
      err: String(err),
    });
  });

  await createUserNotification(input.userId, 'TRADER_ONBOARDING_SUBMITTED', {
    title: 'Application received',
    message:
      'Your trader application was submitted. We will email you when the review is complete.',
    actionUrl: traderNotificationActionUrl.onboardingPendingReview(),
  });
};

/** After admin approves trader profile. */
export const notifyTraderProfileApproved = async (input: {
  userId: string;
  fullName: string;
  email: string;
}) => {
  const subject = 'Your BRISK trader profile has been approved';
  const name = escapeHtml(input.fullName);
  const text = [
    `Hi ${input.fullName},`,
    '',
    'Great news - your BRISK trader profile has been approved.',
    'You can now log in and start discovering jobs.',
    '',
    'Regards,',
    'BRISK Team',
  ].join('\n');

  await sendBrandedMail({
    to: input.email,
    subject,
    title: 'Profile approved',
    audience: 'trader',
    text,
    paragraphs: [
      `Hi ${name},`,
      'Great news - your BRISK trader profile has been approved.',
      'You can now log in and start discovering jobs.',
    ],
    cta: {
      label: 'Open BRISK Trader',
      url: absoluteTraderWebUrl(traderNotificationActionUrl.dashboard()),
    },
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

  await sendBrandedMail({
    to: input.email,
    subject,
    title: 'Application update',
    audience: 'trader',
    text,
    paragraphs: [
      `Hi ${escapeHtml(input.fullName)},`,
      'Your BRISK trader application was not approved at this time.',
      escapeHtml(reasonLine),
    ],
    cta: {
      label: 'Review application',
      url: absoluteTraderWebUrl(traderNotificationActionUrl.onboardingPendingReview()),
    },
  }).catch((err) => {
    logger.warn('[NOTIFY] Trader rejection email failed', { email: input.email, err: String(err) });
  });

  await createUserNotification(input.userId, 'TRADER_PROFILE_REJECTED', {
    title: 'Application update',
    message: input.reason?.trim() || 'Your trader application was not approved.',
    actionUrl: traderNotificationActionUrl.onboardingPendingReview(),
  });
};

/** After trader uploads/replaces a document (admin inbox + email with CTA). */
export const notifyAdminTraderDocumentUploaded = async (input: {
  traderId: string;
  traderUserId: string;
  fullName: string;
  email: string;
  documentId: string;
  documentRuleId: string;
  documentName: string;
  fileName?: string | null;
}) => {
  const subject = `[BRISK] Document uploaded - ${input.fullName} · ${input.documentName}`;
  const text = [
    'A trader uploaded or replaced a document for review.',
    '',
    `Name: ${input.fullName}`,
    `Email: ${input.email}`,
    `Document: ${input.documentName}`,
    input.fileName ? `File: ${input.fileName}` : null,
    `Trader ID: ${input.traderId}`,
    `Document ID: ${input.documentId}`,
    '',
    'Open the trader detail page to review the document.',
  ]
    .filter(Boolean)
    .join('\n');

  await notifyAdminsByEmail({
    subject,
    text,
    title: 'New document uploaded',
    cta: {
      label: 'Open trader details',
      url: absoluteAdminWebUrl(adminNotificationActionUrl.traderDetail(input.traderId)),
    },
  });

  await notifyAdminsInApp({
    type: 'TRADER_DOCUMENT_UPLOADED',
    title: 'New document uploaded',
    message: `${input.fullName} uploaded "${input.documentName}".`,
    actionUrl: adminNotificationActionUrl.traderDetail(input.traderId),
    payload: {
      traderId: input.traderId,
      traderUserId: input.traderUserId,
      documentId: input.documentId,
      documentRuleId: input.documentRuleId,
      documentName: input.documentName,
      fileName: input.fileName ?? null,
      email: input.email,
    },
  });
};

/** After admin approves or rejects a single trader document. */
export const notifyTraderDocumentReviewed = async (input: {
  userId: string;
  email: string;
  fullName: string;
  documentId: string;
  documentName: string;
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
}) => {
  const approved = input.status === 'APPROVED';
  const reason = input.rejectionReason?.trim();
  const name = input.fullName?.trim() || 'there';
  const docName = escapeHtml(input.documentName);
  const documentUrl = absoluteTraderWebUrl(
    traderNotificationActionUrl.documentDetail(input.documentId)
  );

  const subject = approved
    ? `Your BRISK document "${input.documentName}" was approved`
    : `Action needed: your BRISK document "${input.documentName}" was rejected`;

  const text = approved
    ? [
        `Hi ${name},`,
        '',
        `Good news - your document "${input.documentName}" has been approved.`,
        '',
        'You can continue with your BRISK trader application in the app.',
        '',
        `Open document: ${documentUrl}`,
        '',
        'Regards,',
        'BRISK Team',
      ].join('\n')
    : [
        `Hi ${name},`,
        '',
        `Your document "${input.documentName}" was not approved.`,
        reason ? `Reason: ${reason}` : 'Please upload a clearer copy and try again.',
        '',
        'Open the BRISK trader app to review and re-upload the document.',
        '',
        `Open document: ${documentUrl}`,
        '',
        'Regards,',
        'BRISK Team',
      ].join('\n');

  const paragraphs = approved
    ? [
        `Hi ${escapeHtml(name)},`,
        `Good news - your document "<strong>${docName}</strong>" has been approved.`,
        'You can continue with your BRISK trader application in the app.',
      ]
    : [
        `Hi ${escapeHtml(name)},`,
        `Your document "<strong>${docName}</strong>" was not approved.`,
        reason
          ? `Reason: ${escapeHtml(reason)}`
          : 'Please upload a clearer copy and try again.',
        'Open the BRISK trader app to review and re-upload the document.',
      ];

  await sendBrandedMail({
    to: input.email,
    subject,
    title: approved ? 'Document approved' : 'Document needs attention',
    audience: 'trader',
    text,
    paragraphs,
    cta: {
      label: approved ? 'View document' : 'Re-upload document',
      url: documentUrl,
    },
  }).catch((err) => {
    logger.warn('[NOTIFY] Trader document review email failed', {
      email: input.email,
      documentId: input.documentId,
      status: input.status,
      err: String(err),
    });
  });

  await createUserNotification(
    input.userId,
    approved ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
    {
      title: approved ? 'Document approved' : 'Document needs attention',
      message: approved
        ? `Your document "${input.documentName}" was approved.`
        : reason
          ? `Your document "${input.documentName}" was rejected. ${reason}`
          : `Your document "${input.documentName}" was rejected.`,
      actionUrl: traderNotificationActionUrl.documentDetail(input.documentId),
      documentId: input.documentId,
      documentName: input.documentName,
      status: input.status,
      ...(reason ? { rejectionReason: reason } : {}),
    }
  );
};
