import { z } from 'zod';

const boolQuery = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === true || v === 'true'));

export const notificationListQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    unreadOnly: boolQuery,
    type: z.string().trim().min(1).optional(),
    search: z.string().trim().optional(),
  }),
});

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid notification ID format.'),
  }),
});
