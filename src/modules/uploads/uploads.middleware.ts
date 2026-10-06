import multer from 'multer';
import { env } from '../../config/env';
import { MAX_PURPOSE_BYTES } from './uploads.config';

const maxBytes = Math.max(env.UPLOAD_MAX_MB * 1024 * 1024, MAX_PURPOSE_BYTES);

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 1 },
});
