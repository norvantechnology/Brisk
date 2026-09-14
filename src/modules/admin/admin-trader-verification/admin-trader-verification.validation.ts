import { z } from 'zod';
import { TraderDocumentStatus, VerificationStatus } from '@prisma/client';

export const verificationQueueSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.nativeEnum(VerificationStatus).optional(),
    entityType: z.enum(['SOLO', 'COMPANY']).optional(),
    search: z.string().optional(),
  }),
});

export const traderIdParamSchema = z.object({
  params: z.object({
    traderId: z.string().uuid(),
  }),
});

export const reviewTraderSchema = z.object({
  params: z.object({
    traderId: z.string().uuid(),
  }),
  body: z
    .object({
      verificationStatus: z.enum(['VERIFIED', 'REJECTED']),
      rejectionReason: z.string().trim().min(1).max(2000).optional(),
    })
    .superRefine((body, ctx) => {
      if (body.verificationStatus === 'REJECTED' && !body.rejectionReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'rejectionReason is required when rejecting a trader.',
          path: ['rejectionReason'],
        });
      }
    }),
});

export const reviewTraderDocumentSchema = z.object({
  params: z.object({
    traderId: z.string().uuid(),
    documentId: z.string().uuid(),
  }),
  body: z
    .object({
      status: z.enum([TraderDocumentStatus.APPROVED, TraderDocumentStatus.REJECTED]),
      rejectionReason: z.string().trim().min(1).max(2000).optional(),
    })
    .superRefine((body, ctx) => {
      if (body.status === TraderDocumentStatus.REJECTED && !body.rejectionReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'rejectionReason is required when rejecting a document.',
          path: ['rejectionReason'],
        });
      }
    }),
});
