import fs from 'fs/promises';
import path from 'path';
import { env } from '../../../config/env';
import { StoredUpload, UploadPurpose } from '../uploads.types';

const sanitizeExt = (originalName: string, mimeType: string) => {
  const fromName = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
  if (fromName && fromName.length <= 8) return fromName;
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/svg+xml') return '.svg';
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType.startsWith('video/')) return '.mp4';
  return '.bin';
};

export const getUploadRoot = () => path.resolve(env.UPLOAD_DIR);

export const getPublicBaseUrl = (reqHost?: string) => {
  if (env.UPLOAD_PUBLIC_BASE_URL) return env.UPLOAD_PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
  }
  if (reqHost) return `http://${reqHost}`;
  return `http://localhost:${env.PORT}`;
};

export const buildObjectKey = (
  purpose: UploadPurpose,
  ownerId: string,
  originalName: string,
  mimeType: string
) => {
  const ext = sanitizeExt(originalName, mimeType);
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `${purpose}/${ownerId}/${stamp}-${rand}${ext}`;
};

export const saveLocalUpload = async (input: {
  buffer: Buffer;
  purpose: UploadPurpose;
  ownerId: string;
  originalName: string;
  mimeType: string;
  reqHost?: string;
}): Promise<StoredUpload> => {
  const objectKey = buildObjectKey(
    input.purpose,
    input.ownerId,
    input.originalName,
    input.mimeType
  );
  const root = getUploadRoot();
  const absolutePath = path.join(root, objectKey);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, input.buffer);

  const base = getPublicBaseUrl(input.reqHost);
  const url = `${base}/uploads/files/${objectKey.split('/').map(encodeURIComponent).join('/')}`;

  return {
    url,
    objectKey,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
    originalName: input.originalName,
    purpose: input.purpose,
  };
};

export const deleteLocalUpload = async (objectKey: string) => {
  const absolutePath = path.join(getUploadRoot(), objectKey);
  await fs.unlink(absolutePath).catch(() => undefined);
};
