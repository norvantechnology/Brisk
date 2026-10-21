import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './payment-requests.controller';
import { jobIdParamSchema, paymentHistoryQuerySchema } from './payment-requests.validation';

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
 *         transactionId: { type: string, example: TXN-82736A, description: Display ID (same as trader app) }
 *         invoiceId: { type: string, format: uuid, nullable: true, description: "Auto-created invoice for this request — pay via POST /payments/intent { invoiceId }" }
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
 *         canPay: { type: boolean, description: True while SENT/PENDING, amount > 0 and the invoice exists }
 */

/**
 * @swagger
 * /jobs/{id}/payment-requests:
 *   get:
 *     summary: Retrieve installment payment details and payment progress for a customer's job
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Customer Multiple Payment Flow – Installment Payments screen.**
 *       - `breakdown[]` — Job billing breakdown items (`Quote Price`, `Site Visit Fee`, `Platform Fee`, `Offer Discount`). Total is handled via top-level `totalJobAmount`.
 *       - `paymentProgress[]` — Progress timeline items:
 *         - Completed items (`isCompleted: true`, `description: Confirmed on...`).
 *         - Pending installment (`isCompleted: false`, `formattedAmount`, `dueDate`).
 *       - `transactionHistory[]` — Transaction history records for the job (full list for Installment Payments History screen; top 3 previewed on the Installments section).
 *       - `invoiceId` — Invoice ID to pass to `POST /payments/intent` when tapping "Pay Now".
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
 *               message: Installment payment details retrieved successfully.
 *               data:
 *                 jobId: e324db43-e115-42d4-bb30-88cbeed82e34
 *                 title: TEst Cat
 *                 invoiceId: inv_123456
 *                 jobCategory: Solar Install
 *                 totalJobAmount: 931.5
 *                 amountPaid: 511.5
 *                 dueBalance: 420
 *                 currencyCode: EUR
 *                 currencySymbol: €
 *                 breakdown:
 *                   - title: Quote Price
 *                     amount: "€ 1000"
 *                   - title: Site Visit Fee
 *                     amount: "€ 0"
 *                   - title: Platform Fee
 *                     amount: "€ 20"
 *                   - title: Offer Discount
 *                     amount: "-€ 48.5"
 *                     label: Offer Applied (5% OFF)
 *                 paymentProgress:
 *                   - title: Site Visit Fee
 *                     description: Confirmed on July 15, 2026
 *                     isCompleted: true
 *                     formattedAmount: null
 *                     dueDate: null
 *                   - title: Advance Payment Pending
 *                     description: Advance payment is pending.
 *                     isCompleted: false
 *                     formattedAmount: €100.00
 *                     dueDate: '2026-10-21T07:21:24.845Z'
 *                 transactionHistory:
 *                   - id: TXN-827361
 *                     title: Initial Deposit
 *                     date: '2026-07-14T11:20:00.000Z'
 *                     formattedAmount: €481.50
 *                     status: PAID
 *                   - id: TXN-627341
 *                     title: Site Visit Fee
 *                     date: '2026-07-15T10:00:00.000Z'
 *                     formattedAmount: €30.00
 *                     status: PAID
 *                   - id: TXN-719384
 *                     title: Advance Payment
 *                     date: '2026-10-21T07:21:24.845Z'
 *                     formattedAmount: €100.00
 *                     status: PAID
 *                   - id: TXN-492015
 *                     title: Final Installment
 *                     date: '2026-07-28T09:00:00.000Z'
 *                     formattedAmount: €420.00
 *                     status: PENDING
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
 * /jobs/{id}/payment-requests/history:
 *   get:
 *     summary: Get paginated installment payment history for a customer's job
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Customer Multiple Payment Flow – Installment Payments History screen.**
 *       Dedicated paginated endpoint returning all transaction records with standard metadata (`meta: { total, page, limit, totalPages }`).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Items per page (max 50)
 *     responses:
 *       200:
 *         description: Installment payment history retrieved successfully.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Installment payment history retrieved successfully.
 *               data:
 *                 - id: TXN-827361
 *                   title: Initial Deposit
 *                   date: '2026-07-14T11:20:00.000Z'
 *                   formattedAmount: €481.50
 *                   status: PAID
 *                 - id: TXN-627341
 *                   title: Site Visit Fee
 *                   date: '2026-07-15T10:00:00.000Z'
 *                   formattedAmount: €30.00
 *                   status: PAID
 *                 - id: TXN-719384
 *                   title: Advance Payment
 *                   date: '2026-10-21T07:21:24.845Z'
 *                   formattedAmount: €100.00
 *                   status: PAID
 *                 - id: TXN-492015
 *                   title: Final Installment
 *                   date: '2026-07-28T09:00:00.000Z'
 *                   formattedAmount: €420.00
 *                   status: PENDING
 *               meta:
 *                 total: 4
 *                 page: 1
 *                 limit: 10
 *                 totalPages: 1
 *       404:
 *         description: Job not found for this customer.
 */
router.get(
  '/jobs/:id/payment-requests/history',
  ...customerOnly,
  validate(paymentHistoryQuerySchema),
  controller.getJobPaymentHistory
);

export default router;
