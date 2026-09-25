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

/** Trader portal (VPS: trader.brisk.ie). */
export const getTraderWebBaseUrl = (): string =>
  (process.env.TRADER_WEB_URL || process.env.NEXT_PUBLIC_TRADER_APP_URL || 'https://trader.brisk.ie').replace(
    /\/$/,
    ''
  );

/** Admin portal (VPS: admin.brisk.ie). */
export const getAdminWebBaseUrl = (): string =>
  (process.env.ADMIN_WEB_URL || process.env.NEXT_PUBLIC_ADMIN_APP_URL || 'https://admin.brisk.ie').replace(
    /\/$/,
    ''
  );

export const absoluteTraderWebUrl = (path: string): string => {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getTraderWebBaseUrl()}${p}`;
};

export const absoluteAdminWebUrl = (path: string): string => {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getAdminWebBaseUrl()}${p}`;
};

/** CC on all admin-related emails (testing / ops monitoring). */
export const getAdminEmailCc = (): string[] => {
  const raw =
    process.env.ADMIN_EMAIL_CC?.trim() ||
    process.env.CONTACT_ADMIN_CC?.trim() ||
    'vyas339@gmail.com';
  return [
    ...new Set(
      raw
        .split(/[,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
};

export type EmailCta = { label: string; url: string };

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

export { escapeHtml };

/** Audience drives which logo is shown (trader vs customer/consumer). */
export type EmailAudience = 'trader' | 'customer';

const logoForAudience = (audience: EmailAudience): EmailLogoKind =>
  audience === 'trader' ? 'trader' : 'consumer';

/**
 * Same HTML shell as onboarding / waitlist emails:
 * logo (dynamic) → title → body paragraphs → Regards closing.
 */
export const buildBrandedEmailHtml = (input: {
  title: string;
  /** Plain text or already-escaped HTML snippets. User input must be escapeHtml()'d. */
  paragraphs: string[];
  audience: EmailAudience;
  closingHtml?: string;
  footerNoteHtml?: string;
  cta?: EmailCta;
}): string =>
  wrapHtmlEmail(input.title, input.paragraphs, {
    logo: logoForAudience(input.audience),
    closingHtml: input.closingHtml,
    footerNoteHtml: input.footerNoteHtml,
    cta: input.cta,
  });

/** Send a user-facing email in the standard BRISK branded format (Survey-style white card). */
export const sendBrandedMail = async (input: {
  to: string;
  subject: string;
  title: string;
  paragraphs: string[];
  audience: EmailAudience;
  /** Plain-text fallback; defaults to paragraphs + Regards. */
  text?: string;
  closingHtml?: string;
  footerNoteHtml?: string;
  cta?: EmailCta;
  cc?: string | string[];
}): Promise<void> => {
  const textParts = [
    ...input.paragraphs.map((p) => p.replace(/<[^>]+>/g, '')),
    ...(input.cta ? ['', `${input.cta.label}: ${input.cta.url}`] : []),
    '',
    'Regards,',
    'BRISK Team',
  ];
  const text = input.text ?? textParts.join('\n');
  await sendMail({
    to: input.to,
    subject: input.subject,
    text,
    cc: input.cc,
    html: buildBrandedEmailHtml({
      title: input.title,
      paragraphs: input.paragraphs,
      audience: input.audience,
      closingHtml: input.closingHtml,
      footerNoteHtml: input.footerNoteHtml,
      cta: input.cta,
    }),
  });
};

const buildCtaButtonRow = (cta?: EmailCta): string => {
  if (!cta?.url || !cta.label) return '';
  const href = escapeHtml(cta.url);
  const label = escapeHtml(cta.label);
  // Blue CTA matching Survey / waitlist link accent (#2563eb)
  return `<tr>
                  <td align="center" style="padding:8px 0 24px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#2563eb" style="border-radius:6px;background:#2563eb;">
                          <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:6px;">${label}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`;
};

const wrapHtmlEmail = (
  title: string,
  paragraphs: string[],
  options?: {
    logo?: EmailLogoKind;
    closingHtml?: string;
    footerNoteHtml?: string;
    cta?: EmailCta;
  }
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
  const closingHtml =
    options?.closingHtml ??
    `Regards,<br/>
                    <strong>BRISK</strong><br/>
                    <span style="color:#64748b;font-size:14px;">Brisk - Making things Quicker.</span>`;
  const footerNoteRow = options?.footerNoteHtml
    ? `<tr>
                  <td style="padding:20px 0 0 0;border-top:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#64748b;">
                    ${options.footerNoteHtml}
                  </td>
                </tr>`
    : '';
  const ctaRow = buildCtaButtonRow(options?.cta);

  // Survey-style layout: soft grey page + white card + centered logo
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
                ${ctaRow}
                <tr>
                  <td style="padding:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1e293b;">
                    ${closingHtml}
                  </td>
                </tr>
                ${footerNoteRow}
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

const WAITLIST_REMOVAL_NOTE =
  "At any stage you change your mind and don't wish to be on the BRISK waitlist, email us at waitlist@brisk.ie - we will remove you from the waiting list, and you will receive an email confirmation within 48 hours.";

const WAITLIST_CLOSING_HTML = `Warm Regards,<br/><strong>BRISK team</strong>`;

const WAITLIST_FOOTER_HTML = `Note: At any stage you change your mind and don't wish to be on the BRISK waitlist, email us at <a href="mailto:waitlist@brisk.ie" style="color:#2563eb;text-decoration:none;">waitlist@brisk.ie</a> - we will remove you from the waiting list, and you will receive an email confirmation within 48 hours.`;

const buildRegisterInterestEmail = (kind: 'customer' | 'trader', fullName?: string) => {
  const safeName = fullName?.trim() ? escapeHtml(fullName.trim().split(/\s+/)[0]) : '';
  const thanksLine = safeName
    ? `Firstly, thanks for registering your interest in BRISK, ${safeName}.`
    : 'Firstly, thanks for registering your interest in BRISK.';

  if (kind === 'trader') {
    return {
      subject: "You're on the BRISK Trader Waitlist",
      title: "You're on the BRISK Trader Waitlist",
      logo: 'trader' as const,
      paragraphs: [
        thanksLine,
        'We are currently in development of BRISK - a new way to make it easier for tradespeople to find new customers, manage jobs and grow their business.',
        'By joining the waitlist, you will be among the first traders to hear when BRISK launches and when we are ready to welcome traders onto the platform.',
        'We will keep you updated as we get closer.',
      ],
      text: `You're on the BRISK Trader Waitlist

${thanksLine.replace(/<[^>]+>/g, '')}

We are currently in development of BRISK - a new way to make it easier for tradespeople to find new customers, manage jobs and grow their business.

By joining the waitlist, you will be among the first traders to hear when BRISK launches and when we are ready to welcome traders onto the platform.

We will keep you updated as we get closer.

Warm Regards
BRISK team

Note: ${WAITLIST_REMOVAL_NOTE}`,
    };
  }

  return {
    subject: "You're on the BRISK Waitlist",
    title: "You're on the BRISK Waitlist",
    logo: 'consumer' as const,
    paragraphs: [
      thanksLine,
      'We are currently in development of BRISK - a new way of finding a trusted tradesperson for your home in a simpler, easier and less stressful way.',
      'By joining the waitlist, you will be among the first to hear when BRISK launches and when you can start using the platform to find the right tradesperson for your home.',
      'We will keep you updated as we get closer.',
    ],
    text: `You're on the BRISK Waitlist

${thanksLine.replace(/<[^>]+>/g, '')}

We are currently in development of BRISK - a new way of finding a trusted tradesperson for your home in a simpler, easier and less stressful way.

By joining the waitlist, you will be among the first to hear when BRISK launches and when you can start using the platform to find the right tradesperson for your home.

We will keep you updated as we get closer.

Warm Regards
BRISK team

Note: ${WAITLIST_REMOVAL_NOTE}`,
  };
};

/** Customer register / waitlist interest confirmation (Register Interest PDF). */
export const sendCustomerRegisterInterestEmail = async (
  payload: SurveyWaitlistEmailPayload
): Promise<void> => {
  const content = buildRegisterInterestEmail('customer', payload.fullName);
  await sendMail({
    to: payload.email,
    subject: content.subject,
    text: content.text,
    html: wrapHtmlEmail(content.title, content.paragraphs, {
      logo: content.logo,
      closingHtml: WAITLIST_CLOSING_HTML,
      footerNoteHtml: WAITLIST_FOOTER_HTML,
    }),
  });
};

/** Trader register / waitlist interest confirmation (Register Interest PDF). */
export const sendTraderRegisterInterestEmail = async (
  payload: SurveyWaitlistEmailPayload
): Promise<void> => {
  const content = buildRegisterInterestEmail('trader', payload.fullName);
  await sendMail({
    to: payload.email,
    subject: content.subject,
    text: content.text,
    html: wrapHtmlEmail(content.title, content.paragraphs, {
      logo: content.logo,
      closingHtml: WAITLIST_CLOSING_HTML,
      footerNoteHtml: WAITLIST_FOOTER_HTML,
    }),
  });
};

/** @deprecated Prefer sendCustomerRegisterInterestEmail - kept for survey callers. */
export const sendConsumerSurveyWaitlistEmail = async (
  payload: SurveyWaitlistEmailPayload
): Promise<void> => sendCustomerRegisterInterestEmail(payload);

/** @deprecated Prefer sendTraderRegisterInterestEmail - kept for survey callers. */
export const sendTraderSurveyWaitlistEmail = async (
  payload: SurveyWaitlistEmailPayload
): Promise<void> => sendTraderRegisterInterestEmail(payload);

export const sendSurveyWaitlistEmailSafe = async (
  kind: 'consumer' | 'trader',
  payload: SurveyWaitlistEmailPayload
): Promise<boolean> => {
  try {
    if (kind === 'consumer') {
      await sendCustomerRegisterInterestEmail(payload);
    } else {
      await sendTraderRegisterInterestEmail(payload);
    }
    return true;
  } catch (error) {
    logger.warn(`Failed to send ${kind} survey waitlist email`, { error, email: payload.email });
    return false;
  }
};

/** Safe send after auth register - never blocks signup if SMTP fails. */
export const sendRegisterInterestEmailSafe = async (
  role: 'CUSTOMER' | 'TRADER',
  payload: SurveyWaitlistEmailPayload
): Promise<boolean> => {
  try {
    if (role === 'TRADER') {
      await sendTraderRegisterInterestEmail(payload);
    } else {
      await sendCustomerRegisterInterestEmail(payload);
    }
    return true;
  } catch (error) {
    logger.warn('Failed to send register interest email', {
      error,
      email: payload.email,
      role,
    });
    return false;
  }
};

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string | string[];
};

const normalizeAddressList = (value?: string | string[]): string[] => {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      raw
        .flatMap((v) => v.split(/[,;]+/))
        .map((e) => e.trim())
        .filter(Boolean)
    ),
  ];
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
  const ccList = normalizeAddressList(input.cc).filter(
    (e) => e.toLowerCase() !== input.to.trim().toLowerCase()
  );

  if (!transport) {
    logger.info('[EMAIL] SMTP not configured - logging outbound mail', {
      to: input.to,
      cc: ccList,
      from: fromAddress,
      subject: input.subject,
      text: input.text,
    });
    return;
  }

  const useEnvelope =
    Boolean(smtpUser) && smtpUser!.toLowerCase() !== fromAddress.toLowerCase();
  const envelopeTo = [input.to, ...ccList];

  await transport.sendMail({
    from: `Brisk <${fromAddress}>`,
    to: input.to,
    ...(ccList.length ? { cc: ccList.join(', ') } : {}),
    subject: input.subject,
    text: input.text,
    html: input.html ?? input.text.replace(/\n/g, '<br/>'),
    replyTo: fromAddress,
    ...(useEnvelope
      ? {
          sender: smtpUser,
          envelope: { from: smtpUser!, to: envelopeTo },
        }
      : {}),
  });

  logger.info('[EMAIL] Sent', {
    to: input.to,
    cc: ccList,
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
We will reply within 24-48 hours.

Brisk - Making things Quicker.`;

  await sendMail({
    to: payload.email,
    subject,
    text,
    html: wrapHtmlEmail(
      'We received your message',
      [
        `Hi ${escapeHtml(payload.fullName)},`,
        `Thank you for contacting BRISK. Reference: <strong>${escapeHtml(payload.referenceCode)}</strong>.`,
        'We will reply within 24-48 hours.',
      ],
      { logo: 'consumer' }
    ),
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
    cc: getAdminEmailCc(),
    subject,
    text,
    html: wrapHtmlEmail(
      'New Contact Us submission',
      [
        `<strong>${escapeHtml(payload.fullName)}</strong> &lt;${escapeHtml(payload.email)}&gt;`,
        payload.phone ? `Phone: ${escapeHtml(payload.phone)}` : 'Phone: -',
        `Subject: ${escapeHtml(payload.subject)}`,
        `Reference: <strong>${escapeHtml(payload.referenceCode)}</strong>`,
        escapeHtml(payload.message).replace(/\n/g, '<br/>'),
      ],
      { logo: 'consumer' }
    ),
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
