import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** Changing SETTINGS_ENCRYPTION_KEY (or JWT_SECRET when unset) makes stored secrets unreadable — re-save them. */
const key = (): Buffer =>
  createHash('sha256')
    .update(process.env.SETTINGS_ENCRYPTION_KEY?.trim() || process.env.JWT_SECRET || '')
    .digest();

/** AES-256-GCM → `iv.tag.ciphertext` (base64url). */
export const encryptSecret = (plain: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
};

export const decryptSecret = (payload: string): string => {
  const [iv, tag, data] = payload.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !data) throw new Error('Malformed secret payload.');
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};
