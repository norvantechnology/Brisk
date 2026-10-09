import { UserStatus, DeletionRequestStatus, PaymentStatus, InvoiceStatus, RefundStatus } from '@prisma/client';

export interface CustomerQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  country?: string;
  city?: string;
  emailVerified?: boolean;
  mobileVerified?: boolean;
  joinedFrom?: string;
  joinedTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DeletionRequestQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: DeletionRequestStatus;
  reason?: string;
  sort?: 'newest' | 'oldest';
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaymentTransactionQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: PaymentStatus;
  method?: string;
  sort?: 'newest' | 'oldest';
  customerId?: string;
  traderId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InvoiceQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus;
  customerId?: string;
  traderId?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RefundQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: RefundStatus;
  customerId?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
  preferredCurrency?: string;
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
  preferredCurrency?: string;
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
