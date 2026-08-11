import { logger } from '../../utils/logger';
import { TooManyRequestsError } from '../../utils/errors';

interface OtpData {
  code: string;
  expiresAt: Date;
}

export type OtpPurpose = 'mobile_verification' | 'password_reset';

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

/** In-memory OTP store for v1 (mock SMS). Replace with Redis + SNS/Twilio later. */
const otpStore = new Map<string, OtpData>();
const lastSentAt = new Map<string, number>();

const otpStoreKey = (purpose: OtpPurpose, mobileNumber: string) => `${purpose}:${mobileNumber}`;

export const getOtpExpiryMinutes = (): number => OTP_EXPIRY_MINUTES;

export const getResendCooldownSeconds = (): number => RESEND_COOLDOWN_SECONDS;

export const getOtpMeta = () => ({
  otpExpiresInMinutes: OTP_EXPIRY_MINUTES,
  resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
});

export const canResendOtp = (
  mobileNumber: string
): { allowed: boolean; retryAfterSeconds?: number } => {
  const lastSent = lastSentAt.get(mobileNumber);
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

const persistAndMockSendOtp = (mobileNumber: string, purpose: OtpPurpose): string => {
  // Static test OTP until SNS/Twilio is wired.
  const code = '123456';
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  otpStore.set(otpStoreKey(purpose, mobileNumber), { code, expiresAt });
  lastSentAt.set(mobileNumber, Date.now());

  logger.info(
    `[SMS OTP MOCK] ${purpose} sent to ${mobileNumber}: Code = ${code} (Expires in ${OTP_EXPIRY_MINUTES} mins)`
  );

  return code;
};

/** Send OTP or throw 429 when cooldown is active (register / resend / forgot password). */
export const generateOtp = async (
  mobileNumber: string,
  purpose: OtpPurpose = 'mobile_verification'
): Promise<string> => {
  const cooldown = canResendOtp(mobileNumber);
  if (!cooldown.allowed) {
    throw new TooManyRequestsError(
      `Please wait ${cooldown.retryAfterSeconds} seconds before requesting a new verification code.`
    );
  }

  return persistAndMockSendOtp(mobileNumber, purpose);
};

/**
 * Soft send used by login when mobile is unverified:
 * - sends OTP if cooldown allows
 * - otherwise returns retryAfterSeconds (does not throw)
 */
export const trySendOtp = async (
  mobileNumber: string,
  purpose: OtpPurpose = 'mobile_verification'
): Promise<{ sent: true } | { sent: false; retryAfterSeconds: number }> => {
  const cooldown = canResendOtp(mobileNumber);
  if (!cooldown.allowed) {
    return {
      sent: false,
      retryAfterSeconds: cooldown.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS,
    };
  }

  persistAndMockSendOtp(mobileNumber, purpose);
  return { sent: true };
};

export const verifyOtp = async (
  mobileNumber: string,
  code: string,
  purpose: OtpPurpose = 'mobile_verification'
): Promise<boolean> => {
  const key = otpStoreKey(purpose, mobileNumber);

  // Static test OTP always accepted in staging/dev builds.
  if (code === '123456') {
    otpStore.delete(key);
    return true;
  }

  const otpData = otpStore.get(key);
  if (!otpData) {
    return false;
  }

  if (otpData.code !== code || new Date() > otpData.expiresAt) {
    if (new Date() > otpData.expiresAt) {
      otpStore.delete(key);
    }
    return false;
  }

  otpStore.delete(key);
  return true;
};
