import express, { Request, Response, Router } from 'express';
import Stripe from 'stripe';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { constructStripeEvent, handleStripeEvent } from './stripe-webhook.service';

const router = Router();

/**
 * @swagger
 * /webhooks/stripe:
 *   post:
 *     summary: Stripe webhook (server-to-server only)
 *     tags: ['Customer / Checkout']
 *     description: |
 *       Configure in Stripe Dashboard → Developers → Webhooks with URL
 *       `https://<api-host>/webhooks/stripe` and events:
 *       `payment_intent.succeeded`, `payment_intent.payment_failed`,
 *       `refund.created`, `refund.updated`, `refund.failed`.
 *
 *       Verified with `STRIPE_WEBHOOK_SECRET` (Stripe-Signature header). Finalizes invoice
 *       payments and trader payment requests even if the app never calls confirm, and keeps
 *       refund status in sync.
 *     responses:
 *       200: { description: Event received }
 *       400: { description: Invalid signature }
 *       503: { description: Webhook secret not configured }
 */
router.post('/', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  let event: Stripe.Event;
  try {
    event = constructStripeEvent(req.body as Buffer, req.header('stripe-signature'));
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    logger.warn('Stripe webhook signature verification failed', { error: (error as Error).message });
    res.status(400).json({ success: false, message: 'Invalid Stripe signature.' });
    return;
  }

  try {
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (error) {
    // Business rule failures won't succeed on retry — acknowledge; infra errors → 500 so Stripe retries.
    if (error instanceof AppError && error.isOperational) {
      logger.error('Stripe webhook event rejected', { eventId: event.id, type: event.type, error: error.message });
      res.json({ received: true });
      return;
    }
    logger.error('Stripe webhook handler failed', { eventId: event.id, type: event.type, error });
    res.status(500).json({ success: false, message: 'Webhook handler failed.' });
  }
});

export default router;
