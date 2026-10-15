import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './trader-payouts.controller';
import {
  createPayoutRequestSchema,
  payoutIdParamSchema,
  stripeOnboardingLinkSchema,
  traderJobPayoutSummarySchema,
  traderPayoutJobsQuerySchema,
  traderPayoutsListQuerySchema,
} from './trader-payouts.validation';

const router = Router();

/**
 * @swagger
 * /traders/payouts/jobs:
 *   get:
 *     summary: Jobs eligible for payout request (Trader Web Portal)
 *     tags: ['Trader / Earnings']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Job-wise balances after customer payment. Use `availableToRequest` for the max
 *       full/partial amount the trader may submit. Open PENDING requests reserve balance.
 *       Filter `eligibleOnly=true` for jobs that still have available balance.
 *     parameters:
 *       - in: query
 *         name: eligibleOnly
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: payoutStatus
 *         schema: { type: string, enum: [UNPAID, PARTIALLY_PAID, PAID] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Job payout balance cards
 */
router.get('/jobs', validate(traderPayoutJobsQuerySchema), controller.listPayoutJobs);

/**
 * @swagger
 * /traders/payouts/jobs/{jobId}:
 *   get:
 *     summary: Single job payout balance + installment / request history
 *     tags: ['Trader / Earnings']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Balance + installments[]
 *       404:
 *         description: Job not found
 */
router.get(
  '/jobs/:jobId',
  validate(traderJobPayoutSummarySchema),
  controller.getJobPayoutSummary
);

/**
 * @swagger
 * /traders/payouts:
 *   get:
 *     summary: List my payout requests / installments
 *     tags: ['Trader / Earnings']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, PROCESSING, COMPLETED, FAILED] }
 *       - in: query
 *         name: jobId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payout rows (PENDING = awaiting admin)
 */
router.get('/', validate(traderPayoutsListQuerySchema), controller.listMyPayouts);

/**
 * @swagger
 * /traders/payouts:
 *   post:
 *     summary: Submit job-wise payout request to Admin (full or partial)
 *     tags: ['Trader / Earnings']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Creates a `PENDING` payout for the job. Amount must be ≤ `availableToRequest`
 *       from `GET /traders/payouts/jobs` or `GET /traders/payouts/jobs/{jobId}`.
 *       Admin approves via `PATCH /admin/traders/{id}/payouts/{payoutId}`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [jobId, amount]
 *             properties:
 *               jobId: { type: string, format: uuid }
 *               amount: { type: number, example: 50 }
 *               currencyCode: { type: string, example: EUR }
 *               note: { type: string }
 *           example:
 *             jobId: 60501fbc-1da5-44fc-9f06-6f6fd69fa456
 *             amount: 50
 *             note: Partial payout after customer paid
 *     responses:
 *       201:
 *         description: Request created (status PENDING) with updated jobPayout
 *       400:
 *         description: |
 *           `JOB_NOT_ELIGIBLE_FOR_PAYOUT` | `JOB_PAYOUT_ALREADY_COMPLETE` |
 *           `JOB_PAYOUT_BALANCE_RESERVED` | `PAYOUT_EXCEEDS_REMAINING`
 *       404:
 *         description: Job not found
 */
router.post('/', validate(createPayoutRequestSchema), controller.requestJobPayout);

/**
 * @swagger
 * /traders/payouts/{payoutId}/cancel:
 *   post:
 *     summary: Cancel my pending payout request
 *     tags: ['Trader / Earnings']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: payoutId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Cancelled (status FAILED)
 *       400:
 *         description: Not PENDING
 *       404:
 *         description: Not found
 */
router.post(
  '/:payoutId/cancel',
  validate(payoutIdParamSchema),
  controller.cancelPayoutRequest
);

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
