import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './payment-requests.controller';
import { jobIdParamSchema, paymentRequestIdParamSchema } from './payment-requests.validation';

const router = Router();
const customerOnly = [authMiddleware, roleMiddleware(['CUSTOMER'] as const)];

/**
 * @swagger
 * components:
 *   schemas:
 *     CustomerPaymentRequest:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         jobId: { type: string, format: uuid }
 *         traderId: { type: string, format: uuid }
 *         type: { type: string, enum: [FULL_JOB, SITE_VISIT_FEE, PARTIAL] }
 *         title: { type: string, example: Installment 1 }
 *         description: { type: string, nullable: true }
 *         status: { type: string, enum: [PENDING, SENT, PAID, CANCELLED] }
 *         serviceCharge: { type: number }
 *         materialsTotal: { type: number }
 *         siteVisitFee: { type: number }
 *         platformFee: { type: number }
 *         vatRate: { type: number, example: 0.2 }
 *         vatAmount: { type: number }
 *         totalAmount: { type: number, example: 250 }
 *         currencyCode: { type: string, example: EUR }
 *         currencySymbol: { type: string, example: "€" }
 *         formattedAmount: { type: string, example: "€250.00" }
 *         paymentMethod: { type: string, nullable: true, enum: [CARD, APPLE_PAY, GOOGLE_PAY] }
 *         cardBrand: { type: string, nullable: true, example: visa }
 *         cardLast4: { type: string, nullable: true, example: "4242" }
 *         paidAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         canPay: { type: boolean, description: True while SENT/PENDING and amount > 0 }
 */

/**
 * @swagger
 * /jobs/{id}/payment-requests:
 *   get:
 *     summary: Trader payment requests for my job (final payment, installments, site visit fee)
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       All non-cancelled requests the trader sent for this job, newest first.
 *       Pay any item with `canPay=true` via `POST /payment-requests/{id}/payment-intent`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: |
 *           `data.jobId`, `data.jobStatus`, `data.isPartPayment` (true when the trader sent any installment /
 *           PARTIAL request), `data.paymentRequests[]` (CustomerPaymentRequest).
 *       404:
 *         description: Job not found for this customer.
 */
router.get(
  '/jobs/:id/payment-requests',
  ...customerOnly,
  validate(jobIdParamSchema),
  controller.listJobPaymentRequests
);

/**
 * @swagger
 * /payment-requests/{id}:
 *   get:
 *     summary: One trader payment request
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/CustomerPaymentRequest' }
 *       404:
 *         description: Not found for this customer.
 */
router.get(
  '/payment-requests/:id',
  ...customerOnly,
  validate(paymentRequestIdParamSchema),
  controller.getPaymentRequest
);

/**
 * @swagger
 * /payment-requests/{id}/payment-intent:
 *   post:
 *     summary: Start Stripe payment for a trader payment request
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns PaymentSheet config. Calling again resumes the same unpaid intent
 *       (no duplicate charges). After PaymentSheet success call
 *       `POST /payment-requests/{id}/confirm`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: |
 *           `paymentRequestId`, `type`, `amount`, `currencyCode`, `currencySymbol`, `requiresPayment`,
 *           `paymentIntentId`, `clientSecret`, `customerId`, `ephemeralKey`, `publishableKey`,
 *           `stripeMerchantIdentifier`.
 *       400:
 *         description: Request cancelled / not payable.
 *       409:
 *         description: "`ALREADY_PAID` or `PAYMENT_PROCESSING`."
 *       503:
 *         description: "`PAYMENTS_NOT_CONFIGURED` — Stripe keys missing on server."
 */
router.post(
  '/payment-requests/:id/payment-intent',
  ...customerOnly,
  validate(paymentRequestIdParamSchema),
  controller.createPaymentRequestIntent
);

/**
 * @swagger
 * /payment-requests/{id}/confirm:
 *   post:
 *     summary: Confirm trader payment request after PaymentSheet success
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Verifies the PaymentIntent with Stripe, marks the request PAID (card brand/last4 from
 *       Stripe). `FULL_JOB` also moves the job PAYMENT_PENDING → COMPLETED. Idempotent; the
 *       Stripe webhook does the same if the app closes early.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/CustomerPaymentRequest' }
 *       400:
 *         description: "`PAYMENT_NOT_COMPLETED`, `PAYMENT_AMOUNT_MISMATCH`, `PAYMENT_INTENT_MISSING`."
 *       409:
 *         description: "`PAYMENT_PROCESSING` — retry shortly."
 */
router.post(
  '/payment-requests/:id/confirm',
  ...customerOnly,
  validate(paymentRequestIdParamSchema),
  controller.confirmPaymentRequest
);

export default router;
