import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from '../utils/logger';

const DEFAULT_ADMIN_EMAIL = 'support@brisk.ie';
/** Manager: survey + transactional from-address */
const DEFAULT_FROM_EMAIL = 'noreply@brisk.ie';
/** Hosted logos (no MIME attachments - Gmail flags CID/attachments as phishing). */
const EMAIL_LOGOS = {
  consumer: { filename: 'brisk-logo.png', width: 231, height: 88 },
  trader: { filename: 'brisk-logo-trader.png', width: 231, height: 88 },
} as const;

type EmailLogoKind = keyof typeof EMAIL_LOGOS;

const getPublicAssetBaseUrl = (): string =>
  (
    process.env.PUBLIC_API_URL ||
    process.env.UPLOAD_PUBLIC_BASE_URL ||
    process.env.PUBLIC_API_BASE_URL ||
    'https://api.brisk.ie'
  ).replace(/\/$/, '');

const getEmailLogoUrl = (kind: EmailLogoKind): string =>
  `${getPublicAssetBaseUrl()}/assets/email/${EMAIL_LOGOS[kind].filename}?v=2`;

export type ContactEmailPayload = {
  referenceCode: string;
  fullName: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
};

export type SurveyWaitlistEmailPayload = {
  fullName: string;
  email: string;
  registrationCode?: string;
};

const getAdminEmail = (): string =>
  process.env.CONTACT_ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;

const getFromEmail = (): string =>
  process.env.CONTACT_FROM_EMAIL?.trim() ||
  process.env.MAIL_FROM?.trim() ||
  DEFAULT_FROM_EMAIL;

/** Auth mailbox (may differ from visible From). Hostinger often requires SMTP_USER to send. */
const getSmtpUser = (): string | undefined => process.env.SMTP_USER?.trim() || undefined;

const getSmtpPass = (): string | undefined => {
  const raw = process.env.SMTP_PASS;
  if (raw == null) return undefined;
  // Strip wrapping quotes from .env values like 'pass&word'
  return raw.trim().replace(/^['"]|['"]$/g, '');
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const wrapHtmlEmail = (
  title: string,
  paragraphs: string[],
  options?: { logo?: EmailLogoKind }
): string => {
  const body = paragraphs
    .map(
      (p) =>
        `<tr><td style="padding:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1e293b;">${p}</td></tr>`
    )
    .join('');
  const logo = options?.logo ? EMAIL_LOGOS[options.logo] : null;
  const logoRow = logo
    ? `<tr>
      <td align="center" style="padding:0 0 24px 0;">
        <img src="${getEmailLogoUrl(options!.logo!)}" alt="BRISK - Making Things Quicker" width="${logo.width}" height="${logo.height}" style="display:block;width:${logo.width}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
      </td>
    </tr>`
    : '';
  const titleAlign = logo ? 'center' : 'left';

  // Table layout is more reliable in Gmail than div + width:100% images.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;">
          <tr>
            <td style="padding:28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${logoRow}
                <tr>
                  <td align="${titleAlign}" style="padding:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;line-height:1.3;color:#0f172a;">
                    ${title}
                  </td>
                </tr>
                ${body}
                <tr>
                  <td style="padding:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#64748b;">
                    Brisk - Making things Quicker.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const getSmtpTransport = (): Transporter | null => {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const user = getSmtpUser();
  const pass = getSmtpPass();
  const secure =
    process.env.SMTP_SECURE === 'true' ||
    process.env.SMTP_SECURE === '1' ||
    port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });
};

/**
 * Sends email via SMTP when SMTP_HOST is set; otherwise logs.
 * Visible From header is always noreply@brisk.ie (MAIL_FROM).
 * When SMTP auth mailbox differs, use envelope/sender = SMTP_USER so Hostinger
 * accepts the message while the recipient still sees noreply@brisk.ie.
 */
export const sendMail = async (input: SendMailInput): Promise<void> => {
  const fromAddress = getFromEmail();
  const smtpUser = getSmtpUser();
  const transport = getSmtpTransport();

  if (!transport) {
    logger.info('[EMAIL] SMTP not configured - logging outbound mail', {
      to: input.to,
      from: fromAddress,
      subject: input.subject,
      text: input.text,
    });
    return;
  }

  const useEnvelope =
    Boolean(smtpUser) && smtpUser!.toLowerCase() !== fromAddress.toLowerCase();

  await transport.sendMail({
    from: `Brisk <${fromAddress}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? input.text.replace(/\n/g, '<br/>'),
    replyTo: fromAddress,
    ...(useEnvelope
      ? {
          sender: smtpUser,
          envelope: { from: smtpUser!, to: input.to },
        }
      : {}),
  });

  logger.info('[EMAIL] Sent', {
    to: input.to,
    from: fromAddress,
    envelopeFrom: useEnvelope ? smtpUser : fromAddress,
    subject: input.subject,
  });
};

export const sendContactConfirmationToUser = async (
  payload: ContactEmailPayload
): Promise<void> => {
  const subject = `We received your message (${payload.referenceCode})`;
  const text = `Hi ${payload.fullName},

Thank you for contacting BRISK. Reference: ${payload.referenceCode}.
We will reply within 24–48 hours.

Brisk - Making things Quicker.`;

  await sendMail({
    to: payload.email,
    subject,
    text,
    html: wrapHtmlEmail('We received your message', [
      `Hi ${escapeHtml(payload.fullName)},`,
      `Thank you for contacting BRISK. Reference: <strong>${escapeHtml(payload.referenceCode)}</strong>.`,
      'We will reply within 24–48 hours.',
    ]),
  });
};

export const sendContactNotificationToAdmin = async (
  payload: ContactEmailPayload
): Promise<void> => {
  const subject = `New Contact Us submission (${payload.referenceCode}) - ${payload.subject}`;
  const text = `${payload.fullName} <${payload.email}> | ${payload.phone ?? 'no phone'}

${payload.message}`;

  await sendMail({
    to: getAdminEmail(),
    subject,
    text,
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

/** Website consumer survey / waitlist confirmation */
export const sendConsumerSurveyWaitlistEmail = async (
  payload: SurveyWaitlistEmailPayload
): Promise<void> => {
  const subject = '🏠 You’re on the Brisk Waitlist';
  const text = `Thanks for your interest in Brisk.

We’re currently building Brisk - a new way to make finding a trusted tradesperson for your home simpler, easier and less stressful.

By joining the waitlist, you’ll be among the first to hear when Brisk launches and when you can start using the platform to find the right tradesperson for your home.

We’ll keep you updated as we get closer.

Brisk - Making things Quicker.`;

  await sendMail({
    to: payload.email,
    subject,
    text,
    html: wrapHtmlEmail(
      'You’re on the Brisk Waitlist',
      [
        'Thanks for your interest in Brisk.',
        'We’re currently building Brisk - a new way to make finding a trusted tradesperson for your home simpler, easier and less stressful.',
        'By joining the waitlist, you’ll be among the first to hear when Brisk launches and when you can start using the platform to find the right tradesperson for your home.',
        'We’ll keep you updated as we get closer.',
      ],
      { logo: 'consumer' }
    ),
  });
};

/** Website trader survey / waitlist confirmation */
export const sendTraderSurveyWaitlistEmail = async (
  payload: SurveyWaitlistEmailPayload
): Promise<void> => {
  const subject = '🔨 You’re on the Brisk Trader Waitlist';
  const text = `Thanks for your interest in Brisk.

We’re currently building Brisk - a new platform designed to make it easier for tradespeople to find new customers, manage jobs and grow their business.

By joining the waitlist, you’ll be among the first traders to hear when Brisk launches and when we’re ready to welcome traders onto the platform.

We’ll keep you updated as we get closer.

Brisk - Making things Quicker.`;

  await sendMail({
    to: payload.email,
    subject,
    text,
    html: wrapHtmlEmail(
      'You’re on the Brisk Trader Waitlist',
      [
        'Thanks for your interest in Brisk.',
        'We’re currently building Brisk - a new platform designed to make it easier for tradespeople to find new customers, manage jobs and grow their business.',
        'By joining the waitlist, you’ll be among the first traders to hear when Brisk launches and when we’re ready to welcome traders onto the platform.',
        'We’ll keep you updated as we get closer.',
      ],
      { logo: 'trader' }
    ),
  });
};

export const sendSurveyWaitlistEmailSafe = async (
  kind: 'consumer' | 'trader',
  payload: SurveyWaitlistEmailPayload
): Promise<boolean> => {
  try {
    if (kind === 'consumer') {
      await sendConsumerSurveyWaitlistEmail(payload);
    } else {
      await sendTraderSurveyWaitlistEmail(payload);
    }
    return true;
  } catch (error) {
    logger.warn(`Failed to send ${kind} survey waitlist email`, { error, email: payload.email });
    return false;
  }
};
