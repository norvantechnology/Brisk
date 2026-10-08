/**
 * @swagger
 * components:
 *   schemas:
 *     QaFormAnswerItem:
 *       type: object
 *       description: One answered question of the subcategory Q&A form (unanswered fields are omitted).
 *       properties:
 *         fieldId: { type: string, example: property_type }
 *         label: { type: string, example: Property type }
 *         type: { type: string, example: select, description: text | textarea | number | boolean | select | multiselect | radio | checkbox | date }
 *         value:
 *           description: Raw answer (string, number, boolean or array of option values)
 *           oneOf:
 *             - { type: string }
 *             - { type: number }
 *             - { type: boolean }
 *             - { type: array, items: { type: string } }
 *           example: apartment
 *         displayValue: { type: string, example: Apartment, description: 'Human-readable answer (option labels joined by comma)' }
 *     AdminJobDetail:
 *       type: object
 *       description: Admin job drawer payload (GET /admin/jobs/{id}). Nullable objects are null when not linked yet.
 *       properties:
 *         id: { type: string, format: uuid, example: 8a8fb0e5-a330-4c62-8e76-a358bd792b84 }
 *         jobRef: { type: string, nullable: true, example: JOB-1119 }
 *         title: { type: string, example: Kitchen sink leaking }
 *         description: { type: string, example: Water leaking under the kitchen sink since yesterday. }
 *         qaFormAnswerList:
 *           type: array
 *           items: { $ref: '#/components/schemas/QaFormAnswerItem' }
 *         customer:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid, example: 1f2e3d4c-0000-4000-8000-000000000001 }
 *             customerCode: { type: string, nullable: true, example: CUS-1001 }
 *             fullName: { type: string, example: John Murphy }
 *             email: { type: string, example: john@example.com }
 *             mobileNumber: { type: string, nullable: true, example: '+353871234567' }
 *             profilePhotoUrl: { type: string, nullable: true, example: 'https://api.brisk.ie/uploads/profile/john.jpg' }
 *         status:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, QUOTED, ACCEPTED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, PAYMENT_PENDING]
 *           example: PAYMENT_PENDING
 *         statusLabel: { type: string, example: Payment Pending, description: Display label for status }
 *         quoteType: { type: string, nullable: true, enum: [REMOTE, ONSITE, FIXED, BUDGET_RANGE, OPEN_QUOTE], example: ONSITE }
 *         siteVisitRequested: { type: boolean, example: true }
 *         siteVisitFee: { type: number, nullable: true, example: 30 }
 *         serviceCharge: { type: number, nullable: true, example: 1500 }
 *         minBudget: { type: number, nullable: true, example: 1000 }
 *         maxBudget: { type: number, nullable: true, example: 2000 }
 *         scheduledDate: { type: string, format: date-time, nullable: true, example: '2026-07-29T00:00:00.000Z' }
 *         timeSlot: { type: string, nullable: true, example: 'Morning (09:00 - 12:00)' }
 *         addressLine: { type: string, nullable: true, example: 14 Rathmines Road }
 *         city: { type: string, nullable: true, example: Dublin }
 *         postcode: { type: string, nullable: true, example: D06 XY12 }
 *         createdAt: { type: string, format: date-time, example: '2026-07-20T10:00:00.000Z' }
 *         updatedAt: { type: string, format: date-time, example: '2026-07-25T16:30:00.000Z' }
 *         cancellationReason: { type: string, nullable: true, example: null }
 *         cancelledAt: { type: string, format: date-time, nullable: true, example: null }
 *         archivedAt: { type: string, format: date-time, nullable: true, example: null }
 *         category:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid, example: 2a3b4c5d-0000-4000-8000-000000000010 }
 *             name: { type: string, example: Interior Design }
 *             categoryCode: { type: string, nullable: true, example: CAT-INTER }
 *             urlSlug: { type: string, example: interior-design }
 *             description: { type: string, nullable: true, example: Interior design and planning services }
 *             iconName: { type: string, nullable: true, example: interior }
 *             brandThemeColor: { type: string, nullable: true, example: '#1E88E5' }
 *             bannerImageUrl: { type: string, nullable: true, example: null }
 *             displayOrder: { type: integer, example: 1 }
 *             status: { type: string, example: active }
 *             featured: { type: boolean, example: true }
 *             createdAt: { type: string, format: date-time, example: '2026-01-10T09:00:00.000Z' }
 *             updatedAt: { type: string, format: date-time, example: '2026-06-01T09:00:00.000Z' }
 *         subcategory:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid, example: 3b4c5d6e-0000-4000-8000-000000000011 }
 *             categoryId: { type: string, format: uuid, example: 2a3b4c5d-0000-4000-8000-000000000010 }
 *             name: { type: string, example: Interior Planning }
 *             serviceType: { type: string, nullable: true, example: Service }
 *             code: { type: string, nullable: true, example: INTER-PLAN }
 *             urlSlug: { type: string, example: interior-planning }
 *             featured: { type: boolean, example: false }
 *             status: { type: string, example: active }
 *             siteVisitEnabled: { type: boolean, example: true }
 *             siteVisitFee: { type: number, nullable: true, example: null }
 *             priceEnabled: { type: boolean, example: true }
 *             priceEnteredBy: { type: string, nullable: true, example: CUSTOMER }
 *             qaFormSchema: { type: object, nullable: true, example: null, description: Raw Q&A form definition (answers are in qaFormAnswerList) }
 *             createdAt: { type: string, format: date-time, example: '2026-01-10T09:00:00.000Z' }
 *             updatedAt: { type: string, format: date-time, example: '2026-06-01T09:00:00.000Z' }
 *         address:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid, example: 4c5d6e7f-0000-4000-8000-000000000012 }
 *             userId: { type: string, format: uuid, example: 1f2e3d4c-0000-4000-8000-000000000001 }
 *             label: { type: string, nullable: true, example: Home }
 *             addressType: { type: string, nullable: true, example: Residential }
 *             houseNumber: { type: string, nullable: true, example: '14' }
 *             addressLine1: { type: string, example: Rathmines Road }
 *             addressLine2: { type: string, nullable: true, example: Rathmines }
 *             city: { type: string, example: Dublin }
 *             county: { type: string, nullable: true, example: Dublin }
 *             eircode: { type: string, nullable: true, example: D06 XY12 }
 *             country: { type: string, nullable: true, example: Ireland }
 *             mprnNumber: { type: string, nullable: true, example: '12345678901' }
 *             gprnNumber: { type: string, nullable: true, example: '12356787' }
 *             utnNumber: { type: string, nullable: true, example: '012345678' }
 *             latitude: { type: number, nullable: true, example: 53.3347 }
 *             longitude: { type: number, nullable: true, example: -6.2783 }
 *             mapImageUrl: { type: string, nullable: true, example: 'https://api.brisk.ie/uploads/maps/address.png' }
 *             isDefault: { type: boolean, example: true }
 *             createdAt: { type: string, format: date-time, example: '2026-07-01T09:00:00.000Z' }
 *             updatedAt: { type: string, format: date-time, example: '2026-07-01T09:00:00.000Z' }
 *         offer:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid, example: 5a1b2c3d-0000-4000-8000-000000000002 }
 *             title: { type: string, example: Summer Plumbing Offer }
 *             offerCode: { type: string, nullable: true, example: OFF-10 }
 *             discountType: { type: string, enum: [FLAT, PERCENTAGE, FREE_SERVICE], example: PERCENTAGE }
 *             discountValue: { type: number, example: 10 }
 *             couponCode: { type: string, nullable: true, example: SUMMER10 }
 *         trader:
 *           type: object
 *           nullable: true
 *           description: Assigned trader (null until a trader is assigned)
 *           properties:
 *             id: { type: string, format: uuid, example: 6b2c3d4e-0000-4000-8000-000000000020 }
 *             traderCode: { type: string, nullable: true, example: TRD-1001 }
 *             businessName: { type: string, nullable: true, example: Murphy Plumbing Ltd }
 *             avgRating: { type: number, example: 4.6 }
 *             traderType: { type: string, enum: [SOLO, COMPANY], example: SOLO }
 *             fullName: { type: string, nullable: true, example: Sean Kelly }
 *             email: { type: string, nullable: true, example: sean@example.com }
 *             mobileNumber: { type: string, nullable: true, example: '+353861234567' }
 *             profilePhotoUrl: { type: string, nullable: true, example: null }
 *         photos:
 *           type: array
 *           description: Customer job photos (oldest first)
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid, example: 7c3d4e5f-0000-4000-8000-000000000030 }
 *               photoUrl: { type: string, example: 'https://api.brisk.ie/uploads/jobs/photo-1.jpg' }
 *               createdAt: { type: string, format: date-time, example: '2026-07-20T10:00:00.000Z' }
 *         quotes:
 *           type: array
 *           description: All quotes on the job (newest first)
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid, example: 8d4e5f60-0000-4000-8000-000000000040 }
 *               quotedAmount: { type: number, example: 1500 }
 *               currencyCode: { type: string, example: EUR }
 *               status: { type: string, enum: [PENDING, ACCEPTED, REJECTED, EXPIRED], example: ACCEPTED }
 *               notes: { type: string, nullable: true, example: Includes labour and parts. }
 *               createdAt: { type: string, format: date-time, example: '2026-07-21T11:00:00.000Z' }
 *               trader:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   id: { type: string, format: uuid, example: 6b2c3d4e-0000-4000-8000-000000000020 }
 *                   traderCode: { type: string, nullable: true, example: TRD-1001 }
 *                   businessName: { type: string, nullable: true, example: Murphy Plumbing Ltd }
 *                   fullName: { type: string, nullable: true, example: Sean Kelly }
 *         booking:
 *           type: object
 *           nullable: true
 *           description: Created once the customer confirms a trader
 *           properties:
 *             id: { type: string, format: uuid, example: 9e5f6071-0000-4000-8000-000000000050 }
 *             bookingRef: { type: string, nullable: true, example: BK-1042 }
 *             status: { type: string, enum: [SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, RESCHEDULED], example: COMPLETED }
 *             scheduledDate: { type: string, format: date-time, nullable: true, example: '2026-07-29T00:00:00.000Z' }
 *             arrivedAt: { type: string, format: date-time, nullable: true, example: '2026-07-29T09:05:00.000Z', description: Trader marked arrived }
 *             finishedAt: { type: string, format: date-time, nullable: true, example: '2026-07-29T12:40:00.000Z', description: Trader submitted work }
 *             customerConfirmedAt: { type: string, format: date-time, nullable: true, example: null, description: Customer confirmed completion }
 *             invoice:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id: { type: string, format: uuid, example: a0607182-0000-4000-8000-000000000060 }
 *                 invoiceNumber: { type: string, nullable: true, example: INV-1042 }
 *                 status: { type: string, enum: [UNPAID, PAID, REFUNDED], example: PAID }
 *                 serviceCharge: { type: number, example: 1500 }
 *                 traderOfferDiscount: { type: number, example: 0 }
 *                 promoDiscount: { type: number, example: 0 }
 *                 platformFee: { type: number, example: 10 }
 *                 tax: { type: number, example: 302 }
 *                 totalAmount: { type: number, example: 1812 }
 *                 currencyCode: { type: string, example: EUR }
 *                 payments:
 *                   type: array
 *                   description: Payments on this invoice (newest first)
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid, example: b1718293-0000-4000-8000-000000000070 }
 *                       transactionRef: { type: string, nullable: true, example: pi_3PqXyZ }
 *                       amount: { type: number, example: 1812 }
 *                       status: { type: string, enum: [PENDING, COMPLETED, FAILED], example: COMPLETED }
 *                       method: { type: string, nullable: true, enum: [CARD, APPLE_PAY, GOOGLE_PAY], example: CARD }
 *                       paidAt: { type: string, format: date-time, nullable: true, example: '2026-07-29T13:00:00.000Z' }
 *                       createdAt: { type: string, format: date-time, example: '2026-07-29T12:59:00.000Z' }
 *             rating:
 *               type: object
 *               nullable: true
 *               description: Customer review of the trader
 *               properties:
 *                 id: { type: string, format: uuid, example: c28293a4-0000-4000-8000-000000000080 }
 *                 stars: { type: integer, example: 5 }
 *                 review: { type: string, nullable: true, example: Quick and tidy work. }
 *                 createdAt: { type: string, format: date-time, example: '2026-07-30T08:00:00.000Z' }
 *         paymentRequests:
 *           type: array
 *           description: Trader payment requests (oldest first)
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid, example: d393a4b5-0000-4000-8000-000000000090 }
 *               type: { type: string, enum: [FULL JOB, SITE VISIT FEE, PARTIAL], example: FULL JOB }
 *               status: { type: string, enum: [PENDING, SENT, PAID, CANCELLED], example: SENT }
 *               description: { type: string, nullable: true, example: null }
 *               serviceCharge: { type: number, example: 1500 }
 *               materialsTotal: { type: number, example: 45 }
 *               siteVisitFee: { type: number, example: 30 }
 *               platformFee: { type: number, example: 10 }
 *               vatAmount: { type: number, example: 317 }
 *               totalAmount: { type: number, example: 1902 }
 *               currencyCode: { type: string, example: EUR }
 *               paymentMethod: { type: string, nullable: true, enum: [CARD, APPLE PAY, GOOGLE PAY], example: null }
 *               cardLast4: { type: string, nullable: true, example: null }
 *               paidAt: { type: string, format: date-time, nullable: true, example: null }
 *               createdAt: { type: string, format: date-time, example: '2026-07-29T12:45:00.000Z' }
 *         disputes:
 *           type: array
 *           description: Customer reported issues (newest first). Manage via PATCH /admin/disputes/{id}.
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid, example: e4a4b5c6-0000-4000-8000-0000000000a0 }
 *               disputeRef: { type: string, nullable: true, example: DSP-1001 }
 *               reason: { type: string, example: Work not completed }
 *               description: { type: string, nullable: true, example: The tap is still leaking. }
 *               evidenceUrls: { type: array, items: { type: string }, example: ['https://api.brisk.ie/uploads/disputes/evidence-1.jpg'] }
 *               status: { type: string, enum: [OPEN, IN REVIEW, RESOLVED, REJECTED], example: OPEN }
 *               adminNote: { type: string, nullable: true, example: null }
 *               resolvedAt: { type: string, format: date-time, nullable: true, example: null }
 *               createdAt: { type: string, format: date-time, example: '2026-07-30T09:00:00.000Z' }
 */
export {};
