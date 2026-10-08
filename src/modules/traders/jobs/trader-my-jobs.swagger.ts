/**
 * @swagger
 * tags:
 *   - name: Trader / My Jobs
 *     description: |
 *       Trader My Jobs lifecycle after customer confirmation (running / completed jobs).
 *       Auth: trader Bearer.
 *       Button/CTA text is owned by the app — use primaryAction + can* flags.
 *
 *       Screen map:
 *       1. Tabs → GET /traders/jobs/mine?tab=ACTIVE|COMPLETED|OTHER
 *       2. Detail → GET /traders/jobs/mine/{id}
 *       3. Arrive / Finish → POST .../arrive | .../finish
 *       4. Materials / proof / messages / payment / site-visit complete
 *       5. Quotes / request from Discover stay on Discover until customer confirms
 *
 * components:
 *   schemas:
 *     TraderMyJobCard:
 *       type: object
 *       description: Card in My Jobs list (ACTIVE = customer-confirmed / assigned only)
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Job id
 *         jobRef:
 *           type: string
 *           nullable: true
 *           description: Human-readable job reference e.g. JOB-XXXX
 *         title:
 *           type: string
 *           description: Job title
 *         status:
 *           type: string
 *           description: JobStatus e.g. ACCEPTED | SCHEDULED | IN_PROGRESS | CANCELLED
 *         statusBadge:
 *           type: string
 *           description: Short UI badge derived from flowStatus
 *         statusLabel:
 *           type: string
 *           description: Human-readable progress label e.g. Work Proof Pending
 *         flowStatus:
 *           type: string
 *           enum:
 *             - READY_TO_ARRIVE
 *             - ARRIVED
 *             - WORK_PROOF_PENDING
 *             - READY_TO_FINISH
 *             - SITE_VISIT_IN_PROGRESS
 *             - SITE_VISIT_PAYMENT_PENDING
 *             - AWAITING_PAYMENT
 *             - COMPLETED
 *             - CANCELLED
 *             - OPEN
 *           description: |
 *             Machine-readable progress for Flutter tabs.
 *             ACTIVE tab = not finished (READY_TO_ARRIVE … AWAITING_PAYMENT).
 *             COMPLETED tab = only flowStatus=COMPLETED (booking.finishedAt set).
 *         arrivalStatus:
 *           type: string
 *           nullable: true
 *           enum: [ARRIVING_SOON, ARRIVED]
 *           description: Null when no booking yet
 *         siteVisitedBadge:
 *           type: boolean
 *           description: true if site visit is confirmed or completed for this trader
 *         isSiteVisitDone:
 *           type: boolean
 *           description: |
 *             true only when this trader's site visit status is COMPLETED
 *             (trader marked site visit done). false otherwise.
 *         customerName:
 *           type: string
 *           description: Customer display name
 *         customerProfilePhotoUrl:
 *           type: string
 *           nullable: true
 *           description: Customer avatar URL
 *         areaName:
 *           type: string
 *           description: Area label for card
 *         distanceKm:
 *           type: number
 *           description: Distance from trader service centre
 *         quotePrice:
 *           type: number
 *           nullable: true
 *           description: Agreed quote / service charge
 *         scheduledDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         primaryAction:
 *           type: string
 *           description: Suggested CTA — ARRIVE | FINISH | AWAITING_PAYOUT | VIEW_DETAILS
 *     TraderMyJobsList:
 *       type: object
 *       description: Paginated My Jobs tab response (items + meta for infinite scroll)
 *       properties:
 *         tab:
 *           type: string
 *           enum: [ACTIVE, COMPLETED, OTHER]
 *           description: Requested tab filter
 *         items:
 *           type: array
 *           description: Jobs for this tab (ACTIVE = customer-confirmed / assigned only)
 *           items: { $ref: '#/components/schemas/TraderMyJobCard' }
 *         meta:
 *           type: object
 *           description: Pagination meta for infinite scroll
 *           properties:
 *             total: { type: integer, description: Total matching jobs }
 *             page: { type: integer, description: Current page (1-based) }
 *             limit: { type: integer, description: Page size }
 *             totalPages: { type: integer, description: Total pages }
 *     TraderMyJobDetail:
 *       type: object
 *       description: My Jobs detail (GET /traders/jobs/mine/{id}) — only after customer confirmed / trader assigned. Button text is owned by the app; use primaryAction + can* flags.
 *       properties:
 *         id: { type: string, format: uuid, example: 8a8fb0e5-a330-4c62-8e76-a358bd792b84 }
 *         title: { type: string, example: Kitchen sink leaking }
 *         createdAt: { type: string, format: date-time, example: '2026-07-20T10:00:00.000Z' }
 *         jobRef: { type: string, nullable: true, example: JOB-1119 }
 *         description: { type: string, example: Water leaking under the kitchen sink since yesterday. }
 *         qaFormAnswerList:
 *           type: array
 *           items: { $ref: '#/components/schemas/QaFormAnswerItem' }
 *         status:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, QUOTED, ACCEPTED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, PAYMENT_PENDING]
 *           example: PAYMENT_PENDING
 *         statusBadge: { type: string, example: Completed, description: Short UI badge derived from flowStatus }
 *         statusLabel: { type: string, example: Completed, description: Human-readable progress label }
 *         flowStatus:
 *           type: string
 *           enum: [OPEN, READY_TO_ARRIVE, ARRIVED, WORK_PROOF_PENDING, READY_TO_FINISH, SITE_VISIT_IN_PROGRESS, SITE_VISIT_PAYMENT_PENDING, PARTIAL_PAYMENT_PENDING, PARTIALLY_PAID, AWAITING_PAYMENT, COMPLETED, CANCELLED]
 *           example: COMPLETED
 *         paymentStatus: { type: string, enum: [UNPAID, PENDING, PARTIALLY_PAID, PAID], example: UNPAID }
 *         customerConfirmedAt: { type: string, format: date-time, nullable: true, example: null }
 *         isSiteVisit: { type: boolean, example: true, description: This job is a site-visit job (visit may still be pending) }
 *         isSiteVisitDone: { type: boolean, example: true, description: true only when visit.status = COMPLETED }
 *         siteVisit:
 *           type: object
 *           properties:
 *             status: { type: string, enum: [NONE, PENDING, CONFIRMED, RESCHEDULE_REQUIRED, COMPLETED, CANCELLED], example: COMPLETED }
 *             fee: { type: number, nullable: true, example: 30 }
 *             isSiteVisitDone: { type: boolean, example: true }
 *             completedAt: { type: string, format: date-time, nullable: true, example: '2026-07-24T11:00:00.000Z' }
 *             requested: { type: boolean, example: true, description: Job marked as site-visit requested }
 *             isSiteVisit: { type: boolean, example: true, description: Same as top-level isSiteVisit }
 *         photos:
 *           type: array
 *           description: Customer photo URLs
 *           items: { type: string }
 *           example: ['https://api.brisk.ie/uploads/jobs/photo-1.jpg']
 *         proofPhotos:
 *           type: array
 *           description: Trader proof photos after work
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid, example: 7c3d4e5f-0000-4000-8000-000000000031 }
 *               photoUrl: { type: string, example: 'https://api.brisk.ie/uploads/jobs/proof-1.jpg' }
 *         completionPhotos:
 *           type: array
 *           description: Same proof photos as plain URLs
 *           items: { type: string }
 *           example: ['https://api.brisk.ie/uploads/jobs/proof-1.jpg']
 *         tags:
 *           type: array
 *           description: Category + subcategory chips
 *           items:
 *             type: object
 *             properties:
 *               label: { type: string, example: Interior Design }
 *               icon: { type: string, nullable: true, example: 'https://api.brisk.ie/static/category-icons/interior-design.png' }
 *               iconUrl: { type: string, nullable: true, example: 'https://api.brisk.ie/static/category-icons/interior-design.png' }
 *               iconName: { type: string, nullable: true, example: interior }
 *         location:
 *           type: object
 *           properties:
 *             fullAddress: { type: string, example: '14 Rathmines Road, Dublin, D06 XY12' }
 *             areaName: { type: string, example: Dublin }
 *             distanceKm: { type: number, example: 4.2 }
 *             latitude: { type: number, example: 53.3347 }
 *             longitude: { type: number, example: -6.2783 }
 *         distanceKm: { type: number, example: 4.2, description: Same as location.distanceKm }
 *         quotePrice: { type: number, nullable: true, example: 1500, description: Agreed / quoted price }
 *         customer:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid, example: 1f2e3d4c-0000-4000-8000-000000000001 }
 *             fullName: { type: string, example: John Murphy }
 *             name: { type: string, example: John Murphy, description: Same as fullName }
 *             profilePhotoUrl: { type: string, nullable: true, example: 'https://api.brisk.ie/uploads/profile/john.jpg' }
 *             avatar: { type: string, nullable: true, example: 'https://api.brisk.ie/uploads/profile/john.jpg', description: Same as profilePhotoUrl }
 *             location: { type: string, example: Dublin }
 *             isVerified: { type: boolean, example: true }
 *             phoneNumber: { type: string, nullable: true, example: '+353871234567' }
 *             rating: { type: number, nullable: true, example: null, description: Not rated yet — always null for now }
 *             jobsPosted: { type: integer, example: 12 }
 *             conversationId: { type: string, format: uuid, example: 8a8fb0e5-a330-4c62-8e76-a358bd792b84, description: 'Use with GET /traders/jobs/mine/{id}/messages' }
 *         materials:
 *           type: object
 *           properties:
 *             count: { type: integer, example: 1 }
 *             total: { type: number, example: 45 }
 *             items:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid, example: f5b5c6d7-0000-4000-8000-0000000000b0 }
 *                   name: { type: string, example: Copper pipe }
 *                   detail: { type: string, nullable: true, example: '2m, 15mm' }
 *                   price: { type: number, example: 45 }
 *                   priceLabel: { type: string, example: '€45.00' }
 *                   currencyCode: { type: string, example: EUR }
 *                   currencySymbol: { type: string, example: '€' }
 *                   photoUrl: { type: string, nullable: true, example: null }
 *             totalLabel: { type: string, example: '€45.00' }
 *             currencyCode: { type: string, example: EUR }
 *             currencySymbol: { type: string, example: '€' }
 *         negotiationMessages:
 *           type: array
 *           description: Last 5 chat messages (oldest first)
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid, example: a6c6d7e8-0000-4000-8000-0000000000c0 }
 *               senderRole: { type: string, enum: [CUSTOMER, TRADER], example: TRADER }
 *               senderName: { type: string, example: Sean Kelly }
 *               message: { type: string, example: I can come on Tuesday morning. }
 *               sentAt: { type: string, format: date-time, example: '2026-07-21T12:00:00.000Z' }
 *               isMine: { type: boolean, example: true }
 *         canArrive: { type: boolean, example: false, description: true → show I Have Arrived; POST .../arrive }
 *         canMarkFinished: { type: boolean, example: false, description: true after arrive until finished → Mark as Finished }
 *         canFinish: { type: boolean, example: false, description: true → arrived + at least one proof photo; POST .../finish }
 *         canAddMaterials: { type: boolean, example: false }
 *         canSubmitQuote: { type: boolean, example: false }
 *         canAcceptJob: { type: boolean, example: false }
 *         canRequestPayment: { type: boolean, example: false, description: true → POST .../request-payment }
 *         canRequestPartialPayment: { type: boolean, example: false }
 *         canCompleteSiteVisit: { type: boolean, example: false, description: true → POST .../site-visit/complete }
 *         canRequestSiteVisitPayment: { type: boolean, example: false, description: true → POST .../site-visit/request-payment }
 *         isPartialJob: { type: boolean, example: false }
 *         primaryAction:
 *           type: string
 *           enum: [ARRIVE, UPLOAD_PROOF, FINISH, REQUEST_PARTIAL_PAYMENT, AWAITING_PARTIAL_PAYMENT, COMPLETE_SITE_VISIT, REQUEST_SITE_VISIT_PAYMENT, REQUEST_PAYMENT, ACCEPT_JOB, SUBMIT_QUOTE, ADD_MATERIALS, AWAITING_PAYOUT, VIEW_DETAILS]
 *           example: AWAITING_PAYOUT
 *           description: Main CTA code (app owns button text)
 *         isPartPayment: { type: boolean, example: false, description: Same as isPartialJob }
 *         estimatedEarnings: { type: number, nullable: true, example: 1500 }
 *         durationLabel: { type: string, nullable: true, example: 2-3 hours }
 *         arrivalStatus: { type: string, nullable: true, enum: [ARRIVING_SOON, ARRIVED], example: ARRIVED }
 *         scheduledDate: { type: string, format: date-time, nullable: true, example: '2026-07-29T00:00:00.000Z' }
 *     TraderMaterialsList:
 *       type: object
 *       description: GET/POST materials response
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid, description: Material id }
 *               name: { type: string, description: Material name }
 *               detail: { type: string, nullable: true, description: Optional detail }
 *               price: { type: number, description: Line price number }
 *               priceLabel: { type: string, example: "€12.50", description: Price with currency symbol }
 *               currencyCode: { type: string, example: EUR }
 *               currencySymbol: { type: string, example: € }
 *               photoUrl: { type: string, nullable: true, description: Optional photo URL }
 *         count: { type: integer, description: Item count }
 *         total: { type: number, description: Sum of prices }
 *         totalLabel: { type: string, example: "€45.00", description: Total with currency symbol }
 *         currencyCode: { type: string, example: EUR }
 *         currencySymbol: { type: string, example: € }
 *         lastUpdatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Latest material updatedAt
 *     TraderPaymentSummary:
 *       type: object
 *       description: Payment breakdown numbers (app formats labels)
 *       properties:
 *         serviceCharge: { type: number, description: Service / quote charge EUR }
 *         materialsTotal: { type: number, description: Materials total EUR }
 *         siteVisitFee: { type: number, description: Site visit fee EUR }
 *         platformFee: { type: number, example: 10, description: Platform fee EUR }
 *         vatRate: { type: number, example: 0.2, description: VAT rate e.g. 0.2 = 20% }
 *         vatAmount: { type: number, description: VAT amount EUR }
 *         totalAmount: { type: number, description: Grand total EUR }
 *         jobRef: { type: string, nullable: true, description: Job reference }
 *         completedDate: { type: string, format: date-time, description: Completion / finish timestamp }
 *         address: { type: string, description: Full job address string }
 *     TraderIncomingJob:
 *       type: object
 *       nullable: true
 *       description: |
 *         "Customer accepted your quotation" bottom sheet (View & Accept / Decline).
 *         Same payload as socket **`job:accept`** and `GET /traders/jobs/incoming/latest`
 *         (`null` when nothing is waiting). Never sent for new marketplace jobs.
 *       properties:
 *         id: { type: string, format: uuid, description: Job id (same as jobId) }
 *         jobId: { type: string, format: uuid, description: 'Use in POST /traders/jobs/incoming/{jobId}/accept|decline' }
 *         quoteId: { type: string, format: uuid, description: The quotation the customer accepted }
 *         jobRef: { type: string, nullable: true }
 *         title: { type: string, example: Kitchen Sink Leak }
 *         description: { type: string, description: Customer note, example: Water leaking under the sink. }
 *         distanceKm: { type: number, example: 2.4 }
 *         distanceMiles: { type: number, example: 1.5, description: DISTANCE card }
 *         charges: { type: number, example: 120, description: 'Accepted quotation amount (CHARGES card → €120)' }
 *         quoteAmount: { type: number, example: 120, description: Alias of charges }
 *         currencyCode: { type: string, example: EUR }
 *         currencySymbol: { type: string, example: € }
 *         customer:
 *           type: object
 *           properties:
 *             fullName: { type: string, example: Sarah Jenkins }
 *             profileImage: { type: string, nullable: true, format: uri }
 *             isVerifiedCustomer: { type: boolean, example: true, description: '"Verified Customer" label' }
 *         actions:
 *           type: object
 *           properties:
 *             canAccept: { type: boolean, example: true }
 *             canDecline: { type: boolean, example: true }
 *         assignmentStatus: { type: string, enum: [CUSTOMER_ACCEPTED] }
 *         isSiteVisit: { type: boolean }
 *         areaName: { type: string, nullable: true, example: Dublin }
 *         latitude: { type: number }
 *         longitude: { type: number }
 *         createdAt: { type: string, format: date-time, description: Job posted at }
 *         acceptedAt: { type: string, format: date-time, description: Customer accepted the quote at }
 *         at: { type: string, format: date-time, description: Socket job:accept only — event time }
 */
export {};
