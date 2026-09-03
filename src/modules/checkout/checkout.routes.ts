import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './checkout.controller';
import {
  applyPromoSchema,
  bookingIdParamSchema,
  confirmPaymentSchema,
  createPaymentIntentSchema,
  invoiceIdParamSchema,
  paymentIdParamSchema,
} from './checkout.validation';

const router = Router();
const customerOnly = [authMiddleware, roleMiddleware(['CUSTOMER'] as const)];

/**
 * @swagger
 * /invoices/{id}:
 *   get:
 *     summary: Get invoice with booking/job summary and line items
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
 *         description: Invoice breakdown for payment UI.
 */
router.get(
  '/invoices/:id',
  ...customerOnly,
  validate(invoiceIdParamSchema),
  controller.getInvoice
);

/**
 * @swagger
 * /invoices/{id}/apply-promo:
 *   post:
 *     summary: Apply a promo code to an unpaid invoice
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: SAVE10 }
 *     responses:
 *       200:
 *         description: Updated invoice with promo discount.
 */
router.post(
  '/invoices/:id/apply-promo',
  ...customerOnly,
  validate(applyPromoSchema),
  controller.applyPromo
);

/**
 * @swagger
 * /payments/intent:
 *   post:
 *     summary: Create a mock payment intent for an invoice
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [invoiceId, method]
 *             properties:
 *               invoiceId: { type: string, format: uuid }
 *               method: { type: string, enum: [CARD, APPLE_PAY, GOOGLE_PAY] }
 *               billingType: { type: string, enum: [INDIVIDUAL, COMPANY] }
 *               companyName: { type: string }
 *               tinNumber: { type: string }
 *               billingAddress:
 *                 type: object
 *                 properties:
 *                   firstName: { type: string }
 *                   lastName: { type: string }
 *                   street: { type: string }
 *                   city: { type: string }
 *                   country: { type: string }
 *                   postcode: { type: string }
 *     responses:
 *       201:
 *         description: Mock payment intent (mock true).
 */
router.post(
  '/payments/intent',
  ...customerOnly,
  validate(createPaymentIntentSchema),
  controller.createPaymentIntent
);

/**
 * @swagger
 * /payments/{id}/confirm:
 *   post:
 *     summary: Confirm a pending payment (mock Stripe)
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cardLast4: { type: string, example: "4242" }
 *               cardBrand: { type: string, example: Visa }
 *     responses:
 *       200:
 *         description: Receipt payload for success screen.
 */
router.post(
  '/payments/:id/confirm',
  ...customerOnly,
  validate(confirmPaymentSchema),
  controller.confirmPayment
);

/**
 * @swagger
 * /payments/{id}/receipt:
 *   get:
 *     summary: Get payment receipt
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
 *         description: Receipt summary.
 */
router.get(
  '/payments/:id/receipt',
  ...customerOnly,
  validate(paymentIdParamSchema),
  controller.getPaymentReceipt
);

/**
 * @swagger
 * /bookings/{id}:
 *   get:
 *     summary: Get booking with job, invoice, and payment status (View Job)
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
 *         description: Booking detail for View Job screen.
 */
router.get(
  '/bookings/:id',
  ...customerOnly,
  validate(bookingIdParamSchema),
  controller.getBooking
);

export default router;
