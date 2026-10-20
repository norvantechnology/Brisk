import { z } from 'zod';

const uuid = z.string().uuid();

export const chatListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    search: z.string().trim().max(100).optional(),
  }),
});

export const chatJobParamSchema = z.object({
  params: z.object({ jobId: uuid }),
});

export const chatMessagesQuerySchema = z.object({
  params: z.object({ jobId: uuid }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  }),
});

export const chatSendBodySchema = z.object({
  params: z.object({ jobId: uuid }),
  body: z
    .object({
      message: z.string().trim().max(4000).optional().default(''),
      /** Public URL from POST /uploads with purpose=chat_photo */
      imageUrl: z.string().url().max(2048).optional().nullable(),
    })
    .superRefine((body, ctx) => {
      const text = (body.message ?? '').trim();
      const image = body.imageUrl?.trim() || null;
      if (!text && !image) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide message and/or imageUrl.',
          path: ['message'],
        });
      }
    }),
});

export type ChatListQuery = z.infer<typeof chatListQuerySchema>['query'];
export type ChatMessagesQuery = z.infer<typeof chatMessagesQuerySchema>['query'];
