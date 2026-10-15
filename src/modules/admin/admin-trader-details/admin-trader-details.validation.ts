import { z } from 'zod';
import {
  JobStatus,
  OfferStatus,
  PayoutStatus,
  TraderDocumentStatus,
} from '@prisma/client';
import { sortByParam, sortOrderParam } from '../../../utils/list-sort';

export const TRADER_DOCUMENT_SORT_FIELDS = ['name', 'documentKey', 'required', 'scope', 'categoryName', 'fileName', 'status', 'expiryDate', 'reviewedAt', 'uploadedAt'] as const;
export const TRADER_JOB_SORT_FIELDS = ['jobRef', 'title', 'customerName', 'categoryName', 'subcategoryName', 'date', 'scheduledDate', 'amount', 'status', 'siteVisitFee', 'siteVisitStatus', 'bookingRef', 'createdAt'] as const;
export const TRADER_REVIEW_SORT_FIELDS = ['stars', 'review', 'customerName', 'bookingRef', 'jobRef', 'jobTitle', 'categoryName', 'createdAt'] as const;
export const TRADER_PAYOUT_SORT_FIELDS = [
  'payoutRef',
  'amount',
  'currencyCode',
  'status',
  'stripeTransferId',
  'processedAt',
  'createdAt',
  'jobRef',
] as const;

/** Job-level payout balance for admin UI (computed from customer PAID amounts vs COMPLETED payouts). */
export const JOB_PAYOUT_BALANCE_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID'] as const;
export type JobPayoutBalanceStatus = (typeof JOB_PAYOUT_BALANCE_STATUSES)[number];

export const TRADER_PAYOUT_JOB_SORT_FIELDS = [
  'jobRef',
  'title',
  'totalPayable',
  'amountPaid',
  'remainingBalance',
  'payoutStatus',
  'updatedAt',
] as const;
export const TRADER_OFFER_SORT_FIELDS = ['offerCode', 'title', 'couponCode', 'discountType', 'discountValue', 'categoryName', 'validFrom', 'validUntil', 'status', 'claimsCount', 'revenueGenerated', 'viewsCount', 'createdAt', 'updatedAt'] as const;

const paginationQuery = {
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: sortOrderParam,
  from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
};

export const traderDetailsIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
});

export const traderDocumentsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    sortBy: sortByParam(TRADER_DOCUMENT_SORT_FIELDS),
    status: z.nativeEnum(TraderDocumentStatus).optional(),
    scope: z.enum(['ENTITY', 'CATEGORY', 'ALL']).optional(),
  }),
});

export const traderJobsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    sortBy: sortByParam(TRADER_JOB_SORT_FIELDS),
    status: z.nativeEnum(JobStatus).optional(),
    categoryId: z.string().uuid().optional(),
  }),
});

export const traderReviewsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    sortBy: sortByParam(TRADER_REVIEW_SORT_FIELDS),
    stars: z.string().regex(/^[1-5]$/).optional(),
  }),
});

export const traderPayoutsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    sortBy: sortByParam(TRADER_PAYOUT_SORT_FIELDS),
    status: z.nativeEnum(PayoutStatus).optional(),
    jobId: z.string().uuid('Invalid job ID format.').optional(),
    search: z.string().trim().max(100).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

export const traderPayoutJobsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    sortBy: sortByParam(TRADER_PAYOUT_JOB_SORT_FIELDS),
    /** Job-level balance: UNPAID | PARTIALLY_PAID | PAID */
    payoutStatus: z.enum(JOB_PAYOUT_BALANCE_STATUSES).optional(),
    /** Only jobs with remainingBalance > 0 (eligible for another installment). */
    eligibleOnly: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    search: z.string().trim().max(100).optional(),
  }),
});

export const traderJobPayoutSummarySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
    jobId: z.string().uuid('Invalid job ID format.'),
  }),
});

export const createTraderPayoutSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  body: z.object({
    /** Required — payouts are job-wise (partial installments allowed). */
    jobId: z.string().uuid('Invalid job ID format.'),
    amount: z.coerce.number().positive('Amount must be greater than 0.').multipleOf(0.01),
    currencyCode: z.string().trim().length(3).toUpperCase().optional(),
    note: z.string().trim().max(500).optional(),
    /** Bank remittance / transfer reference (manual payout). */
    bankReference: z.string().trim().max(120).optional(),
  }),
});

export type CreateTraderPayoutInput = z.infer<typeof createTraderPayoutSchema>['body'];

export const reviewTraderPayoutSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
    payoutId: z.string().uuid('Invalid payout ID format.'),
  }),
  body: z.object({
    action: z.enum(['approve', 'reject']),
    bankReference: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
  }),
});

export type ReviewTraderPayoutInput = z.infer<typeof reviewTraderPayoutSchema>['body'];

export const traderOffersQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    sortBy: sortByParam(TRADER_OFFER_SORT_FIELDS),
    status: z.nativeEnum(OfferStatus).optional(),
    categoryId: z.string().uuid().optional(),
  }),
});
