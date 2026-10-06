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
 *       **Installment Payments screen + Installment Payment History — single API.**
 *       - `breakdown` — job amount the trader bills: `quotePrice` + `materialsTotal` + `siteVisitFee` +
 *         `platformFee` + `vatAmount` = `totalAmount` (same calculation as the trader app). null before a trader is booked.
 *       - `summary` — `totalJobAmount`, `amountPaid` (sum of PAID requests), `dueBalance` (total − paid),
 *         `pendingAmount` (requests waiting for payment), `paymentStatus` (UNPAID / PENDING / PARTIALLY PAID / PAID).
 *       - `paymentRequests[]` — all non-cancelled requests, newest first:
 *         **Payment Progress** = all rows (`status` PAID = done, SENT = pending);
 *         **Pay Now** = row with `canPay: true` → `POST /payment-requests/{id}/payment-intent`;
 *         **Transaction History** = rows with `status: PAID` (`paidAt`, `cardBrand`, `cardLast4`).
 *       - `isPartPayment` — true when the trader sent any installment (PARTIAL) request.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Installment payments for the job.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Payment requests fetched successfully.
 *               data:
 *                 jobId: 89d85512-3ff7-4fc7-a44a-2e594130d71c
 *                 jobStatus: IN_PROGRESS
 *                 isPartPayment: true
 *                 summary:
 *                   totalJobAmount: 1248
 *                   amountPaid: 517.2
 *                   dueBalance: 730.8
 *                   pendingAmount: 420
 *                   paymentStatus: PARTIALLY PAID
 *                   currencyCode: EUR
 *                   currencySymbol: €
 *                 breakdown:
 *                   quotePrice: 1000
 *                   materialsTotal: 0
 *                   siteVisitFee: 30
 *                   platformFee: 10
 *                   vatRate: 0.2
 *                   vatAmount: 208
 *                   totalAmount: 1248
 *                   currencyCode: EUR
 *                   currencySymbol: €
 *                 paymentRequests:
 *                   - id: 3c4d5e6f-0000-4000-8000-000000000003
 *                     type: PARTIAL
 *                     title: Final Installment
 *                     status: SENT
 *                     totalAmount: 420
 *                     formattedAmount: €420.00
 *                     paidAt: null
 *                     createdAt: '2026-07-20T10:00:00.000Z'
 *                     canPay: true
 *                   - id: 2b3c4d5e-0000-4000-8000-000000000002
 *                     type: PARTIAL
 *                     title: Initial Deposit
 *                     status: PAID
 *                     totalAmount: 481.2
 *                     formattedAmount: €481.20
 *                     paymentMethod: CARD
 *                     cardBrand: visa
 *                     cardLast4: '4242'
 *                     paidAt: '2026-07-14T11:20:00.000Z'
 *                     createdAt: '2026-07-10T09:00:00.000Z'
 *                     canPay: false
 *                   - id: 1a2b3c4d-0000-4000-8000-000000000001
 *                     type: SITE_VISIT_FEE
 *                     title: Site Visit Fee
 *                     status: PAID
 *                     totalAmount: 36
 *                     formattedAmount: €36.00
 *                     paidAt: '2026-07-05T15:00:00.000Z'
 *                     createdAt: '2026-07-05T12:00:00.000Z'
 *                     canPay: false
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
