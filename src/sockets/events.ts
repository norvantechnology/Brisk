/** Socket.IO event names — mobile listens; REST APIs unchanged. */
export const RealtimeEvents = {
  JOB_CREATED: 'job:created',
  JOB_UPDATED: 'job:updated',
  JOB_PUBLISHED: 'job:published',
  JOB_STATUS_CHANGED: 'job:status_changed',
  PAYMENT_COMPLETED: 'payment:completed',
  PAYMENT_FAILED: 'payment:failed',
  INVOICE_UPDATED: 'invoice:updated',
  NOTIFICATION_NEW: 'notification:new',
} as const;

export type RealtimeEventName = (typeof RealtimeEvents)[keyof typeof RealtimeEvents];

export type JobRealtimePayload = {
  jobId: string;
  jobRef?: string;
  status: string;
  customerId: string;
  traderId?: string | null;
  invoiceId?: string | null;
  bookingId?: string | null;
  at: string;
};

export type PaymentRealtimePayload = {
  paymentId: string;
  invoiceId: string;
  jobId?: string | null;
  bookingId?: string | null;
  status: string;
  amount?: number;
  customerId: string;
  traderId?: string | null;
  at: string;
};

export type InvoiceRealtimePayload = {
  invoiceId: string;
  jobId?: string | null;
  status: string;
  totalAmount?: number;
  promoDiscount?: number;
  promoApplied?: boolean;
  customerId: string;
  at: string;
};
