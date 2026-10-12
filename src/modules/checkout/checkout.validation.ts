import { BillingType, PaymentMethod } from '@prisma/client';
import { z } from 'zod';
import { requireCustomRange } from '../traders/payments/trader-payments.validation';

const uuid = z.string().uuid();

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .optional();

export const invoiceIdParamSchema = z.object({
  params: z.object({ id: uuid }),
});

export const applyPromoSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    code: z.string().trim().min(1, 'Promo code is required.'),
  }),
});

export const createPaymentIntentSchema = z.object({
  body: z
    .object({
      invoiceId: uuid,
      /** Optional on Payment Details Pay Now — defaults to CARD */
      method: z.nativeEnum(PaymentMethod).optional().default(PaymentMethod.CARD),
      billingType: z.nativeEnum(BillingType).optional().default(BillingType.INDIVIDUAL),
      companyName: z.string().trim().optional(),
      tinNumber: z.string().trim().optional(),
      /** Optional — fill on checkout/billing screen if needed; not required for Pay Now */
      billingAddress: z
        .object({
          firstName: z.string().trim().min(1),
          lastName: z.string().trim().min(1),
          street: z.string().trim().min(1),
          city: z.string().trim().min(1),
          country: z.string().trim().min(1),
          postcode: z.string().trim().min(1),
        })
        .optional(),
    })
    .superRefine((data, ctx) => {
      if (data.billingType === BillingType.COMPANY && !data.companyName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'companyName is required for COMPANY billing.',
          path: ['companyName'],
        });
      }
    }),
});

export const paymentIdParamSchema = z.object({
  params: z.object({ id: uuid }),
});

/** Card details are read from Stripe, never from the client. */
export const confirmPaymentSchema = z.object({
  params: z.object({ id: uuid }),
});

export const failPaymentSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      reason: z.string().trim().max(500).optional(),
    })
    .optional()
    .default({}),
});

export const bookingIdParamSchema = z.object({
  params: z.object({ id: uuid }),
});

const historyPeriod = z
  .enum(['all', 'last_30_days', 'last_6_months', 'last_1_year', 'custom'])
  .optional();

/**
 * Customer Transaction History filters.
 * Mobile sends `date_range` + `from`/`to`; also accepts trader-style `filter` + `startDate`/`endDate`.
 */
export const paymentHistoryQuerySchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
      filter: historyPeriod,
      date_range: historyPeriod,
      startDate: dateString,
      endDate: dateString,
      from: dateString,
      to: dateString,
    })
    .transform((q) => {
      const filter = q.date_range ?? q.filter ?? 'all';
      const startDate = q.from ?? q.startDate;
      const endDate = q.to ?? q.endDate;
      return {
        page: q.page,
        limit: q.limit,
        search: q.search,
        filter,
        startDate,
        endDate,
      };
    })
    .superRefine(requireCustomRange),
});

export type ApplyPromoInput = z.infer<typeof applyPromoSchema>['body'];
export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>['body'];
export type FailPaymentInput = z.infer<typeof failPaymentSchema>['body'];
export type PaymentHistoryQuery = z.infer<typeof paymentHistoryQuerySchema>['query'];
