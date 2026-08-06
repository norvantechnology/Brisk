import { logger } from '../../utils/logger';

interface OtpData {
  code: string;
  expiresAt: Date;
}

// Simple in-memory storage for OTPs in local development
const otpStore = new Map<string, OtpData>();

export const generateOtp = async (mobileNumber: string): Promise<string> => {
  // Generate a static 6-digit code for testing ease
  const code = '123456';
  
  // Set expiry to 5 minutes from now
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  
  otpStore.set(mobileNumber, { code, expiresAt });
  
  logger.info(`💬 [SMS OTP MOCK] Sent to ${mobileNumber}: Code = ${code} (Expires in 5 mins)`);
  
  return code;
};

export const verifyOtp = async (mobileNumber: string, code: string): Promise<boolean> => {
  const otpData = otpStore.get(mobileNumber);
  
  if (!otpData) {
    return false;
  }
  
  if (otpData.code !== code) {
    return false;
  }
  
  if (new Date() > otpData.expiresAt) {
    otpStore.delete(mobileNumber); // Clean expired
    return false;
  }
  
  // OTP is verified, delete it so it cannot be reused
  otpStore.delete(mobileNumber);
  return true;
};
