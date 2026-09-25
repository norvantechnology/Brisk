import { randomInt } from 'crypto';
import { logger } from '../../utils/logger';
import { TooManyRequestsError } from '../../utils/errors';

interface OtpData {
  code: string;
  expiresAt: Date;
}

export type OtpPurpose = 'mobile_verification' | 'password_reset' | 'email_verification';

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

/** In-memory OTP store for v1. Mobile stays mock SMS; email uses dynamic codes sent via SMTP. */
const otpStore = new Map<string, OtpData>();
const lastSentAt = new Map<string, number>();

const otpStoreKey = (purpose: OtpPurpose, identifier: string) => `${purpose}:${identifier}`;

export const getOtpExpiryMinutes = (): number => OTP_EXPIRY_MINUTES;

export const getResendCooldownSeconds = (): number => RESEND_COOLDOWN_SECONDS;

export const getOtpMeta = () => ({
  otpExpiresInMinutes: OTP_EXPIRY_MINUTES,
  resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
});

export const canResendOtp = (
  identifier: string,
  purpose: OtpPurpose = 'mobile_verification'
): { allowed: boolean; retryAfterSeconds?: number } => {
  const lastSent = lastSentAt.get(otpStoreKey(purpose, identifier));
  if (!lastSent) {
    return { allowed: true };
  }

  const elapsedMs = Date.now() - lastSent;
  const cooldownMs = RESEND_COOLDOWN_SECONDS * 1000;

  if (elapsedMs >= cooldownMs) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((cooldownMs - elapsedMs) / 1000),
  };
};

/** Mock mobile/SMS OTP until Twilio/SNS is wired. Not used for email. */
export const getMockMobileOtpCode = (): string => '123456';

/** @deprecated Use getMockMobileOtpCode — email OTPs are dynamic. */
export const getMockOtpCode = (purpose: OtpPurpose): string =>
  purpose === 'email_verification' ? '' : getMockMobileOtpCode();

const generateDynamicOtpCode = (): string => String(randomInt(100000, 1000000));

const createAndStoreOtp = (
  identifier: string,
  purpose: OtpPurpose,
  codeOverride?: string
): string => {
  // Email verification + password reset use dynamic codes (delivered by email).
  // Mobile verification stays on mock SMS code until Twilio/SNS is wired.
  const code =
    codeOverride ??
    (purpose === 'mobile_verification' ? getMockMobileOtpCode() : generateDynamicOtpCode());
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  otpStore.set(otpStoreKey(purpose, identifier), { code, expiresAt });
  lastSentAt.set(otpStoreKey(purpose, identifier), Date.now());

  if (purpose === 'email_verification' || purpose === 'password_reset') {
    logger.info(
      `[OTP] ${purpose} stored for ${identifier} (dynamic code, expires in ${OTP_EXPIRY_MINUTES} mins)`
    );
  } else {
    logger.info(
      `[OTP MOCK] ${purpose} sent to ${identifier}: Code = ${code} (Expires in ${OTP_EXPIRY_MINUTES} mins)`
    );
  }

  return code;
};

/**
 * One OTP stored under every identifier (e.g. email + mobile for password reset).
 * Cooldown is checked against all identifiers; first blocked wins.
 */
export const generateSharedOtp = async (
  identifiers: string[],
  purpose: OtpPurpose
): Promise<string> => {
  const unique = [...new Set(identifiers.map((i) => i.trim()).filter(Boolean))];
  if (!unique.length) {
    throw new Error('generateSharedOtp requires at least one identifier');
  }

  for (const id of unique) {
    const cooldown = canResendOtp(id, purpose);
    if (!cooldown.allowed) {
      throw new TooManyRequestsError(
        `Please wait ${cooldown.retryAfterSeconds} seconds before requesting a new verification code.`
      );
    }
  }

  const code =
    purpose === 'mobile_verification' ? getMockMobileOtpCode() : generateDynamicOtpCode();
  for (const id of unique) {
    createAndStoreOtp(id, purpose, code);
  }
  return code;
};

/** Send OTP or throw 429 when cooldown is active. Returns the code (needed for email body). */
export const generateOtp = async (
  identifier: string,
  purpose: OtpPurpose = 'mobile_verification'
): Promise<string> => {
  const cooldown = canResendOtp(identifier, purpose);
  if (!cooldown.allowed) {
    throw new TooManyRequestsError(
      `Please wait ${cooldown.retryAfterSeconds} seconds before requesting a new verification code.`
    );
  }

  return createAndStoreOtp(identifier, purpose);
};

export const trySendOtp = async (
  identifier: string,
  purpose: OtpPurpose = 'mobile_verification'
): Promise<
  { sent: true; code: string } | { sent: false; retryAfterSeconds: number }
> => {
  const cooldown = canResendOtp(identifier, purpose);
  if (!cooldown.allowed) {
    return {
      sent: false,
      retryAfterSeconds: cooldown.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS,
    };
  }

  const code = createAndStoreOtp(identifier, purpose);
  return { sent: true, code };
};

export const verifyOtp = async (
  identifier: string,
  code: string,
  purpose: OtpPurpose = 'mobile_verification'
): Promise<boolean> => {
  const key = otpStoreKey(purpose, identifier);
  const trimmed = (code || '').trim();

  // Static mock OTP for channels without live SMS (mobile + password_reset testing).
  // Email verification never accepts the fixed mock — inbox code only.
  if (
    (purpose === 'mobile_verification' || purpose === 'password_reset') &&
    trimmed === getMockMobileOtpCode()
  ) {
    otpStore.delete(key);
    return true;
  }

  const otpData = otpStore.get(key);
  if (!otpData) {
    return false;
  }

  if (otpData.code !== trimmed || new Date() > otpData.expiresAt) {
    if (new Date() > otpData.expiresAt) {
      otpStore.delete(key);
    }
    return false;
  }

  otpStore.delete(key);
  return true;
};

/** Non-consuming check — use before multi-channel verify so one bad code does not burn the other. */
export const matchOtp = (
  identifier: string,
  code: string,
  purpose: OtpPurpose = 'mobile_verification'
): boolean => {
  const key = otpStoreKey(purpose, identifier);
  const trimmed = (code || '').trim();

  if (
    (purpose === 'mobile_verification' || purpose === 'password_reset') &&
    trimmed === getMockMobileOtpCode()
  ) {
    return true;
  }

  const otpData = otpStore.get(key);
  if (!otpData) {
    return false;
  }

  if (otpData.code !== trimmed) {
    return false;
  }

  if (new Date() > otpData.expiresAt) {
    otpStore.delete(key);
    return false;
  }

  return true;
};

export const consumeOtp = (
  identifier: string,
  purpose: OtpPurpose = 'mobile_verification'
): void => {
  otpStore.delete(otpStoreKey(purpose, identifier));
};
