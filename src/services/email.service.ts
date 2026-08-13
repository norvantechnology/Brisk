import { logger } from '../utils/logger';

const DEFAULT_ADMIN_EMAIL = 'support@briskmarket.com';
const DEFAULT_FROM_EMAIL = 'noreply@briskmarket.com';

export type ContactEmailPayload = {
  referenceCode: string;
  fullName: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
};

const getAdminEmail = (): string =>
  process.env.CONTACT_ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;

const getFromEmail = (): string =>
  process.env.CONTACT_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;

/**
 * v1 mock email — logs payload until SMTP/SES is wired.
 * Submission is still saved even if this throws (caller catches).
 */
export const sendContactConfirmationToUser = async (
  payload: ContactEmailPayload
): Promise<void> => {
  logger.info('[EMAIL MOCK] Contact confirmation → user', {
    to: payload.email,
    from: getFromEmail(),
    subject: `We received your message (${payload.referenceCode})`,
    body: `Hi ${payload.fullName}, thank you for contacting BRISK. Reference: ${payload.referenceCode}. We will reply within 24–48 hours.`,
  });
};

export const sendContactNotificationToAdmin = async (
  payload: ContactEmailPayload
): Promise<void> => {
  logger.info('[EMAIL MOCK] Contact notification → admin', {
    to: getAdminEmail(),
    from: getFromEmail(),
    subject: `New Contact Us submission (${payload.referenceCode}) — ${payload.subject}`,
    body: `${payload.fullName} <${payload.email}> | ${payload.phone ?? 'no phone'}\n\n${payload.message}`,
  });
};

export const sendContactEmails = async (
  payload: ContactEmailPayload
): Promise<{ userEmailSent: boolean; adminEmailSent: boolean }> => {
  let userEmailSent = false;
  let adminEmailSent = false;

  try {
    await sendContactConfirmationToUser(payload);
    userEmailSent = true;
  } catch (error) {
    logger.warn('Failed to send contact confirmation email to user', { error, payload });
  }

  try {
    await sendContactNotificationToAdmin(payload);
    adminEmailSent = true;
  } catch (error) {
    logger.warn('Failed to send contact notification email to admin', { error, payload });
  }

  return { userEmailSent, adminEmailSent };
};
