import { BillingType, PaymentMethod } from '@prisma/client';
import { z } from 'zod';

const uuid = z.string().uuid();

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
      method: z.nativeEnum(PaymentMethod),
      billingType: z.nativeEnum(BillingType).optional().default(BillingType.INDIVIDUAL),
      companyName: z.string().trim().optional(),
      tinNumber: z.string().trim().optional(),
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

export const confirmPaymentSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      cardLast4: z.string().trim().length(4).optional(),
      cardBrand: z.string().trim().optional(),
    })
    .optional()
    .default({}),
});

export const bookingIdParamSchema = z.object({
  params: z.object({ id: uuid }),
});

export type ApplyPromoInput = z.infer<typeof applyPromoSchema>['body'];
export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>['body'];
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>['body'];
