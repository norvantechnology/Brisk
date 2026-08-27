import { z } from 'zod';

const addressTypeSchema = z.enum(['Home', 'Work', 'Custom']);

export const createAddressSchema = z.object({
  body: z.object({
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
  }),
});

export const updateAddressSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: createAddressSchema.shape.body.partial(),
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

export const saveSubscriptionsSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    providerIds: z.array(z.string().uuid()).min(0),
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
