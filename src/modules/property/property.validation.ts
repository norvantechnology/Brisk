import { z } from 'zod';

const addressTypeSchema = z.enum(['Home', 'Work', 'Custom']);

const addressBodySchema = z.object({
  addressType: addressTypeSchema.optional().default('Home'),
  label: z.string().trim().min(1).optional(),
  houseNumber: z.string().trim().optional(),
  addressLine1: z.string().trim().min(1, 'Street address is required.'),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1, 'City is required.'),
  county: z.string().trim().optional(),
  eircode: z.string().trim().optional(),
  country: z.string().trim().optional(),
  mprnNumber: z.string().trim().optional(),
  gprnNumber: z.string().trim().optional(),
  utnNumber: z.string().trim().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  mapImageUrl: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
  isDefault: z.boolean().optional(),
  /** Alias of `isDefault` (responses expose both). */
  isPrimary: z.boolean().optional(),
});

const withPrimaryAlias = <T extends { isDefault?: boolean; isPrimary?: boolean }>({ isPrimary, ...rest }: T) => ({
  ...rest,
  isDefault: rest.isDefault ?? isPrimary,
});

export const createAddressSchema = z.object({
  body: addressBodySchema.transform(withPrimaryAlias),
});

export const updateAddressSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: addressBodySchema.partial().transform(withPrimaryAlias),
});

export const addressIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const propertyIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const submitReadingSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    meterId: z.string().uuid().optional(),
    meterType: z.enum(['electricity', 'gas']).optional(),
    readingValue: z.coerce.number().positive('Reading must be greater than 0.'),
    photoUrl: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
  }).refine((data) => data.meterId || data.meterType, {
    message: 'Provide meterId or meterType.',
  }),
});


export const parseFlexibleDate = (val: string | Date | null | undefined): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const str = String(val).trim();
  if (!str) return null;

  // 1. Simple YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    const date = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), 0, 0, 0));
    return isNaN(date.getTime()) ? null : date;
  }

  // 2. "dd MMM yyyy, hh:mm a" / "dd MMM yyyy hh:mm a" / "dd MMM yyyy"
  const dMMyyyyMatch = str.match(
    /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?)?$/i
  );
  if (dMMyyyyMatch) {
    const [, dayStr, monthStr, yearStr, hourStr, minStr, secStr, ampm] = dMMyyyyMatch;
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIndex = months.findIndex((m) => monthStr.toLowerCase().startsWith(m));
    if (monthIndex >= 0) {
      let hour = hourStr ? parseInt(hourStr, 10) : 0;
      const min = minStr ? parseInt(minStr, 10) : 0;
      const sec = secStr ? parseInt(secStr, 10) : 0;
      if (ampm) {
        const isPM = ampm.toUpperCase() === 'PM';
        if (isPM && hour < 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
      }
      const date = new Date(Date.UTC(parseInt(yearStr, 10), monthIndex, parseInt(dayStr, 10), hour, min, sec));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // 3. Fallback to standard native Date parsing (handles ISO-8601, RFC2822, etc.)
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
};

export const flexibleDateSchema = z
  .union([
    z.string().refine((val) => parseFlexibleDate(val) !== null, {
      message: 'Invalid date format. Expected "YYYY-MM-DD", "dd MMM yyyy, hh:mm a", or ISO-8601.',
    }),
    z.date(),
  ])
  .nullable()
  .optional();

export const saveSubscriptionsSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      providerIds: z.array(z.string().uuid()).min(0).optional(),
      subscriptions: z
        .array(
          z.object({
            providerId: z.string().uuid(),
            expiryDate: flexibleDateSchema,
            accountNumber: z.string().trim().max(100).nullable().optional(),
            serviceType: z.string().optional(),
            categoryId: z.string().optional(),
          })
        )
        .optional(),
    })
    .refine((data) => data.providerIds !== undefined || data.subscriptions !== undefined, {
      message: 'Provide providerIds or subscriptions array.',
    }),
});

export const removeSubscriptionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    subscriptionId: z.string().uuid(),
  }),
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>['body'];
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>['body'];
export type SubmitReadingInput = z.infer<typeof submitReadingSchema>['body'];
