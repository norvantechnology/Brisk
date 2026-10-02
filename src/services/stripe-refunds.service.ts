import { InvoiceStatus, RefundStatus, type Payment, type Refund } from '@prisma/client';
import type Stripe from 'stripe';
import { prisma } from '../config/database';
import { emitRefundUpdated } from '../sockets/realtime';
import { getStripe, toMinorUnits } from './stripe.service';

/** Stripe refund status → Brisk status. null = failed/canceled (money not returned). */
export const mapStripeRefundStatus = (status: string | null | undefined): RefundStatus | null => {
  if (status === 'succeeded') return RefundStatus.COMPLETED;
  if (status === 'pending' || status === 'requires_action') return RefundStatus.APPROVED;
  return null;
};

/** Payments taken before Stripe go-live have no real PaymentIntent — nothing to refund on Stripe. */
export const isStripeCharge = (payment: Pick<Payment, 'stripePaymentIntentId'> | null) =>
  Boolean(
    payment?.stripePaymentIntentId?.startsWith('pi_') &&
      !payment.stripePaymentIntentId.startsWith('pi_mock_')
  );

export const createStripeRefund = async (refund: Refund, payment: Payment) =>
  getStripe().refunds.create(
    {
      payment_intent: payment.stripePaymentIntentId!,
      amount: toMinorUnits(Number(refund.refundAmount), payment.currencyCode),
      metadata: { refundId: refund.id, paymentId: payment.id, userId: refund.userId },
    },
    // Same refund state ⇒ same key, so a double-click never refunds twice.
    { idempotencyKey: `refund-${refund.id}-${refund.updatedAt.getTime()}` }
  );

/** Invoice → REFUNDED once completed refunds cover the full payment. */
export const markInvoiceRefundedIfFull = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { refunds: { where: { status: RefundStatus.COMPLETED } } },
  });
  if (!payment) return;
  const refunded = payment.refunds.reduce((sum, r) => sum + Number(r.refundAmount), 0);
  if (refunded + 0.005 >= Number(payment.amount)) {
    await prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: InvoiceStatus.REFUNDED },
    });
  }
};

/** Webhook: apply Stripe's final refund state to our Refund row. */
export const syncRefundFromStripe = async (stripeRefund: Stripe.Refund) => {
  const refund = await prisma.refund.findFirst({
    where: {
      OR: [
        { stripeRefundId: stripeRefund.id },
        ...(stripeRefund.metadata?.refundId ? [{ id: stripeRefund.metadata.refundId }] : []),
      ],
    },
  });
  if (!refund) return false;

  const mapped = mapStripeRefundStatus(stripeRefund.status);
  const updated = await prisma.refund.update({
    where: { id: refund.id },
    data: mapped
      ? { status: mapped, stripeRefundId: stripeRefund.id }
      : {
          // Money was not returned — back to PENDING so admin can retry.
          status: RefundStatus.PENDING,
          stripeRefundId: null,
          adminNote: [
            refund.adminNote,
            `Stripe refund ${stripeRefund.status}${stripeRefund.failure_reason ? `: ${stripeRefund.failure_reason}` : ''}`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
  });
  if (updated.status === RefundStatus.COMPLETED && updated.paymentId) {
    await markInvoiceRefundedIfFull(updated.paymentId);
  }
  emitRefundUpdated({
    refundId: updated.id,
    paymentId: updated.paymentId,
    status: updated.status,
    amount: Number(updated.refundAmount),
    currencyCode: updated.currencyCode,
    customerId: updated.userId,
    at: new Date().toISOString(),
  });
  return true;
};
