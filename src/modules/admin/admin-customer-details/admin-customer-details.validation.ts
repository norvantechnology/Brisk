import { z } from 'zod';
import {
  JobStatus,
  OfferClaimStatus,
  PaymentStatus,
} from '@prisma/client';

const paginationQuery = {
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  from: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  to: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
};

export const customerDetailsIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
});

export const customerJobsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    status: z.nativeEnum(JobStatus).optional(),
    categoryId: z.string().uuid().optional(),
  }),
});

export const customerJobIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
    jobId: z.string().uuid('Invalid job ID format.'),
  }),
});

export const customerAddressesQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    addressType: z.string().optional(),
  }),
});

export const customerPaymentsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    status: z.nativeEnum(PaymentStatus).optional(),
  }),
});

export const customerOffersQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    state: z.enum(['ALL', 'CLAIMED', 'USED', 'EXPIRED', 'CANCELLED']).optional(),
    status: z.nativeEnum(OfferClaimStatus).optional(),
  }),
});

export const customerReviewsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    stars: z.string().regex(/^[1-5]$/).optional(),
  }),
});

export const customerNotificationsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    read: z.enum(['true', 'false']).optional(),
    type: z.string().optional(),
  }),
});

export const customerActivityQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    eventType: z.string().optional(),
  }),
});

export const customerChatsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
  }),
});

export const customerChatThreadParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
    jobId: z.string().uuid('Invalid job ID format.'),
  }),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
