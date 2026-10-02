import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './trader-payouts.controller';
import { stripeOnboardingLinkSchema } from './trader-payouts.validation';

const router = Router();

/**
 * @swagger
 * /traders/payouts/stripe/onboarding-link:
 *   post:
 *     summary: Connect payout account (Stripe Express onboarding link)
 *     tags: ['Trader / Earnings']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates the trader's Stripe Express account on first call, then returns a one-time
 *       hosted onboarding `url` (open in browser / in-app browser). Call again if the link
 *       expired or details are still due. Brisk payouts are sent to this account.
 *
 *       `returnUrl` / `refreshUrl` default to server env `STRIPE_CONNECT_RETURN_URL` /
 *       `STRIPE_CONNECT_REFRESH_URL`.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               returnUrl: { type: string, format: uri }
 *               refreshUrl: { type: string, format: uri }
 *     responses:
 *       201:
 *         description: "`accountId`, `url`, `expiresAt`."
 *       400:
 *         description: "`COUNTRY_REQUIRED` or `CONNECT_URLS_REQUIRED`."
 *       503:
 *         description: "`PAYMENTS_NOT_CONFIGURED`."
 */
router.post(
  '/stripe/onboarding-link',
  validate(stripeOnboardingLinkSchema),
  controller.createStripeOnboardingLink
);

/**
 * @swagger
 * /traders/payouts/stripe/status:
 *   get:
 *     summary: Stripe payout account status
 *     tags: ['Trader / Earnings']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Live status from Stripe. Show "Connect payouts" when `connected=false` or
 *       `requirementsDue` is not empty; payouts work when `transfersEnabled=true`.
 *     responses:
 *       200:
 *         description: |
 *           `connected`, `accountId`, `detailsSubmitted`, `payoutsEnabled`, `transfersEnabled`,
 *           `defaultCurrency`, `requirementsDue[]`, `disabledReason`.
 */
router.get('/stripe/status', controller.getStripeConnectStatus);

export default router;
