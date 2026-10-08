import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const optionalEnvString = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters long'),
  /** Local upload directory (Railway volume: /data/uploads) */
  UPLOAD_DIR: z.string().default('./data/uploads'),
  /** Public base URL for uploaded file URLs — swap to CDN/S3 URL later without app changes */
  UPLOAD_PUBLIC_BASE_URL: z.string().url().optional(),
  UPLOAD_MAX_MB: z.coerce.number().default(10),
  UPLOAD_STORAGE: z.enum(['local', 's3']).default('local'),
  /** Stripe secret key (sk_test_… / sk_live_…). Payments return 503 until set. */
  STRIPE_SECRET_KEY: optionalEnvString,
  /** Stripe publishable key returned on payment-intent responses (mobile must not hardcode). */
  STRIPE_PUBLISHABLE_KEY: optionalEnvString,
  /** Signing secret of the /webhooks/stripe endpoint (whsec_…). */
  STRIPE_WEBHOOK_SECRET: optionalEnvString,
  /** Apple Pay merchant id returned on payment-intent responses. */
  STRIPE_MERCHANT_IDENTIFIER: optionalEnvString,
  /** Default return/refresh URLs for trader Stripe Connect onboarding (app deep link or web page). */
  STRIPE_CONNECT_RETURN_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  STRIPE_CONNECT_REFRESH_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  /** Absolute path to the Firebase Admin service account JSON (kept outside the repo). Push is disabled until set. */
  FIREBASE_SERVICE_ACCOUNT_PATH: optionalEnvString,
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
