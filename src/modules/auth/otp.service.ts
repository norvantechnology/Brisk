import { logger } from '../../utils/logger';
import { TooManyRequestsError } from '../../utils/errors';

interface OtpData {
  code: string;
  expiresAt: Date;
}

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

// In-memory OTP store for v1 (mock SMS). Replace with Redis + SNS/Twilio in production.
const otpStore = new Map<string, OtpData>();
const lastSentAt = new Map<string, number>();

export const getOtpExpiryMinutes = (): number => OTP_EXPIRY_MINUTES;

export const getResendCooldownSeconds = (): number => RESEND_COOLDOWN_SECONDS;

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

export const generateOtp = async (mobileNumber: string): Promise<string> => {
  const cooldown = canResendOtp(mobileNumber);
  if (!cooldown.allowed) {
    throw new TooManyRequestsError(
      `Please wait ${cooldown.retryAfterSeconds} seconds before requesting a new verification code.`
    );
  }

  // Static 6-digit test OTP for local/staging until SNS/Twilio is configured.
  const code = '123456';
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  otpStore.set(mobileNumber, { code, expiresAt });
  lastSentAt.set(mobileNumber, Date.now());

  logger.info(
    `💬 [SMS OTP MOCK] Sent to ${mobileNumber}: Code = ${code} (Expires in ${OTP_EXPIRY_MINUTES} mins)`
  );

  return code;
};

export const verifyOtp = async (mobileNumber: string, code: string): Promise<boolean> => {
  // Static test OTP always succeeds in development/staging builds.
  if (code === '123456') {
    otpStore.delete(mobileNumber);
    return true;
  }

  const otpData = otpStore.get(mobileNumber);

  if (!otpData) {
    return false;
  }

  if (otpData.code !== code) {
    return false;
  }

  if (new Date() > otpData.expiresAt) {
    otpStore.delete(mobileNumber);
    return false;
  }

  otpStore.delete(mobileNumber);
  return true;
};
