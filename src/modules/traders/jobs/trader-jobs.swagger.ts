/**
 * @swagger
 * tags:
 *   - name: Trader / Discover Jobs
 *     description: |
 *       Discover + site visit + quote + request-job flow. Auth trader Bearer.
 *       App owns all button/currency text. Use flags + numeric amounts only.
 *       Flow Discover → Quote → Request Job → Waiting → Customer Confirms → My Jobs.
 *
 * components:
 *   schemas:
 *     TraderDiscoverJobCard:
 *       type: object
 *       description: One card in GET /traders/jobs/discover
 *       required: [id, title, badge, distanceKm, areaName, createdAt, isBookmarked, isSiteVisit]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Job id for detail/quote/request/site-visit paths
 *         title:
 *           type: string
 *           example: Solar Panel Installation
 *           description: Job title
 *         badge:
 *           type: string
 *           nullable: true
 *           enum: [Site Visit, Reschedule]
 *           description: List badge code. null = normal quote job
 *         distanceKm:
 *           type: number
 *           example: 2.5
 *           description: Distance in km
 *         areaName:
 *           type: string
 *           example: Dublin 2
 *           description: Area/city label
 *         siteVisitFee:
 *           type: number
 *           nullable: true
 *           description: Site visit fee amount (null if not applicable). App formats with currencySymbol.
 *         minBudget:
 *           type: number
 *           nullable: true
 *           description: Min budget amount if set
 *         maxBudget:
 *           type: number
 *           nullable: true
 *           description: Max budget amount if set
 *         serviceCharge:
 *           type: number
 *           nullable: true
 *           description: Service charge amount if set
 *         currencyCode:
 *           type: string
 *           enum: [EUR, GBP]
 *           example: EUR
 *           description: |
 *             Dynamic display currency (EUR or GBP only).
 *             Priority: customer preferredCurrency → trader preferredCurrency →
 *             job/address country (Ireland=EUR, UK=GBP) → trader country → platform base.
 *         currencySymbol:
 *           type: string
 *           example: €
 *           description: Symbol for price inputs / display (€ or £)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Job created/published time
 *         isBookmarked:
 *           type: boolean
 *           description: true if bookmarked by this trader
 *         isSiteVisit:
 *           type: boolean
 *           description: true when site-visit APIs apply
 *         jobStatus:
 *           type: string
 *           example: PUBLISHED
 *           description: DB job status. Stays PUBLISHED until customer confirms trader.
 *         assignmentStatus:
 *           type: string
 *           enum: [NONE, QUOTED, WAITING_FOR_CUSTOMER, ASSIGNED]
 *           description: |
 *             NONE = no quote yet;
 *             QUOTED = quote submitted (not Active);
 *             WAITING_FOR_CUSTOMER = Request Job done, pending customer confirm (NOT My Jobs ACTIVE);
 *             ASSIGNED = customer confirmed (My Jobs ACTIVE; normally leaves Discover).
 *         hasSubmittedQuote:
 *           type: boolean
 *           description: true if this trader already quoted
 *         canUpdateQuote:
 *           type: boolean
 *           description: true → Update Quotation via POST quotes
 *         canSubmitQuote:
 *           type: boolean
 *           description: true → Submit Quotation via POST quotes
 *         isJobRequested:
 *           type: boolean
 *           description: true after Request Job (quote.requestedAt set)
 *         isWaitingForCustomerConfirmation:
 *           type: boolean
 *           description: |
 *             true only while trader requested AND customer has NOT confirmed yet
 *             (job still PUBLISHED + unassigned). This is the pending-confirmation state —
 *             NOT My Jobs ACTIVE. After customer confirm → false / job leaves Discover.
 *         quoteAmount:
 *           type: number
 *           nullable: true
 *           description: This trader latest quote amount
 *     TraderSiteVisitBlock:
 *       type: object
 *       description: Site-visit state on Discover Job Details
 *       properties:
 *         status:
 *           type: string
 *           enum: [NONE, PENDING, CONFIRMED, RESCHEDULE_REQUIRED, COMPLETED]
 *           description: NONE none yet; PENDING proposed (can update); CONFIRMED locked; RESCHEDULE_REQUIRED needs new slots; COMPLETED done
 *         visitDate:
 *           type: string
 *           nullable: true
 *           example: '2026-10-24'
 *           description: Primary visit date YYYY-MM-DD
 *         timeSlot:
 *           type: string
 *           nullable: true
 *           enum: [MORNING, AFTERNOON, EVENING, ANYTIME]
 *           description: Primary time window code
 *         startTime: { type: string, nullable: true, example: '12:00', description: HH:mm start }
 *         endTime: { type: string, nullable: true, example: '17:00', description: HH:mm end }
 *         requestId: { type: string, format: uuid, nullable: true, description: Site visit request id }
 *         slots:
 *           type: array
 *           description: Proposed slots list
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, description: Slot id }
 *               date: { type: string, description: YYYY-MM-DD }
 *               timeSlot: { type: string, description: MORNING|AFTERNOON|EVENING|ANYTIME }
 *               startTime: { type: string }
 *               endTime: { type: string }
 *               isSelected: { type: boolean }
 *         slotCount: { type: integer, description: Number of proposed slots }
 *     TraderWaitingJobCard:
 *       type: object
 *       description: Home Waiting (blue) card from GET /traders/jobs/waiting
 *       properties:
 *         id: { type: string, format: uuid, description: Job id }
 *         title: { type: string, description: Job title }
 *         customerName: { type: string, description: Customer name }
 *         areaName: { type: string, description: Area }
 *         distanceKm: { type: number, description: Distance km }
 *         quoteAmount: { type: number, description: Quote amount EUR }
 *         statusBadge: { type: string, example: Waiting, description: Badge code for waiting UI }
 *         colorHint: { type: string, example: blue, description: Suggested card colour token }
 *         isJobRequested: { type: boolean, description: Trader has requested the job }
 *         isWaitingForCustomerConfirmation: { type: boolean, description: Awaiting customer confirm }
 *         hasSubmittedQuote: { type: boolean, description: Quote exists }
 *         requestedAt: { type: string, format: date-time, description: When trader requested }
 *         primaryAction: { type: string, example: WAITING_FOR_CUSTOMER, description: CTA code for waiting UI }
 *     TraderWaitingJobsResponse:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/TraderWaitingJobCard' }
 *         count: { type: integer, description: Waiting job count }
 *     TraderDiscoverJobDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/TraderDiscoverJobCard'
 *         - type: object
 *           description: GET /traders/jobs/discover/{id} full payload
 *           properties:
 *             description: { type: string, description: Job description }
 *             photos:
 *               type: array
 *               items: { type: string, format: uri }
 *               description: Customer photo URLs
 *             photoCount: { type: integer, description: Photo count }
 *             siteVisitFee: { type: number, nullable: true, description: Site visit fee EUR }
 *             isReschedule: { type: boolean, description: Reschedule flow }
 *             canSelectDateTime: { type: boolean, description: Show date/time sheet }
 *             canRequestSiteVisit: { type: boolean, description: Allow POST site-visit/request }
 *             canRequestReschedule: { type: boolean, description: Allow POST site-visit/reschedule }
 *             canSubmitQuote: { type: boolean, description: Show Submit Quotation }
 *             canUpdateQuote: { type: boolean, description: Show Update Quotation }
 *             canRequestJob: { type: boolean, description: Show Request Job; POST .../request }
 *             hasSubmittedQuote: { type: boolean, description: Trader already quoted }
 *             isJobRequested: { type: boolean, description: Request Job already done }
 *             isWaitingForCustomerConfirmation: { type: boolean, description: Waiting on customer }
 *             quoteId: { type: string, format: uuid, nullable: true, description: Latest quote id }
 *             quoteAmount: { type: number, nullable: true, description: Quote amount EUR }
 *             quoteNotes: { type: string, nullable: true, description: Quote notes }
 *             quoteStatus: { type: string, nullable: true, description: PENDING|ACCEPTED|REJECTED }
 *             primaryAction:
 *               type: string
 *               enum: [REQUEST_SITE_VISIT, UPDATE_SITE_VISIT, REQUEST_RESCHEDULE, BACK_TO_JOB, SUBMIT_QUOTE, UPDATE_QUOTE, REQUEST_JOB, WAITING_FOR_CUSTOMER]
 *               description: Main CTA code (app owns button text)
 *             siteVisit: { $ref: '#/components/schemas/TraderSiteVisitBlock' }
 *             customer:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 fullName: { type: string }
 *                 profilePhotoUrl: { type: string, nullable: true }
 *                 isVerified: { type: boolean, description: Verified customer }
 *             category:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 name: { type: string }
 *                 iconName: { type: string, nullable: true }
 *                 iconUrl: { type: string, nullable: true, description: Icon image URL }
 *             subcategory:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 name: { type: string }
 *                 iconUrl: { type: string, nullable: true }
 *             tags:
 *               type: array
 *               description: Category chips
 *               items:
 *                 type: object
 *                 properties:
 *                   label: { type: string, description: Chip name text }
 *                   icon: { type: string, nullable: true, description: Same as iconUrl }
 *                   iconUrl: { type: string, nullable: true }
 *                   iconName: { type: string, nullable: true }
 *             scheduledDate: { type: string, format: date-time, nullable: true }
 *             timeSlot: { type: string, nullable: true, description: Customer preferred slot text }
 *             duration:
 *               type: string
 *               nullable: true
 *               description: Optional duration text from job (DB duration_label)
 *             location:
 *               type: object
 *               properties:
 *                 areaName: { type: string }
 *                 distanceKm: { type: number }
 *                 latitude: { type: number }
 *                 longitude: { type: number }
 *                 mapPreviewUrl: { type: string }
 *     TraderSiteVisitSlots:
 *       type: object
 *       description: GET .../site-visit/slots bottom sheet data
 *       properties:
 *         jobId: { type: string, format: uuid }
 *         dates:
 *           type: array
 *           description: Selectable dates
 *           items:
 *             type: object
 *             properties:
 *               date: { type: string, description: YYYY-MM-DD }
 *               month: { type: string }
 *               day: { type: integer }
 *               weekday: { type: string }
 *         timeSlots:
 *           type: array
 *           description: Fixed windows — app maps id to UI labels
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, enum: [MORNING, AFTERNOON, EVENING, ANYTIME] }
 *               startTime: { type: string }
 *               endTime: { type: string }
 *               icon: { type: string }
 *         selected:
 *           type: object
 *           nullable: true
 *           properties:
 *             date: { type: string }
 *             timeSlot: { type: string }
 *         proposedSlots:
 *           type: array
 *           description: Saved slots for this trader
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string }
 *               date: { type: string }
 *               timeSlot: { type: string }
 *               startTime: { type: string }
 *               endTime: { type: string }
 *               isSelected: { type: boolean }
 *         mode: { type: string, enum: [REQUEST, RESCHEDULE], description: Flow mode }
 *     TraderSiteVisitRequestBody:
 *       type: object
 *       description: Prefer slots[]. Legacy date+timeSlot accepted.
 *       properties:
 *         slots:
 *           type: array
 *           items:
 *             type: object
 *             required: [date, timeSlot]
 *             properties:
 *               date: { type: string, example: '2026-10-24', description: YYYY-MM-DD }
 *               timeSlot: { type: string, enum: [MORNING, AFTERNOON, EVENING, ANYTIME] }
 *         date: { type: string, description: Legacy single date }
 *         timeSlot: { type: string, enum: [MORNING, AFTERNOON, EVENING, ANYTIME] }
 *     TraderQuoteRequestBody:
 *       type: object
 *       required: [amount]
 *       properties:
 *         amount: { type: number, example: 450, description: Quote amount EUR }
 *         notes: { type: string, description: Optional notes }
 *     TraderQuoteResponse:
 *       type: object
 *       description: Quote upsert — job stays on Discover
 *       properties:
 *         id: { type: string, format: uuid }
 *         jobId: { type: string, format: uuid }
 *         amount: { type: number, example: 450, description: Saved amount EUR }
 *         notes: { type: string, nullable: true }
 *         status: { type: string, example: PENDING }
 *         hasSubmittedQuote: { type: boolean }
 *         canUpdateQuote: { type: boolean }
 *         isJobRequested: { type: boolean }
 *         isWaitingForCustomerConfirmation: { type: boolean }
 *     TraderRequestJobBody:
 *       type: object
 *       properties:
 *         amount: { type: number, description: Optional if quote exists }
 *         notes: { type: string }
 */
export {};
