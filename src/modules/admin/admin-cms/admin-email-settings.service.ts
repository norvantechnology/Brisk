import { SmtpEncryption } from '@prisma/client';
import { prisma } from '../../../config/database';
import { BadRequestError } from '../../../utils/errors';
import { decryptSecret, encryptSecret } from '../../../utils/secret-box';
import {
  getEnvSmtpConfig,
  resolveSmtpConfig,
  sendBrandedMail,
  verifySmtpConfig,
  type SmtpConfig,
} from '../../../services/email.service';
import { writeAudit } from './admin-cms.service';
import type { TestEmailSettingsInput, UpsertEmailSettingsInput } from './admin-cms.validation';

/** Placeholder returned instead of the password; sending it back on save keeps the stored password. */
export const SMTP_PASSWORD_MASK = '********';

const updatedByInclude = {
  updatedBy: { select: { id: true, fullName: true, email: true } },
} as const;

const findEmailSettings = () =>
  prisma.emailSettings.findFirst({ orderBy: { updatedAt: 'desc' }, include: updatedByInclude });

const smtpErrorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Admin Settings → Email Configuration. Shows the config mail is actually sent with (saved, else env). */
export const getEmailSettings = async () => {
  const row = await findEmailSettings();
  if (row) {
    return {
      id: row.id,
      source: 'DATABASE' as const,
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      smtpUsername: row.smtpUsername,
      smtpPassword: SMTP_PASSWORD_MASK,
      hasPassword: true,
      encryption: row.encryption,
      fromEmail: row.fromEmail,
      fromName: row.fromName,
      replyToEmail: row.replyToEmail,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  }

  const env = getEnvSmtpConfig();
  return {
    id: null,
    source: env ? ('ENV' as const) : ('NONE' as const),
    smtpHost: env?.host ?? '',
    smtpPort: env?.port ?? null,
    smtpUsername: env?.user ?? '',
    smtpPassword: env?.pass ? SMTP_PASSWORD_MASK : '',
    hasPassword: Boolean(env?.pass),
    encryption: env?.encryption ?? null,
    fromEmail: env?.fromEmail ?? '',
    fromName: env?.fromName ?? '',
    replyToEmail: env?.replyTo ?? '',
    updatedAt: null,
    updatedBy: null,
  };
};

/** Verifies the SMTP login first, so a typo can never break OTP / transactional mail. */
export const upsertEmailSettings = async (
  adminId: string,
  adminLabel: string,
  input: UpsertEmailSettingsInput
) => {
  const existing = await findEmailSettings();
  const keepPassword = !input.smtpPassword || input.smtpPassword === SMTP_PASSWORD_MASK;

  let password = keepPassword ? undefined : input.smtpPassword;
  if (keepPassword && existing) {
    try {
      password = decryptSecret(existing.smtpPasswordEnc);
    } catch {
      throw new BadRequestError('Stored SMTP password cannot be read. Please enter the password again.', {
        code: 'SMTP_PASSWORD_REQUIRED',
      });
    }
  } else if (keepPassword) {
    password = getEnvSmtpConfig()?.pass;
  }
  if (!password) {
    throw new BadRequestError('SMTP password is required.', { code: 'SMTP_PASSWORD_REQUIRED' });
  }

  const config: SmtpConfig = {
    source: 'DATABASE',
    host: input.smtpHost,
    port: input.smtpPort,
    encryption: input.encryption,
    requireTls: input.encryption === SmtpEncryption.TLS,
    user: input.smtpUsername,
    pass: password,
    fromEmail: input.fromEmail,
    fromName: input.fromName,
    replyTo: input.replyToEmail,
  };

  try {
    await verifySmtpConfig(config);
  } catch (err) {
    throw new BadRequestError('Could not connect to the SMTP server with these settings. Nothing was saved.', {
      code: 'SMTP_VERIFY_FAILED',
      data: { error: smtpErrorMessage(err) },
    });
  }

  const data = {
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpUsername: input.smtpUsername,
    smtpPasswordEnc: encryptSecret(password),
    encryption: input.encryption,
    fromEmail: input.fromEmail,
    fromName: input.fromName,
    replyToEmail: input.replyToEmail,
    updatedById: adminId,
  };
  const saved = existing
    ? await prisma.emailSettings.update({ where: { id: existing.id }, data })
    : await prisma.emailSettings.create({ data });

  await writeAudit(
    'EMAIL_SETTINGS_UPSERTED',
    adminId,
    adminLabel,
    'EmailSettings',
    saved.id,
    `Updated SMTP settings (${input.smtpHost}:${input.smtpPort}, ${input.encryption}).`
  );

  return getEmailSettings();
};

/** Drop the saved config — outbound mail goes back to the server SMTP_* env. */
export const resetEmailSettings = async (adminId: string, adminLabel: string) => {
  const existing = await findEmailSettings();
  if (existing) {
    await prisma.emailSettings.deleteMany({});
    await writeAudit(
      'EMAIL_SETTINGS_RESET',
      adminId,
      adminLabel,
      'EmailSettings',
      existing.id,
      'Reset SMTP settings to server defaults.'
    );
  }
  return getEmailSettings();
};

/** Send Test Email — real delivery through the active config. */
export const sendTestEmail = async (input: TestEmailSettingsInput) => {
  const config = await resolveSmtpConfig();
  if (!config) {
    throw new BadRequestError('SMTP is not configured. Save Email Configuration first.', {
      code: 'SMTP_NOT_CONFIGURED',
    });
  }

  const sentAt = new Date().toISOString();
  try {
    await sendBrandedMail({
      to: input.to,
      subject: 'BRISK SMTP test',
      title: 'SMTP connectivity test',
      audience: 'customer',
      paragraphs: [
        'This is a test email from BRISK Admin → Email Configuration.',
        `Sent at: <strong>${sentAt}</strong>`,
        'If you received this, outbound SMTP is working.',
      ],
    });
  } catch (err) {
    throw new BadRequestError('Test email could not be sent.', {
      code: 'SMTP_SEND_FAILED',
      data: { error: smtpErrorMessage(err) },
    });
  }

  return { recipient: input.to, sentAt, source: config.source, smtpHost: config.host };
};
