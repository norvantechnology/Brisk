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
 *           description: JobStatus e.g. ACCEPTED | SCHEDULED | IN_PROGRESS
 *         statusBadge:
 *           type: string
 *           enum: [Active, Completed, Awaiting Payout, Cancelled, Open]
 *           description: |
 *             List badge — Active (ACCEPTED/SCHEDULED/IN_PROGRESS), Completed, Awaiting Payout
 *             (PAYMENT_PENDING), Cancelled (CANCELLED), Open (other / draft-like).
 *         siteVisitedBadge:
 *           type: boolean
 *           description: true if site visit is confirmed or completed for this trader
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
 *       description: My Jobs detail — only after customer confirmed / trader assigned
 *       properties:
 *         id: { type: string, format: uuid, description: Job id }
 *         title: { type: string, description: Job title }
 *         createdAt: { type: string, format: date-time, description: Job created at }
 *         jobRef: { type: string, nullable: true, description: Job reference code }
 *         description: { type: string, description: Full description }
 *         status:
 *           type: string
 *           description: JobStatus e.g. ACCEPTED | SCHEDULED | IN_PROGRESS | COMPLETED | PAYMENT_PENDING
 *         photos:
 *           type: array
 *           items: { type: string, format: uri }
 *           description: Customer photos
 *         proofPhotos:
 *           type: array
 *           description: Trader proof photos after work
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               photoUrl: { type: string, format: uri }
 *         quotePrice:
 *           type: number
 *           nullable: true
 *           description: Agreed / quoted price EUR
 *         canArrive:
 *           type: boolean
 *           description: true → show I Have Arrived; POST .../arrive
 *         canFinish:
 *           type: boolean
 *           description: true → show Finish Job; POST .../finish
 *         canAddMaterials:
 *           type: boolean
 *           description: true → allow materials APIs
 *         canSubmitQuote:
 *           type: boolean
 *           description: true → quote can still be submitted/updated (rare on assigned jobs)
 *         canAcceptJob:
 *           type: boolean
 *           description: true → Request/Accept still available (marketplace waiting path if unassigned)
 *         canRequestPayment:
 *           type: boolean
 *           description: true → POST .../request-payment
 *         canCompleteSiteVisit:
 *           type: boolean
 *           description: true → POST .../site-visit/complete
 *         canRequestSiteVisitPayment:
 *           type: boolean
 *           description: true → POST .../site-visit/request-payment
 *         primaryAction:
 *           type: string
 *           description: |
 *             Main CTA code (app owns button text).
 *             ARRIVE | FINISH | COMPLETE_SITE_VISIT | REQUEST_SITE_VISIT_PAYMENT |
 *             REQUEST_PAYMENT | ACCEPT_JOB | SUBMIT_QUOTE | ADD_MATERIALS | AWAITING_PAYOUT | VIEW_DETAILS
 *         estimatedEarnings:
 *           type: number
 *           nullable: true
 *           description: Estimated earnings EUR
 *         durationLabel:
 *           type: string
 *           nullable: true
 *           description: Optional duration from job
 *         arrivalStatus:
 *           type: string
 *           nullable: true
 *           enum: [ARRIVING_SOON, ARRIVED]
 *           description: ARRIVING_SOON before arrive; ARRIVED after POST arrive; null if not in arrival phase
 *         materials:
 *           type: object
 *           description: Materials summary
 *           properties:
 *             count: { type: integer, description: Number of material lines }
 *             total: { type: number, description: Materials total EUR }
 *         siteVisit:
 *           type: object
 *           description: Site visit summary on My Jobs detail
 *           properties:
 *             status: { type: string, description: Site visit status code }
 *             fee: { type: number, nullable: true, description: Site visit fee EUR }
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
 *               price: { type: number, description: Line price EUR }
 *               photoUrl: { type: string, nullable: true, description: Optional photo URL }
 *         count: { type: integer, description: Item count }
 *         total: { type: number, description: Sum of prices EUR }
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
 *       description: Latest open marketplace job for map incoming sheet (null if none)
 *       properties:
 *         id: { type: string, format: uuid, description: Job id }
 *         title: { type: string, description: Job title }
 *         distanceKm: { type: number, description: Distance km }
 *         customerName: { type: string, description: Customer name }
 *         isSiteVisit: { type: boolean, description: true if site-visit job }
 *         price:
 *           type: number
 *           nullable: true
 *           description: Display price amount EUR (fee or service charge)
 *         actions:
 *           type: object
 *           description: Soft accept/decline availability on map sheet
 *           properties:
 *             canAccept:
 *               type: boolean
 *               description: true means POST incoming accept is allowed
 *             canDecline:
 *               type: boolean
 *               description: true means POST incoming decline is allowed
 */
export {};
