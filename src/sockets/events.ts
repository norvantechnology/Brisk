/** Socket.IO event names — mobile listens; REST APIs unchanged. */
export const RealtimeEvents = {
  JOB_CREATED: 'job:created',
  JOB_UPDATED: 'job:updated',
  JOB_PUBLISHED: 'job:published',
  JOB_STATUS_CHANGED: 'job:status_changed',
  /** Customer accepted this trader's quote → trader bottom sheet (View & Accept / Decline). */
  JOB_ACCEPT: 'job:accept',
  /** Customer switched to another trader's quote → close this trader's sheet. */
  JOB_ACCEPT_CANCELLED: 'job:accept_cancelled',
  /** Trader declined the customer's acceptance → customer can pick another quote. */
  JOB_DECLINED: 'job:declined',
  /** Trader submitted / requested a quote on the customer's job. */
  QUOTE_RECEIVED: 'quote:received',
  PAYMENT_COMPLETED: 'payment:completed',
  PAYMENT_FAILED: 'payment:failed',
  PAYMENT_REQUEST_PAID: 'payment_request:paid',
  REFUND_UPDATED: 'refund:updated',
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
  /** Discover / marketplace fields (optional) */
  title?: string | null;
  city?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  siteVisitRequested?: boolean;
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

export type QuoteRealtimePayload = {
  jobId: string;
  quoteId: string;
  customerId: string;
  traderId: string;
  traderName?: string | null;
  amount?: number;
  currencyCode?: string;
  at: string;
};

export type PaymentRequestRealtimePayload = {
  paymentRequestId: string;
  type: string;
  jobId: string;
  /** Set when paying this request moved the job (FULL_JOB → COMPLETED). */
  jobStatus?: string | null;
  status: string;
  amount: number;
  currencyCode: string;
  customerId: string;
  traderId: string;
  traderUserId?: string | null;
  at: string;
};

export type RefundRealtimePayload = {
  refundId: string;
  paymentId?: string | null;
  status: string;
  amount: number;
  currencyCode: string;
  customerId: string;
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
