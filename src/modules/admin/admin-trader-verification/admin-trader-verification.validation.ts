import { z } from 'zod';
import { TraderDocumentStatus, TraderOnboardingStatus, VerificationStatus } from '@prisma/client';
import { documentExpiryDateSchema } from '../../document-rules/document-expiry';
import { sortByParam, sortOrderParam } from '../../../utils/list-sort';
import { isoDateParam } from '../../../utils/list-filters';

export const ADMIN_VERIFICATION_QUEUE_SORT_FIELDS = [
  'traderCode',
  'traderType',
  'businessName',
  'fullLegalName',
  'contactName',
  'email',
  'mobileNumber',
  'verificationStatus',
  'onboardingStatus',
  'submittedAt',
] as const;

export const verificationQueueSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.nativeEnum(VerificationStatus).optional(),
    entityType: z.enum(['SOLO', 'COMPANY']).optional(),
    onboardingStatus: z
      .enum([TraderOnboardingStatus.SUBMITTED, TraderOnboardingStatus.APPROVED, TraderOnboardingStatus.REJECTED])
      .optional(),
    search: z.string().optional(),
    from: isoDateParam,
    to: isoDateParam,
    sortBy: sortByParam(ADMIN_VERIFICATION_QUEUE_SORT_FIELDS),
    sortOrder: sortOrderParam,
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
      status: z.enum([TraderDocumentStatus.APPROVED, TraderDocumentStatus.REJECTED]).optional(),
      rejectionReason: z.string().trim().min(1).max(2000).optional(),
      expiryDate: documentExpiryDateSchema,
    })
    .superRefine((body, ctx) => {
      if (body.status === undefined && body.expiryDate === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Send status and/or expiryDate.',
          path: ['status'],
        });
      }
      if (body.status === TraderDocumentStatus.REJECTED && !body.rejectionReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'rejectionReason is required when rejecting a document.',
          path: ['rejectionReason'],
        });
      }
    }),
});
