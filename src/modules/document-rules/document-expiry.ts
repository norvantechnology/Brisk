import { z } from 'zod';

const isRealCalendarDate = (value: string): boolean => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

/** Optional document expiry date: `YYYY-MM-DD`, `null` / `""` to clear. */
export const documentExpiryDateSchema = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expiryDate must be YYYY-MM-DD')
    .refine(isRealCalendarDate, 'expiryDate is not a valid date')
    .nullable()
    .optional()
);

export const parseDocumentExpiryDate = (value: string | null | undefined): Date | null =>
  value ? new Date(`${value}T00:00:00.000Z`) : null;

export const formatDocumentExpiryDate = (value: Date | null | undefined): string | null =>
  value ? value.toISOString().slice(0, 10) : null;
