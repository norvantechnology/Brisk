import { z } from 'zod';
import { UserStatus, DeletionRequestStatus, PaymentStatus, InvoiceStatus, RefundStatus } from '@prisma/client';

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
    emailNotifications: z.boolean().optional(),
    smsAlerts: z.boolean().optional(),
    promoNotifications: z.boolean().optional(),
  }),
});

export const customerFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    status: z.nativeEnum(UserStatus).optional(),
    country: z.string().optional(),
  }),
});

export const deletionRequestFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    status: z.nativeEnum(DeletionRequestStatus).optional(),
    reason: z.string().optional(),
    sort: z.enum(['newest', 'oldest']).optional(),
  }),
});

export const updateDeletionRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Deletion Request ID format.'),
  }),
  body: z.object({
    status: z.nativeEnum(DeletionRequestStatus),
    notes: z.string().optional(),
  }),
});

export const paymentTransactionFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    status: z.nativeEnum(PaymentStatus).optional(),
    method: z.string().optional(),
    sort: z.enum(['newest', 'oldest']).optional(),
  }),
});

export const invoiceFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    status: z.nativeEnum(InvoiceStatus).optional(),
  }),
});

export const refundFilterSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    status: z.nativeEnum(RefundStatus).optional(),
  }),
});

export const processRefundSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Refund ID format.'),
  }),
  body: z.object({
    status: z.nativeEnum(RefundStatus),
    notes: z.string().optional(),
  }),
});
