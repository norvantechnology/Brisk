import { UserStatus, DeletionRequestStatus, PaymentStatus, InvoiceStatus, RefundStatus } from '@prisma/client';

export interface CustomerQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  country?: string;
}

export interface DeletionRequestQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: DeletionRequestStatus;
  reason?: string;
  sort?: 'newest' | 'oldest';
}

export interface PaymentTransactionQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: PaymentStatus;
  method?: string;
  sort?: 'newest' | 'oldest';
}

export interface InvoiceQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus;
}

export interface RefundQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: RefundStatus;
}

export interface CreateCustomerInput {
  fullName: string;
  email: string;
  primaryPhone: string;
  alternatePhone?: string;
  profilePhotoUrl?: string;
  status?: UserStatus;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  preferredLanguage?: string;
  preferredTimeSlot?: string;
  emailNotifications?: boolean;
  smsAlerts?: boolean;
  promoNotifications?: boolean;
}

export interface UpdateCustomerInput {
  fullName?: string;
  email?: string;
  primaryPhone?: string;
  alternatePhone?: string;
  profilePhotoUrl?: string;
  status?: UserStatus;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  preferredLanguage?: string;
  preferredTimeSlot?: string;
  emailNotifications?: boolean;
  smsAlerts?: boolean;
  promoNotifications?: boolean;
}

export interface UpdateDeletionRequestInput {
  status: DeletionRequestStatus;
  notes?: string;
}

export interface ProcessRefundInput {
  status: RefundStatus;
  notes?: string;
}
