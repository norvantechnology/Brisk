import { z } from 'zod';
import { UPLOAD_PURPOSES } from './uploads.types';

const purposeEnum = z.enum(UPLOAD_PURPOSES as unknown as [string, ...string[]]);

export const uploadFileSchema = z.object({
  body: z.object({
    purpose: purposeEnum,
  }),
});

export const deleteUploadSchema = z.object({
  body: z.object({
    objectKey: z.string().min(3).max(512),
  }),
});
