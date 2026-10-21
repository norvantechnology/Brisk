import { z } from 'zod';

const uuid = z.string().uuid();

export const jobIdParamSchema = z.object({
  params: z.object({ id: uuid }),
});

export const paymentHistoryQuerySchema = z.object({
  params: z.object({ id: uuid }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  }),
});
