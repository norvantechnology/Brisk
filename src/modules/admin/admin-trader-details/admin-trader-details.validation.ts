import { z } from 'zod';
import {
  JobStatus,
  OfferStatus,
  PayoutStatus,
  TraderDocumentStatus,
} from '@prisma/client';

const paginationQuery = {
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
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
    stars: z.string().regex(/^[1-5]$/).optional(),
  }),
});

export const traderPayoutsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid trader ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
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
    status: z.nativeEnum(OfferStatus).optional(),
    categoryId: z.string().uuid().optional(),
  }),
});
