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
  paymentHistoryQuerySchema,
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
 *       - Site Visit & Pay Fee (`data.purpose=SITE_VISIT_FEE`)
 *       - Payment Details (SERVICE invoices)
 *
 *       **Auth:** Customer Bearer; must own the booking.
 *
 *       **When:** After `POST /jobs/{id}/publish` using `data.invoice.id`, or reload before pay.
 *
 *       **Key fields (numeric amounts; UI copy owned by mobile):**
 *       - `purpose` — SITE_VISIT_FEE vs SERVICE
 *       - `totalAmount` / `siteVisitFee`
 *       - Trader payment-request invoices (auto-created when the trader sends a final payment / installment / site visit fee
 *         request): `materialsTotal`, `siteVisitFee`, `vatRate` and `tax` (VAT) come from that request, `booking` may be null
 *         (site visit fee before booking) and promo codes are not allowed
 *       - `trader` — name, verified, rating, reviewsCount, photo
 *       - `serviceSummary` — category/subcategory/title/scheduledDate/timeSlot from job
 *       - `billingTypes` / `paymentMethods` — keys only
 *       - `briskOffers` / `promoCodes` — Brisk Offers bottom sheet (title + couponCode)
 *       - `lineItems` — keys + amounts
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
 *       **One promo at a time** (no stacking).
 *       - Same code already applied → `200` with `alreadyApplied: true` (idempotent, totals unchanged aside from heal).
 *       - Different code → replaces previous promo.
 *       Going back to update location / republish while unpaid **clears** the promo so Payment Details starts clean.
 *
 *       Promo must be active and within validity window. Optional `categoryScope` must match job category.
 *
 *       List/validate codes also via Customer Offers promo endpoints when available.
 *
 *       After success, call GET /invoices/{id} for full invoice totals / lineItems.
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
 *         description: Promo apply result only (no full invoice payload).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/ApplyPromoResult' }
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
 *       Creates a PENDING payment + Stripe PaymentIntent. Present Stripe PaymentSheet with
 *       `clientSecret`, `customerId`, `ephemeralKey`, `publishableKey`
 *       (Apple Pay: `stripeMerchantIdentifier`). Then call `POST /payments/{paymentId}/confirm`
 *       on success or `/fail` on error/cancel. Calling intent again cancels the previous attempt.
 *
 *       `requiresPayment=false` (total 0): skip PaymentSheet, call confirm directly.
 *       503 `PAYMENTS_NOT_CONFIGURED` when Stripe keys are missing on the server.
 *
 *       **billingType=COMPANY** requires `companyName` (TIN optional). Matches Company Billing form.
 *
 *       **Body params:**
 *       - `invoiceId` (uuid, **required**) — from publish `data.invoice.id`
 *       - `method` — optional, default `CARD` (`APPLE_PAY` | `GOOGLE_PAY` | `CARD`)
 *       - `billingType` — optional, default `INDIVIDUAL` (`COMPANY` needs `companyName`)
 *       - `companyName` / `tinNumber` — only when COMPANY (checkout billing screen)
 *       - `billingAddress` — **optional**; not needed on Payment Details Pay Now
 *
 *       **Payment Details Pay Now minimum body:**
 *       `{ "invoiceId": "<uuid>" }`
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePaymentIntentRequest'
 *           examples:
 *             payNowMinimum:
 *               summary: Payment Details — Pay Now (minimum)
 *               value:
 *                 invoiceId: 11111111-1111-1111-1111-111111111111
 *             card:
 *               summary: Card + optional billing (checkout screen)
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
 *       Idempotent if already COMPLETED. No body — the server verifies the PaymentIntent with
 *       Stripe and reads card brand / last4 / wallet from the charge.
 *
 *       The Stripe webhook finalizes the same way, so the job still goes live if the app
 *       closes before calling confirm.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: |
 *           `paymentId` from POST /payments/intent (`data.paymentId`). Not the invoice id.
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
 *         description: |
 *           `PAYMENT_NOT_COMPLETED` (Stripe intent not succeeded), `PAYMENT_AMOUNT_MISMATCH`,
 *           `PAYMENT_INTENT_MISSING`, or invoice already paid.
 *       404:
 *         description: Payment not found for this user.
 *       409:
 *         description: "`PAYMENT_PROCESSING` — bank still processing; retry confirm shortly."
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
 *     tags: ['Customer / My Job', 'Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Available only after payment status is COMPLETED.
 *
 *       **Fields:** `transactionId`, `amount` / `amountPaid`, `purpose`, `timeline` (keys),
 *       `receiptSummary`, `actions.viewJob` → GET /jobs/{id}. App owns success copy.
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
 * /payments/history:
 *   get:
 *     summary: Customer Transaction History
 *     tags: ['Customer / Checkout']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Profile → Transaction History.
 *
 *       Paid / refunded invoices of the logged-in customer: upfront job payments and every trader payment
 *       request (final payment, installment, site visit fee). Newest first by `date` (settled time).
 *
 *       **Row status:** `PAID`, `PROCESSING` (refund under review), `REFUNDED`.
 *
 *       **Search:** invoice number, trader business / full name, job title, job ref, service category.
 *
 *       **Receipt:** `receiptUrl` → GET /invoices/{id}/receipt/download (PDF, Bearer auth).
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [all, last_30_days, last_6_months, last_1_year, custom], default: all }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, example: '2026-01-01' }
 *         description: YYYY-MM-DD, required when filter=custom.
 *       - in: query
 *         name: endDate
 *         schema: { type: string, example: '2026-10-09' }
 *         description: YYYY-MM-DD, required when filter=custom.
 *     responses:
 *       200:
 *         description: Paginated transactions.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Transaction history retrieved successfully.
 *               data:
 *                 - id: 6bd0d86e-0000-0000-0000-000000000000
 *                   invoiceId: 6bd0d86e-0000-0000-0000-000000000000
 *                   invoiceNumber: INV-2026-0042
 *                   paymentId: 1f2e3d4c-0000-0000-0000-000000000000
 *                   transactionRef: TXN-9A1B2C3D
 *                   status: PAID
 *                   paymentType: PARTIAL
 *                   purpose: SERVICE
 *                   date: '2026-10-09T16:40:00.000Z'
 *                   totalAmount: 120
 *                   currencyCode: EUR
 *                   currencySymbol: €
 *                   method: CARD
 *                   cardBrand: visa
 *                   cardLast4: '4242'
 *                   serviceCategory: { id: 2b6c0000-0000-0000-0000-000000000000, name: Handyman }
 *                   serviceSubcategory: null
 *                   job: { id: 9c1d0000-0000-0000-0000-000000000000, jobRef: '#D4D2', title: Fix kitchen tap }
 *                   trader: { id: 7e8f0000-0000-0000-0000-000000000000, displayName: Marcus Thompson, profilePhotoUrl: null }
 *                   receiptUrl: https://api.brisk.ie/invoices/6bd0d86e-0000-0000-0000-000000000000/receipt/download
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 */
router.get(
  '/payments/history',
  ...customerOnly,
  validate(paymentHistoryQuerySchema),
  controller.listPaymentHistory
);

/**
 * @swagger
 * /invoices/{id}/receipt/download:
 *   get:
 *     summary: Download PDF receipt (Transaction History / Trader Payments)
 *     tags: ['Customer / Checkout', 'Trader / Payments']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Streams `application/pdf` for a PAID / REFUNDED invoice.
 *       Customer Bearer → own invoices; Trader Bearer → invoices of their jobs / payment requests.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: |
 *           Invoice UUID — `invoiceId` from GET /payments/history (customer) or GET /traders/payments/history (trader).
 *           Not the payment request id.
 *     responses:
 *       200:
 *         description: PDF file.
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       400:
 *         description: Invoice not paid yet.
 *       404:
 *         description: Invoice not found.
 */
router.get(
  '/invoices/:id/receipt/download',
  authMiddleware,
  roleMiddleware(['CUSTOMER', 'TRADER']),
  validate(invoiceIdParamSchema),
  controller.downloadInvoiceReceipt
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
