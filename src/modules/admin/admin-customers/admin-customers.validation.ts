import { z } from 'zod';
import { UserStatus, DeletionRequestStatus, PaymentStatus, InvoiceStatus, RefundStatus, PaymentMethod } from '@prisma/client';
import { requireNoteWhenRejected } from '../../../utils/reject-note';
import { sortByParam, sortOrderParam } from '../../../utils/list-sort';
import { amountParam, boolParam, isoDateParam, minLteMax } from '../../../utils/list-filters';

export const createCustomerSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required.'),
    email: z.string().email('Invalid email address format.'),
    primaryPhone: z.string().min(5, 'Primary phone number is required.'),
    alternatePhone: z.string().optional(),
    profilePhotoUrl: z.string().optional(),
    status: z.nativeEnum(UserStatus).optional().default(UserStatus.ACTIVE),
    emailVerified: z.boolean().optional().default(false),
    phoneVerified: z.boolean().optional().default(false),
    preferredLanguage: z.string().optional().default('English (UK)'),
    preferredTimeSlot: z.string().optional().default('Morning (09:00 - 12:00)'),
    preferredCurrency: z.string().length(3).optional().default('EUR'),
    emailNotifications: z.boolean().optional().default(true),
    smsAlerts: z.boolean().optional().default(true),
    promoNotifications: z.boolean().optional().default(false),
  }),
});

export const updateCustomerSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Customer ID format.'),
  }),
  body: z.object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    primaryPhone: z.string().min(5).optional(),
    alternatePhone: z.string().optional(),
    profilePhotoUrl: z.string().optional(),
    status: z.nativeEnum(UserStatus).optional(),
    emailVerified: z.boolean().optional(),
    phoneVerified: z.boolean().optional(),
    preferredLanguage: z.string().optional(),
    preferredTimeSlot: z.string().optional(),
    preferredCurrency: z.string().length(3).optional(),
    emailNotifications: z.boolean().optional(),
    smsAlerts: z.boolean().optional(),
    promoNotifications: z.boolean().optional(),
  }),
});

export const ADMIN_CUSTOMER_SORT_FIELDS = [
  'customerCode',
  'fullName',
  'email',
  'mobileNumber',
  'city',
  'country',
  'totalOrders',
  'totalSpent',
  'status',
  'emailVerified',
  'mobileVerified',
  'joinedAt',
] as const;

export const customerFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    status: z.nativeEnum(UserStatus).optional(),
    country: z.string().optional(),
    city: z.string().trim().optional(),
    emailVerified: boolParam,
    mobileVerified: boolParam,
    joinedFrom: isoDateParam,
    joinedTo: isoDateParam,
    sortBy: sortByParam(ADMIN_CUSTOMER_SORT_FIELDS),
    sortOrder: sortOrderParam,
  }),
});

export const ADMIN_DELETION_REQUEST_SORT_FIELDS = [
  'requestRef',
  'customerName',
  'email',
  'phone',
  'reason',
  'requestedAt',
  'status',
  'reviewedBy',
] as const;

export const deletionRequestFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    status: z.nativeEnum(DeletionRequestStatus).optional(),
    reason: z.string().optional(),
    /** Legacy: newest | oldest (requestedAt). Ignored when sortBy is sent. */
    sort: z.enum(['newest', 'oldest']).optional(),
    from: isoDateParam,
    to: isoDateParam,
    sortBy: sortByParam(ADMIN_DELETION_REQUEST_SORT_FIELDS),
    sortOrder: sortOrderParam,
  }),
});

export const updateDeletionRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Deletion Request ID format.'),
  }),
  body: z.preprocess(
    (body) => {
      if (!body || typeof body !== 'object') return body;
      const b = body as Record<string, unknown>;
      return { ...b, notes: b.notes ?? b.adminNotes ?? b.rejectionReason };
    },
    z
      .object({
        status: z.nativeEnum(DeletionRequestStatus),
        notes: z.string().trim().max(2000).optional(),
      })
      .superRefine(requireNoteWhenRejected('notes'))
  ),
});

export const ADMIN_TRANSACTION_SORT_FIELDS = [
  'transactionRef',
  'date',
  'customerName',
  'jobTitle',
  'bookingRef',
  'categoryName',
  'traderName',
  'serviceCharge',
  'discount',
  'fee',
  'totalPaid',
  'paymentMethod',
  'status',
] as const;

export const paymentTransactionFilterSchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
      status: z.nativeEnum(PaymentStatus).optional(),
      method: z.string().trim().toUpperCase().pipe(z.nativeEnum(PaymentMethod)).optional(),
      /** Legacy: newest | oldest (createdAt). Ignored when sortBy is sent. */
      sort: z.enum(['newest', 'oldest']).optional(),
      customerId: z.string().uuid('Invalid customer ID format.').optional(),
      traderId: z.string().uuid('Invalid trader ID format.').optional(),
      categoryId: z.string().uuid('Invalid category ID format.').optional(),
      from: isoDateParam,
      to: isoDateParam,
      minAmount: amountParam,
      maxAmount: amountParam,
      sortBy: sortByParam(ADMIN_TRANSACTION_SORT_FIELDS),
      sortOrder: sortOrderParam,
    })
    .superRefine(minLteMax('minAmount', 'maxAmount')),
});

export const ADMIN_INVOICE_SORT_FIELDS = [
  'invoiceNumber',
  'customerName',
  'jobTitle',
  'traderName',
  'invoiceDate',
  'amount',
  'status',
] as const;

export const invoiceFilterSchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
      status: z.nativeEnum(InvoiceStatus).optional(),
      customerId: z.string().uuid('Invalid customer ID format.').optional(),
      traderId: z.string().uuid('Invalid trader ID format.').optional(),
      from: isoDateParam,
      to: isoDateParam,
      minAmount: amountParam,
      maxAmount: amountParam,
      sortBy: sortByParam(ADMIN_INVOICE_SORT_FIELDS),
      sortOrder: sortOrderParam,
    })
    .superRefine(minLteMax('minAmount', 'maxAmount')),
});

export const ADMIN_REFUND_SORT_FIELDS = [
  'refundRef',
  'transactionRef',
  'customerName',
  'jobTitle',
  'originalAmount',
  'refundAmount',
  'reason',
  'status',
  'requestedAt',
] as const;

export const refundFilterSchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
      status: z.nativeEnum(RefundStatus).optional(),
      customerId: z.string().uuid('Invalid customer ID format.').optional(),
      from: isoDateParam,
      to: isoDateParam,
      minAmount: amountParam,
      maxAmount: amountParam,
      sortBy: sortByParam(ADMIN_REFUND_SORT_FIELDS),
      sortOrder: sortOrderParam,
    })
    .superRefine(minLteMax('minAmount', 'maxAmount')),
});

export const processRefundSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Refund ID format.'),
  }),
  body: z
    .object({
      status: z.nativeEnum(RefundStatus),
      notes: z.string().trim().max(2000).optional(),
    })
    .superRefine(requireNoteWhenRejected('notes')),
});
