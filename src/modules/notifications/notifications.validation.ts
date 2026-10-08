import { z } from 'zod';
import { COMPANY_UPDATE_TYPES } from './notification-types';

const boolQuery = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === true || v === 'true'));

const tabQuery = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.enum(['REGULAR', 'BRISK']))
  .optional();

export const notificationListQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    unreadOnly: boolQuery,
    type: z.string().trim().min(1).optional(),
    search: z.string().trim().optional(),
    tab: tabQuery,
    section: z.string().trim().min(1).optional(),
  }),
});

export const notificationReadAllQuerySchema = z.object({
  query: z.object({ tab: tabQuery }),
});

export const companyUpdateBodySchema = z.object({
  body: z.object({
    type: z.enum(COMPANY_UPDATE_TYPES),
    title: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(1000),
    audience: z.enum(['ALL', 'TRADERS', 'CUSTOMERS']).default('ALL'),
    actionLabel: z.string().trim().min(1).max(40).optional(),
    actionUrl: z.string().trim().min(1).max(500).optional(),
  }),
});

const deviceTokenSchema = z.string().trim().min(20, 'Invalid device token.').max(4096);

export const registerDeviceSchema = z.object({
  body: z.object({
    token: deviceTokenSchema,
    platform: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.enum(['IOS', 'ANDROID'])),
  }),
});

export const unregisterDeviceSchema = z.object({
  body: z.object({ token: deviceTokenSchema }),
});

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid notification ID format.'),
  }),
});
