import multer from 'multer';
import { env } from '../../config/env';

const maxBytes = env.UPLOAD_MAX_MB * 1024 * 1024;

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 1 },
});
