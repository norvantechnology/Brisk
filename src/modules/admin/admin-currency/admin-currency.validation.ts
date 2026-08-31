import { z } from 'zod';

const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .transform((v) => v.toUpperCase());

export const upsertCurrencySchema = z.object({
  body: z.object({
    code: currencyCodeSchema,
    name: z.string().trim().min(1),
    symbol: z.string().trim().min(1).max(8),
    decimalPlaces: z.number().int().min(0).max(4).optional().default(2),
    isActive: z.boolean().optional().default(true),
    sortOrder: z.number().int().optional().default(0),
  }),
});

export const updateCurrencySchema = z.object({
  params: z.object({ code: currencyCodeSchema }),
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      symbol: z.string().trim().min(1).max(8).optional(),
      decimalPlaces: z.number().int().min(0).max(4).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required.' }),
});

export const currencyCodeParamSchema = z.object({
  params: z.object({ code: currencyCodeSchema }),
});

export const updatePlatformCurrencySettingsSchema = z.object({
  body: z.object({
    baseCurrency: currencyCodeSchema,
  }),
});

export const upsertExchangeRatesSchema = z.object({
  body: z.object({
    rates: z
      .array(
        z.object({
          toCurrency: currencyCodeSchema,
          rate: z.number().positive(),
        })
      )
      .min(1),
  }),
});

export type UpsertCurrencyInput = z.infer<typeof upsertCurrencySchema>['body'];
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>['body'];
export type UpsertExchangeRatesInput = z.infer<typeof upsertExchangeRatesSchema>['body'];
