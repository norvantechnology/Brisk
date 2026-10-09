import { z } from 'zod';
import {
  JobStatus,
  OfferClaimStatus,
  PaymentStatus,
  RefundStatus,
} from '@prisma/client';
import { sortByParam, sortOrderParam } from '../../../utils/list-sort';

export const CUSTOMER_ADDRESS_SORT_FIELDS = ['label', 'addressType', 'addressLine1', 'city', 'county', 'eircode', 'country', 'isDefault', 'createdAt', 'updatedAt'] as const;
export const CUSTOMER_PROPERTY_SORT_FIELDS = ['propertyName', 'addressLine1', 'city', 'county', 'eircode', 'country', 'metersCount', 'createdAt', 'updatedAt'] as const;
export const CUSTOMER_JOB_SORT_FIELDS = ['jobRef', 'title', 'status', 'categoryName', 'traderName', 'city', 'postcode', 'serviceCharge', 'quotesCount', 'photosCount', 'scheduledDate', 'createdAt'] as const;
export const CUSTOMER_PAYMENT_SORT_FIELDS = ['transactionRef', 'amount', 'status', 'method', 'billingType', 'invoiceNumber', 'jobRef', 'traderName', 'paidAt', 'createdAt'] as const;
export const CUSTOMER_REFUND_SORT_FIELDS = ['refundRef', 'transactionRef', 'amount', 'originalAmount', 'reason', 'status', 'processedAt', 'createdAt'] as const;
export const CUSTOMER_OFFER_SORT_FIELDS = ['offerCode', 'title', 'couponCode', 'discountValue', 'validUntil', 'jobRef', 'status', 'usedAt', 'claimedAt'] as const;
export const CUSTOMER_REVIEW_SORT_FIELDS = ['stars', 'review', 'traderName', 'jobRef', 'jobTitle', 'createdAt'] as const;
export const CUSTOMER_NOTIFICATION_SORT_FIELDS = ['type', 'read', 'createdAt'] as const;
export const CUSTOMER_ACTIVITY_SORT_FIELDS = ['eventType', 'actorType', 'actorLabel', 'description', 'createdAt'] as const;

const paginationQuery = {
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: sortOrderParam,
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
    sortBy: sortByParam(CUSTOMER_JOB_SORT_FIELDS),
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
    sortBy: sortByParam(CUSTOMER_ADDRESS_SORT_FIELDS),
    addressType: z.string().optional(),
  }),
});

export const customerPropertiesQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    sortBy: sortByParam(CUSTOMER_PROPERTY_SORT_FIELDS),
  }),
});

export const customerPropertyIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
    propertyId: z.string().uuid('Invalid property ID format.'),
  }),
});

export const customerPaymentsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    sortBy: sortByParam(CUSTOMER_PAYMENT_SORT_FIELDS),
    status: z.nativeEnum(PaymentStatus).optional(),
  }),
});

export const customerRefundsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    sortBy: sortByParam(CUSTOMER_REFUND_SORT_FIELDS),
    status: z.nativeEnum(RefundStatus).optional(),
  }),
});

export const customerOffersQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    sortBy: sortByParam(CUSTOMER_OFFER_SORT_FIELDS),
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
    sortBy: sortByParam(CUSTOMER_REVIEW_SORT_FIELDS),
    stars: z.string().regex(/^[1-5]$/).optional(),
  }),
});

export const customerNotificationsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format.'),
  }),
  query: z.object({
    ...paginationQuery,
    sortBy: sortByParam(CUSTOMER_NOTIFICATION_SORT_FIELDS),
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
    sortBy: sortByParam(CUSTOMER_ACTIVITY_SORT_FIELDS),
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
