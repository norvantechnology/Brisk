import { z } from 'zod';

const uuidParam = (key: string) => z.object({ [key]: z.string().uuid() });

const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

export const publicCountriesQuerySchema = z.object({
  query: z.object({
    countryCode: z.string().trim().min(2).max(3).optional(),
  }),
});

export const publicCountiesQuerySchema = z.object({
  query: z
    .object({
      countryId: z.string().uuid().optional(),
      countryCode: z.string().trim().min(2).max(3).optional(),
    })
    .refine((q) => q.countryId || q.countryCode, 'Send countryId or countryCode.'),
});

export const adminCountriesQuerySchema = z.object({
  query: z.object({
    isActive: booleanQuery,
  }),
});

export const createCountrySchema = z.object({
  body: z.object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/, 'Country code must be 2 letters (ISO 3166-1 alpha-2).')
      .transform((v) => v.toUpperCase()),
    name: z.string().trim().min(2).max(100),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  }),
});

export const updateCountrySchema = z.object({
  params: uuidParam('countryId'),
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().min(0).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update.'),
});

export const createCountySchema = z.object({
  params: uuidParam('countryId'),
  body: z.object({
    name: z.string().trim().min(2).max(100),
    code: z.string().trim().max(10).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  }),
});

export const updateCountySchema = z.object({
  params: uuidParam('countyId'),
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      code: z.string().trim().max(10).nullable().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().min(0).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update.'),
});

export type CreateCountryInput = z.infer<typeof createCountrySchema>['body'];
export type UpdateCountryInput = z.infer<typeof updateCountrySchema>['body'];
export type CreateCountyInput = z.infer<typeof createCountySchema>['body'];
export type UpdateCountyInput = z.infer<typeof updateCountySchema>['body'];
