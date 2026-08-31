import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

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
