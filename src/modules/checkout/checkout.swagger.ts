/**
 * @swagger
 * components:
 *   schemas:
 *     InvoiceStatus:
 *       type: string
 *       enum: [UNPAID, PAID, REFUNDED]
 *     PaymentStatus:
 *       type: string
 *       enum: [PENDING, COMPLETED, FAILED]
 *     PaymentMethod:
 *       type: string
 *       enum: [CARD, APPLE_PAY, GOOGLE_PAY]
 *     BillingType:
 *       type: string
 *       enum: [INDIVIDUAL, COMPANY]
 *     InvoiceLineItem:
 *       type: object
 *       properties:
 *         key:
 *           type: string
 *           enum: [serviceCharge, siteVisitFee, platformFee, traderOfferDiscount, promoDiscount, tax]
 *         label:
 *           type: string
 *           description: |
 *             Exact UI label — Site Visit Fee, Service Charge, Platform Fee, Trader Offer / Free Visit, Promo Code, Tax
 *           example: Site Visit Fee
 *         amount:
 *           type: number
 *           description: Positive for charges/fees; negative for discounts
 *           example: 125
 *         type:
 *           type: string
 *           enum: [charge, discount, fee]
 *     InvoiceServiceSummary:
 *       type: object
 *       description: Service summary card on Payment Details screen
 *       properties:
 *         categoryName: { type: string, nullable: true }
 *         subcategoryName: { type: string, nullable: true }
 *         title: { type: string }
 *         orderId: { type: string, example: INV-2026-9C7E }
 *         serviceProvider: { type: string, nullable: true, example: Live Verify Trader }
 *     PaymentMethodOption:
 *       type: object
 *       properties:
 *         key: { type: string, enum: [APPLE_PAY, GOOGLE_PAY, CARD] }
 *         label: { type: string, example: Apple Pay }
 *         enabled: { type: boolean }
 *     Invoice:
 *       type: object
 *       description: |
 *         Payment Details / Site Visit & Pay Fee payload from GET /invoices/{id}
 *         or publish `data.invoice`.
 *       properties:
 *         id: { type: string, format: uuid }
 *         invoiceNumber: { type: string, example: INV-2026-9C7E }
 *         orderId:
 *           type: string
 *           description: UI Order ID / Job ref display (invoiceNumber or bookingRef)
 *           example: INV-2026-9C7E
 *         status: { $ref: '#/components/schemas/InvoiceStatus' }
 *         purpose:
 *           type: string
 *           enum: [SERVICE, SITE_VISIT_FEE]
 *           description: SITE_VISIT_FEE → Site Visit & Pay Fee screen; SERVICE → Payment Details
 *         screenTitle:
 *           type: string
 *           description: Empty — mobile owns screen title; use purpose
 *         bookingId: { type: string, format: uuid }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         serviceCharge: { type: number, description: Base amount (site visit fee stored here for SITE_VISIT_FEE) }
 *         siteVisitFee: { type: number, description: Alias when purpose=SITE_VISIT_FEE; else 0 }
 *         traderOfferDiscount: { type: number, example: 0 }
 *         promoDiscount: { type: number, example: 0 }
 *         platformFee:
 *           type: number
 *           example: 0
 *           description: 10% of post-discount for SERVICE; 0 for SITE_VISIT_FEE
 *         tax: { type: number, example: 0 }
 *         totalAmount: { type: number, description: Total Amount Due Now }
 *         currencyCode: { type: string }
 *         currencySymbol: { type: string }
 *         totalFormatted: { type: string, description: Dynamic amount formatting only }
 *         payNowLabel:
 *           type: string
 *           description: Empty — mobile owns CTA; use totalAmount / totalFormatted
 *         confirmPayLabel: { type: string, description: Empty — mobile owns CTA }
 *         feeNote:
 *           type: string
 *           description: Empty — mobile owns info-box copy
 *         lineItems:
 *           type: array
 *           items: { $ref: '#/components/schemas/InvoiceLineItem' }
 *         serviceSummary: { $ref: '#/components/schemas/InvoiceServiceSummary' }
 *         booking:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             bookingRef: { type: string }
 *             status: { type: string }
 *             scheduledDate: { type: string, format: date-time }
 *         job:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             jobRef: { type: string }
 *             title: { type: string }
 *             description: { type: string }
 *             status: { type: string }
 *             scheduledDate: { type: string, format: date-time, nullable: true }
 *             timeSlot: { type: string, nullable: true }
 *             durationLabel: { type: string, nullable: true }
 *             addressLine: { type: string, nullable: true }
 *             city: { type: string, nullable: true }
 *             postcode: { type: string, nullable: true }
 *             category: { type: object }
 *             subcategory: { type: object, nullable: true }
 *             offer: { type: object, nullable: true }
 *             offerApplied: { type: boolean }
 *             coverPhotoUrl: { type: string, format: uri, nullable: true }
 *         trader:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             businessName: { type: string, nullable: true }
 *             fullName: { type: string, nullable: true }
 *             displayName: { type: string, nullable: true }
 *         paymentMethods:
 *           type: array
 *           items: { $ref: '#/components/schemas/PaymentMethodOption' }
 *         paymentStatus: { type: string, nullable: true }
 *         latestPaymentId: { type: string, format: uuid, nullable: true }
 *         promoCode:
 *           type: string
 *           description: Present only on apply-promo response
 *     ApplyPromoRequest:
 *       type: object
 *       required: [code]
 *       properties:
 *         code:
 *           type: string
 *           example: SAVE10
 *           description: Promo code (case-insensitive). Validated for active window and optional categoryScope.
 *     BillingAddress:
 *       type: object
 *       required: [firstName, lastName, street, city, country, postcode]
 *       properties:
 *         firstName: { type: string }
 *         lastName: { type: string }
 *         street: { type: string }
 *         city: { type: string }
 *         country: { type: string, example: IE }
 *         postcode: { type: string, example: D04ABCD }
 *     CreatePaymentIntentRequest:
 *       type: object
 *       required: [invoiceId, method]
 *       description: Body for Confirm & Pay on Site Visit & Pay Fee / Payment Details.
 *       properties:
 *         invoiceId:
 *           type: string
 *           format: uuid
 *           description: |
 *             **Required.** From publish `data.invoice.id` or GET /invoices/{id}.
 *             Must be UNPAID and owned by the customer.
 *         method:
 *           allOf:
 *             - $ref: '#/components/schemas/PaymentMethod'
 *           description: |
 *             Payment method button selected:
 *             CARD (Stripe form), APPLE_PAY, or GOOGLE_PAY.
 *         billingType:
 *           allOf:
 *             - $ref: '#/components/schemas/BillingType'
 *           default: INDIVIDUAL
 *           description: |
 *             Radio on Pay Fee screen:
 *             INDIVIDUAL = Individual/Personal Billing;
 *             COMPANY = Company Billing (show company fields).
 *         companyName:
 *           type: string
 *           description: Required when billingType=COMPANY (Company Name field).
 *         tinNumber:
 *           type: string
 *           description: Optional TIN / VAT when Company Billing (e.g. DE 123 456 789).
 *         billingAddress:
 *           allOf:
 *             - $ref: '#/components/schemas/BillingAddress'
 *           description: Optional company/personal address lines on Pay Fee form.
 *     PaymentIntentResponse:
 *       type: object
 *       properties:
 *         paymentId:
 *           type: string
 *           format: uuid
 *           description: Pass this id to POST /payments/{id}/confirm or /fail.
 *         transactionId: { type: string, example: TXN-DBBA9C9F }
 *         transactionRef: { type: string, example: TXN-DBBA9C9F }
 *         clientSecret: { type: string, example: mock_secret_..., description: Stripe client secret (mock until live keys) }
 *         publishableKey: { type: string, nullable: true }
 *         amount: { type: number, example: 30, description: Amount due now (site visit fee or service total) }
 *         amountFormatted: { type: string, example: "€30.00" }
 *         currencyCode: { type: string, example: EUR }
 *         currencySymbol: { type: string, example: "€" }
 *         method: { $ref: '#/components/schemas/PaymentMethod' }
 *         status: { $ref: '#/components/schemas/PaymentStatus' }
 *         mock:
 *           type: boolean
 *           example: true
 *           description: True until real Stripe is wired. Client can skip Stripe SDK and call confirm directly.
 *         billingAddress: { type: object, nullable: true }
 *         invoiceId: { type: string, format: uuid }
 *         orderId: { type: string }
 *         payNowLabel: { type: string, description: Empty — mobile owns CTA; use amount / amountFormatted }
 *     ConfirmPaymentRequest:
 *       type: object
 *       description: Optional card metadata after Stripe success (for receipt display).
 *       properties:
 *         cardLast4: { type: string, minLength: 4, maxLength: 4, example: "4567", description: Last 4 digits if CARD method }
 *         cardBrand: { type: string, example: visa, description: Card brand for receipt }
 *     ReceiptTimelineStep:
 *       type: object
 *       properties:
 *         key: { type: string, enum: [PAID, CONFIRMED, SERVICE] }
 *         label: { type: string, example: Paid }
 *         completed: { type: boolean }
 *         at: { type: string, format: date-time, nullable: true }
 *     PaymentReceipt:
 *       type: object
 *       description: Payment confirm/receipt payload — amounts + purpose; UI copy owned by mobile
 *       properties:
 *         paymentId: { type: string, format: uuid }
 *         transactionId: { type: string, description: Shown as Transaction ID on receipt }
 *         transactionRef: { type: string }
 *         status: { $ref: '#/components/schemas/PaymentStatus' }
 *         method: { $ref: '#/components/schemas/PaymentMethod' }
 *         amount: { type: number }
 *         amountPaid: { type: number }
 *         amountPaidFormatted: { type: string }
 *         currencyCode: { type: string }
 *         currencySymbol: { type: string }
 *         paidAt: { type: string, format: date-time, nullable: true }
 *         cardLast4: { type: string, nullable: true }
 *         cardBrand: { type: string, nullable: true }
 *         billingType: { $ref: '#/components/schemas/BillingType' }
 *         companyName: { type: string, nullable: true }
 *         purpose: { type: string, enum: [SERVICE, SITE_VISIT_FEE], description: Mobile picks success copy from purpose }
 *         title: { type: string, description: Empty — mobile owns }
 *         message: { type: string, description: Empty — mobile owns }
 *         timeline:
 *           type: array
 *           description: Keys PAID / CONFIRMED / SERVICE; labels empty
 *           items: { $ref: '#/components/schemas/ReceiptTimelineStep' }
 *         receiptSummary:
 *           type: object
 *           properties:
 *             transactionId: { type: string }
 *             date: { type: string, format: date-time, nullable: true }
 *             amountPaid: { type: number }
 *             amountPaidFormatted: { type: string }
 *         actions:
 *           type: object
 *           properties:
 *             viewJob:
 *               type: object
 *               nullable: true
 *               properties:
 *                 method: { type: string, example: GET }
 *                 path: { type: string, example: "/bookings/{id}" }
 *             backToHome:
 *               type: object
 *               properties:
 *                 path: { type: string, example: / }
 *         invoice: { type: object }
 *         booking: { type: object }
 *         job: { type: object }
 *         trader: { type: object, nullable: true }
 *         customer: { type: object }
 *     BookingDetail:
 *       type: object
 *       description: View Job screen after payment
 *       properties:
 *         id: { type: string, format: uuid }
 *         bookingRef: { type: string }
 *         status: { type: string, enum: [SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, RESCHEDULED] }
 *         scheduledDate: { type: string, format: date-time }
 *         createdAt: { type: string, format: date-time }
 *         job:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             jobRef: { type: string }
 *             title: { type: string }
 *             description: { type: string }
 *             status: { type: string }
 *             scheduledDate: { type: string, format: date-time, nullable: true }
 *             timeSlot: { type: string, nullable: true }
 *             durationLabel: { type: string, nullable: true }
 *             phoneNumber: { type: string, nullable: true }
 *             addressLine: { type: string, nullable: true }
 *             city: { type: string, nullable: true }
 *             postcode: { type: string, nullable: true }
 *             latitude: { type: number, nullable: true }
 *             longitude: { type: number, nullable: true }
 *             serviceCharge: { type: number, nullable: true }
 *             category: { type: object }
 *             subcategory: { type: object, nullable: true }
 *             offerApplied: { type: boolean }
 *             offer: { type: object, nullable: true }
 *             photos: { type: array, items: { type: object } }
 *             coverPhotoUrl: { type: string, nullable: true }
 *             address: { type: object, nullable: true }
 *         trader:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             businessName: { type: string, nullable: true }
 *             profilePhotoUrl: { type: string, nullable: true }
 *             fullName: { type: string, nullable: true }
 *             displayName: { type: string, nullable: true }
 *         invoice:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             invoiceNumber: { type: string }
 *             orderId: { type: string }
 *             status: { type: string }
 *             serviceCharge: { type: number }
 *             traderOfferDiscount: { type: number }
 *             promoDiscount: { type: number }
 *             platformFee: { type: number }
 *             tax: { type: number }
 *             totalAmount: { type: number }
 *             currencyCode: { type: string }
 *             lineItems:
 *               type: array
 *               items: { $ref: '#/components/schemas/InvoiceLineItem' }
 *             totalFormatted: { type: string }
 *         payment:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             transactionId: { type: string, nullable: true }
 *             transactionRef: { type: string, nullable: true }
 *             status: { type: string }
 *             method: { type: string }
 *             amount: { type: number }
 *             amountPaid: { type: number }
 *             paidAt: { type: string, format: date-time, nullable: true }
 */
