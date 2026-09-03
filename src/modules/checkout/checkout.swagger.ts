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
 *           enum: [serviceCharge, platformFee, traderOfferDiscount, promoDiscount, tax]
 *         label:
 *           type: string
 *           description: Exact UI label — Service Charge, Platform Fee, Trader Offer, Promo Code, Tax
 *           example: Service Charge
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
 *       description: Payment Details screen payload
 *       properties:
 *         id: { type: string, format: uuid }
 *         invoiceNumber: { type: string, example: INV-2026-9C7E }
 *         orderId:
 *           type: string
 *           description: UI Order ID (invoiceNumber or bookingRef)
 *           example: INV-2026-9C7E
 *         status: { $ref: '#/components/schemas/InvoiceStatus' }
 *         bookingId: { type: string, format: uuid }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         serviceCharge: { type: number, example: 125 }
 *         traderOfferDiscount: { type: number, example: 6.25 }
 *         promoDiscount: { type: number, example: 0 }
 *         platformFee:
 *           type: number
 *           example: 11.88
 *           description: 10% of (serviceCharge - traderOfferDiscount)
 *         tax: { type: number, example: 0 }
 *         totalAmount: { type: number, example: 130.63 }
 *         currencyCode: { type: string, example: EUR }
 *         currencySymbol: { type: string, example: "€" }
 *         totalFormatted: { type: string, example: "€130.63" }
 *         payNowLabel:
 *           type: string
 *           example: "Pay Now (€130.63)"
 *           description: Primary CTA label on Payment Details
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
 *       properties:
 *         invoiceId:
 *           type: string
 *           format: uuid
 *           description: "From publish response data.invoice.id or GET /invoices/{id}"
 *         method:
 *           $ref: '#/components/schemas/PaymentMethod'
 *         billingType:
 *           allOf:
 *             - $ref: '#/components/schemas/BillingType'
 *           default: INDIVIDUAL
 *         companyName:
 *           type: string
 *           description: Required when billingType is COMPANY
 *         tinNumber: { type: string }
 *         billingAddress: { $ref: '#/components/schemas/BillingAddress' }
 *     PaymentIntentResponse:
 *       type: object
 *       properties:
 *         paymentId: { type: string, format: uuid }
 *         transactionId: { type: string, example: TXN-DBBA9C9F }
 *         transactionRef: { type: string, example: TXN-DBBA9C9F }
 *         clientSecret: { type: string, example: mock_secret_... }
 *         publishableKey: { type: string, nullable: true }
 *         amount: { type: number, example: 130.63 }
 *         amountFormatted: { type: string, example: "€130.63" }
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
 *         payNowLabel: { type: string, example: "Pay Now (€130.63)" }
 *     ConfirmPaymentRequest:
 *       type: object
 *       properties:
 *         cardLast4: { type: string, minLength: 4, maxLength: 4, example: "4567" }
 *         cardBrand: { type: string, example: visa }
 *     ReceiptTimelineStep:
 *       type: object
 *       properties:
 *         key: { type: string, enum: [PAID, CONFIRMED, SERVICE] }
 *         label: { type: string, example: Paid }
 *         completed: { type: boolean }
 *         at: { type: string, format: date-time, nullable: true }
 *     PaymentReceipt:
 *       type: object
 *       description: Payment Successful screen
 *       properties:
 *         paymentId: { type: string, format: uuid }
 *         transactionId: { type: string, example: TXN-DBBA9C9F }
 *         transactionRef: { type: string }
 *         status: { $ref: '#/components/schemas/PaymentStatus' }
 *         method: { $ref: '#/components/schemas/PaymentMethod' }
 *         amount: { type: number }
 *         amountPaid: { type: number }
 *         amountPaidFormatted: { type: string, example: "€130.63" }
 *         currencyCode: { type: string }
 *         currencySymbol: { type: string }
 *         paidAt: { type: string, format: date-time, nullable: true }
 *         cardLast4: { type: string, nullable: true }
 *         cardBrand: { type: string, nullable: true }
 *         billingType: { $ref: '#/components/schemas/BillingType' }
 *         companyName: { type: string, nullable: true }
 *         title: { type: string, example: "Payment Successful!" }
 *         timeline:
 *           type: array
 *           description: Status tracker Paid then Confirmed then Service
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
