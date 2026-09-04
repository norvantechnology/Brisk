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
  failPaymentSchema,
  invoiceIdParamSchema,
  paymentIdParamSchema,
} from './checkout.validation';

const router = Router();
const customerOnly = [authMiddleware, roleMiddleware(['CUSTOMER'] as const)];

/**
 * @swagger
 * /invoices/{id}:
 *   get:
 *     summary: Get invoice — Site Visit & Pay Fee / Payment Details
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screens:**
 *       - Site Visit & Pay Fee (`data.purpose=SITE_VISIT_FEE`, `screenTitle`)
 *       - Payment Details (SERVICE invoices)
 *
 *       **Auth:** Customer Bearer; must own the booking.
 *
 *       **When:** After `POST /jobs/{id}/publish` using `data.invoice.id`, or reload before pay.
 *
 *       **Key fields (dynamic amounts; UI copy owned by mobile):**
 *       - `purpose` — SITE_VISIT_FEE vs SERVICE
 *       - `totalAmount` / `siteVisitFee` / `totalFormatted`
 *       - `trader` — name, verified, rating, reviewsCount, photo
 *       - `serviceSummary` — category/subcategory/title/scheduledDate/timeSlot from job
 *       - `billingTypes` / `paymentMethods`
 *       - `lineItems` — keys + amounts (`label` empty for app mapping)
 *
 *       Job offer discount is **not** deducted from site-visit fee (unless FREE_SERVICE).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: |
 *           Invoice UUID from publish response `data.invoice.id` or job `invoiceId` / `nextSteps.invoiceId`.
 *     responses:
 *       200:
 *         description: Full invoice / Pay Fee payload in `data`.
 *       403:
 *         description: Invoice belongs to another customer.
 *       404:
 *         description: Invoice not found.
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
 *     description: |
 *       **Mobile screen:** Promo code field on Payment Details.
 *
 *       Recalculates `promoDiscount`, `platformFee`, and `totalAmount`.
 *       Only works while invoice status is UNPAID.
 *
 *       Promo must be active and within validity window. Optional `categoryScope` must match job category.
 *
 *       List/validate codes also via Customer Offers promo endpoints when available.
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
 *             $ref: '#/components/schemas/ApplyPromoRequest'
 *           example:
 *             code: SAVE10
 *     responses:
 *       200:
 *         description: Updated invoice including promoCode echo and refreshed lineItems.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/Invoice' }
 *       400:
 *         description: Invalid/expired promo, wrong category, or invoice not UNPAID.
 *       403:
 *         description: Not the invoice owner.
 *       404:
 *         description: Invoice not found.
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
 *     summary: Create payment intent (Site Visit & Pay Fee / Payment Details)
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile:** After Publish, on Site Visit & Pay Fee or Payment Details.
 *       User picks Apple Pay / Google Pay / Card, fills billing, taps Confirm & Pay.
 *
 *       Creates PENDING payment. Mock Stripe returns `clientSecret` + `paymentId`.
 *       Then call `POST /payments/{paymentId}/confirm` (Success) or `/fail` (Fail).
 *
 *       **billingType=COMPANY** requires `companyName` (TIN optional). Matches Company Billing form.
 *
 *       **Body params:**
 *       - `invoiceId` (uuid, required) — from publish `data.invoice.id`
 *       - `method` — CARD | APPLE_PAY | GOOGLE_PAY
 *       - `billingType` — INDIVIDUAL | COMPANY
 *       - `companyName` / `tinNumber` — when COMPANY
 *       - `billingAddress` — optional object (addressLine, city, postalCode, country)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePaymentIntentRequest'
 *           examples:
 *             card:
 *               summary: Card / individual
 *               value:
 *                 invoiceId: 11111111-1111-1111-1111-111111111111
 *                 method: CARD
 *                 billingType: INDIVIDUAL
 *                 billingAddress:
 *                   firstName: Alex
 *                   lastName: Byrne
 *                   street: 1 Main Street
 *                   city: Dublin
 *                   country: IE
 *                   postcode: D04ABCD
 *             company:
 *               summary: Company billing
 *               value:
 *                 invoiceId: 11111111-1111-1111-1111-111111111111
 *                 method: APPLE_PAY
 *                 billingType: COMPANY
 *                 companyName: Acme Ltd
 *                 tinNumber: "1234567A"
 *     responses:
 *       201:
 *         description: Payment intent created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/PaymentIntentResponse' }
 *       400:
 *         description: Invoice already paid/refunded, or completed payment exists.
 *       403:
 *         description: Not the invoice owner.
 *       404:
 *         description: Invoice not found.
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
 *     summary: Confirm payment → Payment Successful (+ mark offer USED)
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Payment Successful!
 *
 *       Marks payment COMPLETED and invoice PAID.
 *       **Also marks linked offer claim USED** (final lock after site-visit / service pay).
 *
 *       Returns receipt: `title`, `message` (site-visit copy when purpose=SITE_VISIT_FEE),
 *       `receiptSummary` (transactionId, date, amountPaid), timeline Paid→Confirmed→Service,
 *       `actions.viewJob` → GET /jobs/{jobId}.
 *
 *       Idempotent if already COMPLETED.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: |
 *           `paymentId` from POST /payments/intent (`data.paymentId`). Not the invoice id.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConfirmPaymentRequest'
 *           example:
 *             cardLast4: "4567"
 *             cardBrand: visa
 *     responses:
 *       200:
 *         description: Payment confirmed; receipt payload for success screen.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/PaymentReceipt' }
 *       400:
 *         description: Payment FAILED, or invoice already paid (conflict path).
 *       404:
 *         description: Payment not found for this user.
 */
router.post(
  '/payments/:id/confirm',
  ...customerOnly,
  validate(confirmPaymentSchema),
  controller.confirmPayment
);

/**
 * @swagger
 * /payments/{id}/fail:
 *   post:
 *     summary: Mark payment failed (Payment Failed screen)
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Payment Failed after wallet/card decline or user cancel.
 *
 *       Marks payment FAILED (invoice stays UNPAID). Response includes title, message,
 *       empty timeline, and retryPayment action (create a new intent).
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
 *               reason: { type: string, example: Card declined }
 *     responses:
 *       200:
 *         description: Failure payload for fail screen.
 *       400:
 *         description: Payment already completed.
 *       404:
 *         description: Payment not found.
 */
router.post(
  '/payments/:id/fail',
  ...customerOnly,
  validate(failPaymentSchema),
  controller.failPayment
);

/**
 * @swagger
 * /payments/{id}/receipt:
 *   get:
 *     summary: Get payment receipt (Payment Successful screen)
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Available only after payment status is COMPLETED.
 *
 *       **UI fields:** `title`, `transactionId`, `amountPaidFormatted`, `timeline`, `receiptSummary`,
 *       `actions.viewJob` → GET /bookings/{id}.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Payment UUID.
 *     responses:
 *       200:
 *         description: Receipt summary.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/PaymentReceipt' }
 *       400:
 *         description: Payment not completed yet.
 *       404:
 *         description: Payment not found.
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
 *     summary: Get booking (View Job after payment)
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** View Job from payment success actions.
 *
 *       Includes nested job (with `offerApplied`), trader `displayName`, invoice lineItems, and latest payment.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Booking UUID from publish `data.booking.id` or receipt `actions.viewJob`.
 *     responses:
 *       200:
 *         description: Booking detail.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/BookingDetail' }
 *       404:
 *         description: Booking not found for this customer.
 */
router.get(
  '/bookings/:id',
  ...customerOnly,
  validate(bookingIdParamSchema),
  controller.getBooking
);

export default router;
