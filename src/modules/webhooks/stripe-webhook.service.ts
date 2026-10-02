import { InvoiceStatus, PaymentStatus, TraderPaymentRequestStatus } from '@prisma/client';
import type Stripe from 'stripe';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import {
  STRIPE_KIND_INVOICE,
  STRIPE_KIND_PAYMENT_REQUEST,
  assertIntentMatches,
  getChargeDetails,
  getStripe,
} from '../../services/stripe.service';
import { syncRefundFromStripe } from '../../services/stripe-refunds.service';
import { ServiceUnavailableError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { finalizeInvoicePayment } from '../checkout/checkout.service';
import { finalizePaymentRequest } from '../payment-requests/payment-requests.service';

export const constructStripeEvent = (rawBody: Buffer, signature: string | undefined): Stripe.Event => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new ServiceUnavailableError('Stripe webhook is not configured.', {
      code: 'PAYMENTS_NOT_CONFIGURED',
    });
  }
  return getStripe().webhooks.constructEvent(rawBody, signature ?? '', env.STRIPE_WEBHOOK_SECRET);
};

/** Customer was charged for something already paid by another intent — give the money back. */
const refundDuplicateCharge = async (intent: Stripe.PaymentIntent, reason: string) => {
  logger.error('Stripe duplicate charge — refunding', { paymentIntentId: intent.id, reason });
  await getStripe().refunds.create(
    { payment_intent: intent.id, metadata: { reason: 'duplicate', note: reason } },
    { idempotencyKey: `duplicate-refund-${intent.id}` }
  );
};

const handleInvoiceIntentSucceeded = async (intent: Stripe.PaymentIntent) => {
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { stripePaymentIntentId: intent.id },
        ...(intent.metadata.paymentId ? [{ id: intent.metadata.paymentId }] : []),
      ],
    },
    include: { invoice: { select: { status: true } } },
  });
  if (!payment) {
    logger.warn('Stripe webhook: payment not found for intent', { paymentIntentId: intent.id });
    return;
  }
  if (payment.status === PaymentStatus.COMPLETED) return;
  if (payment.invoice.status !== InvoiceStatus.UNPAID) {
    await refundDuplicateCharge(intent, `invoice ${payment.invoiceId} already ${payment.invoice.status}`);
    return;
  }
  assertIntentMatches(intent, Number(payment.amount), payment.currencyCode);
  if (payment.stripePaymentIntentId !== intent.id) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripePaymentIntentId: intent.id },
    });
  }
  await finalizeInvoicePayment(payment.id, await getChargeDetails(intent));
};

const handlePaymentRequestIntentSucceeded = async (intent: Stripe.PaymentIntent) => {
  const request = await prisma.traderPaymentRequest.findFirst({
    where: {
      OR: [
        { stripePaymentIntentId: intent.id },
        ...(intent.metadata.paymentRequestId ? [{ id: intent.metadata.paymentRequestId }] : []),
      ],
    },
  });
  if (!request) {
    logger.warn('Stripe webhook: payment request not found for intent', { paymentIntentId: intent.id });
    return;
  }
  if (request.status === TraderPaymentRequestStatus.PAID) {
    if (request.stripePaymentIntentId !== intent.id) {
      await refundDuplicateCharge(intent, `payment request ${request.id} already paid`);
    }
    return;
  }
  if (request.status === TraderPaymentRequestStatus.CANCELLED) {
    await refundDuplicateCharge(intent, `payment request ${request.id} was cancelled`);
    return;
  }
  assertIntentMatches(intent, Number(request.totalAmount), request.currencyCode);
  await finalizePaymentRequest(request.id, intent);
};

export const handleStripeEvent = async (event: Stripe.Event) => {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      if (intent.metadata.kind === STRIPE_KIND_INVOICE) await handleInvoiceIntentSucceeded(intent);
      else if (intent.metadata.kind === STRIPE_KIND_PAYMENT_REQUEST) {
        await handlePaymentRequestIntentSucceeded(intent);
      }
      return;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      logger.info('Stripe payment failed', {
        paymentIntentId: intent.id,
        kind: intent.metadata.kind,
        code: intent.last_payment_error?.code,
      });
      return;
    }
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed':
      await syncRefundFromStripe(event.data.object);
      return;
    default:
      return;
  }
};
