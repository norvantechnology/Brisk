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
export const TRADER_PAYOUT_SORT_FIELDS = ['payoutRef', 'amount', 'currencyCode', 'status', 'stripeTransferId', 'processedAt', 'createdAt'] as const;
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
  }),
});

export const createTraderPayoutSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  body: z.object({
    amount: z.coerce.number().positive('Amount must be greater than 0.').multipleOf(0.01),
    /** Defaults to the trader's Stripe account currency. */
    currencyCode: z.string().trim().length(3).toUpperCase().optional(),
    note: z.string().trim().max(500).optional(),
  }),
});

export type CreateTraderPayoutInput = z.infer<typeof createTraderPayoutSchema>['body'];

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
