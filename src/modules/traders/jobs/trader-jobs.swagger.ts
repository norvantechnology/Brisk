/**
 * @swagger
 * tags:
 *   - name: Trader / Discover Jobs
 *     description: |
 *       Trader Discover + Site Visit flow. Auth: trader Bearer.
 *
 *       Button/CTA text is owned by the app. Use `primaryAction` + boolean flags only.
 *
 *       Flow: Discover → Quote → Update Quote → Request Job → Waiting → Customer Confirms → My Jobs
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
 *           description: Job id — use in detail, quote, request, and site-visit paths
 *         title:
 *           type: string
 *           example: Solar Panel Installation
 *           description: Job title shown on the Discover card
 *         badge:
 *           type: string
 *           nullable: true
 *           enum: [Site Visit, Reschedule]
 *           description: List badge. Site Visit = site-visit job; Reschedule = trader visit needs new slot; null = normal quote job
 *         distanceKm:
 *           type: number
 *           example: 2.5
 *           description: Distance from trader location (or service centre) in kilometres
 *         areaName:
 *           type: string
 *           example: Dublin 2
 *           description: Area / city label for the job location
 *         priceLabel:
 *           type: string
 *           nullable: true
 *           example: "€30"
 *           description: Optional preformatted price for list display (fee or budget). App may format from other fields instead
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Job created/published time — app formats as relative Posted X ago
 *         isBookmarked:
 *           type: boolean
 *           description: true if this trader bookmarked the job
 *         isSiteVisit:
 *           type: boolean
 *           description: true when job requires / offers site visit (use site-visit APIs instead of quote-only CTA)
 *         hasSubmittedQuote:
 *           type: boolean
 *           description: true if this trader already submitted a quotation for this job
 *         canUpdateQuote:
 *           type: boolean
 *           description: true if app should show Update Quotation (trader already quoted; POST quotes again to upsert)
 *         canSubmitQuote:
 *           type: boolean
 *           description: true if app should show Submit Quotation (no quote yet from this trader)
 *         isJobRequested:
 *           type: boolean
 *           description: true if trader already tapped Request/Accept Job and is waiting on the customer
 *         isWaitingForCustomerConfirmation:
 *           type: boolean
 *           description: true while waiting for customer to confirm — show Home Waiting (blue) card; job is NOT in My Jobs ACTIVE yet
 *         quoteAmount:
 *           type: number
 *           nullable: true
 *           description: This trader's latest quoted amount in EUR (null if not quoted yet)
 *     TraderSiteVisitBlock:
 *       type: object
 *       description: Nested site-visit state on Discover Job Details
 *       properties:
 *         status:
 *           type: string
 *           enum: [NONE, PENDING, CONFIRMED, RESCHEDULE_REQUIRED, COMPLETED]
 *           description: |
 *             NONE = no slots submitted yet;
 *             PENDING = trader proposed slots, waiting customer confirm (can update again);
 *             CONFIRMED = customer locked visit;
 *             RESCHEDULE_REQUIRED = needs new slots;
 *             COMPLETED = visit finished
 *         visitDate:
 *           type: string
 *           nullable: true
 *           example: '2026-10-24'
 *           description: Primary proposed/selected visit date (YYYY-MM-DD)
 *         timeSlot:
 *           type: string
 *           nullable: true
 *           enum: [MORNING, AFTERNOON, EVENING, ANYTIME]
 *           description: Primary time window code for the selected/proposed slot
 *         startTime:
 *           type: string
 *           nullable: true
 *           example: '12:00'
 *           description: Window start HH:mm (UTC/local as returned)
 *         endTime:
 *           type: string
 *           nullable: true
 *           example: '17:00'
 *           description: Window end HH:mm
 *         requestId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: TraderSiteVisitRequest id when a request exists
 *         slots:
 *           type: array
 *           description: All proposed slots for this trader+job (SITE VISIT SLOTS list)
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, description: Slot row id }
 *               date: { type: string, description: YYYY-MM-DD }
 *               timeSlot: { type: string, description: MORNING | AFTERNOON | EVENING | ANYTIME }
 *               startTime: { type: string, description: HH:mm }
 *               endTime: { type: string, description: HH:mm }
 *               isSelected: { type: boolean, description: true for the primary/selected slot }
 *         slotCount:
 *           type: integer
 *           description: Number of proposed slots
 *     TraderWaitingJobCard:
 *       type: object
 *       description: Home Active/Waiting (blue) card from GET /traders/jobs/waiting
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Job id
 *         title: { type: string, description: Job title }
 *         customerName: { type: string, description: Customer display name }
 *         areaName: { type: string, description: Job area }
 *         distanceKm: { type: number, description: Distance in km }
 *         quoteAmount: { type: number, description: Submitted quote amount EUR }
 *         statusBadge:
 *           type: string
 *           example: Waiting
 *           description: Short badge code for waiting state (app maps to UI text/colour)
 *         colorHint:
 *           type: string
 *           example: blue
 *           description: Suggested card colour token — render Waiting card in blue
 *         isJobRequested:
 *           type: boolean
 *           description: Always true on this list — trader has requested the job
 *         isWaitingForCustomerConfirmation:
 *           type: boolean
 *           description: Always true on this list — customer has not confirmed yet
 *         hasSubmittedQuote:
 *           type: boolean
 *           description: true when a quote exists for this request
 *         requestedAt:
 *           type: string
 *           format: date-time
 *           description: When trader requested/accepted the job
 *         primaryAction:
 *           type: string
 *           example: WAITING_FOR_CUSTOMER
 *           description: CTA code — app shows waiting UI (no running-job actions yet)
 *     TraderWaitingJobsResponse:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           description: Waiting cards for Home
 *           items: { $ref: '#/components/schemas/TraderWaitingJobCard' }
 *         count:
 *           type: integer
 *           description: Number of waiting jobs
 *     TraderDiscoverJobDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/TraderDiscoverJobCard'
 *         - type: object
 *           description: Full Job Details from GET /traders/jobs/discover/{id}
 *           properties:
 *             description:
 *               type: string
 *               description: Full job description from customer
 *             photos:
 *               type: array
 *               items: { type: string, format: uri }
 *               description: Customer photo URLs
 *             photoCount:
 *               type: integer
 *               description: Count of customer photos
 *             siteVisitFee:
 *               type: number
 *               nullable: true
 *               description: Site visit fee EUR from subcategory/job snapshot (null if not site-visit)
 *             isReschedule:
 *               type: boolean
 *               description: true when UI should treat this as a reschedule flow
 *             canSelectDateTime:
 *               type: boolean
 *               description: true → show Select Date & Time sheet (GET .../site-visit/slots)
 *             canRequestSiteVisit:
 *               type: boolean
 *               description: true → allow POST .../site-visit/request (create or update PENDING slots)
 *             canRequestReschedule:
 *               type: boolean
 *               description: true → allow POST .../site-visit/reschedule
 *             canSubmitQuote:
 *               type: boolean
 *               description: true → show Submit Quotation; POST .../quotes
 *             canUpdateQuote:
 *               type: boolean
 *               description: true → show Update Quotation; same POST .../quotes upserts amount
 *             canRequestJob:
 *               type: boolean
 *               description: true → show Request/Accept Job; POST .../request (does NOT assign trader)
 *             hasSubmittedQuote:
 *               type: boolean
 *               description: true if this trader already has a quote on this job
 *             isJobRequested:
 *               type: boolean
 *               description: true after Request Job until customer confirms
 *             isWaitingForCustomerConfirmation:
 *               type: boolean
 *               description: true while awaiting customer confirm — stay on Discover / Home Waiting
 *             quoteId:
 *               type: string
 *               format: uuid
 *               nullable: true
 *               description: Latest quote id for this trader (needed for customer accept path)
 *             quoteAmount:
 *               type: number
 *               nullable: true
 *               description: Latest quoted amount EUR
 *             quoteNotes:
 *               type: string
 *               nullable: true
 *               description: Notes on the latest quote
 *             quoteStatus:
 *               type: string
 *               nullable: true
 *               description: Quote status e.g. PENDING | ACCEPTED | REJECTED
 *             primaryAction:
 *               type: string
 *               enum: [REQUEST_SITE_VISIT, UPDATE_SITE_VISIT, REQUEST_RESCHEDULE, BACK_TO_JOB, SUBMIT_QUOTE, UPDATE_QUOTE, REQUEST_JOB, WAITING_FOR_CUSTOMER]
 *               description: |
 *                 Main CTA code for Job Details (app owns button text).
 *                 REQUEST_SITE_VISIT / UPDATE_SITE_VISIT → site visit sheet;
 *                 SUBMIT_QUOTE / UPDATE_QUOTE → quote API;
 *                 REQUEST_JOB → request API then Home Waiting;
 *                 WAITING_FOR_CUSTOMER → waiting UI only;
 *                 BACK_TO_JOB → leave detail
 *             siteVisit:
 *               $ref: '#/components/schemas/TraderSiteVisitBlock'
 *             customer:
 *               type: object
 *               description: Customer summary on the job
 *               properties:
 *                 id: { type: string, format: uuid, description: Customer user id }
 *                 fullName: { type: string, description: Display name }
 *                 profilePhotoUrl: { type: string, nullable: true, description: Profile image URL }
 *                 isVerified: { type: boolean, description: true if mobile or email verified }
 *             category:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 name: { type: string, description: Category name }
 *                 iconName: { type: string, nullable: true, description: Optional icon key; prefer iconUrl }
 *                 iconUrl: { type: string, nullable: true, description: Fetchable category icon URL }
 *             subcategory:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 name: { type: string }
 *                 iconUrl: { type: string, nullable: true, description: Fetchable subcategory icon URL }
 *             tags:
 *               type: array
 *               description: Category/subcategory chips for UI
 *               items:
 *                 type: object
 *                 properties:
 *                   label: { type: string, description: Chip text (category/subcategory name) }
 *                   icon: { type: string, nullable: true, description: Same as iconUrl }
 *                   iconUrl: { type: string, nullable: true, description: Image URL for chip icon }
 *                   iconName: { type: string, nullable: true, description: Raw name key; prefer iconUrl }
 *             scheduledDate:
 *               type: string
 *               format: date-time
 *               nullable: true
 *               description: Customer preferred scheduled datetime if set
 *             timeSlot:
 *               type: string
 *               nullable: true
 *               description: Customer preferred slot text on the job (not trader site-visit enum)
 *             durationLabel:
 *               type: string
 *               nullable: true
 *               description: Optional duration text from job e.g. 1 Hour
 *             location:
 *               type: object
 *               description: Map / distance block
 *               properties:
 *                 areaName: { type: string }
 *                 distanceKm: { type: number, description: Distance in km }
 *                 latitude: { type: number }
 *                 longitude: { type: number }
 *                 mapPreviewUrl: { type: string, description: Embeddable map preview URL }
 *     TraderSiteVisitSlots:
 *       type: object
 *       description: Response of GET /traders/jobs/discover/{id}/site-visit/slots (bottom sheet data)
 *       properties:
 *         jobId:
 *           type: string
 *           format: uuid
 *           description: Job id
 *         title:
 *           type: string
 *           example: Site Visit Date & Time
 *           description: Optional screen title hint; app may ignore and use local copy
 *         dates:
 *           type: array
 *           description: Selectable calendar dates (next ~14 days)
 *           items:
 *             type: object
 *             properties:
 *               date: { type: string, description: YYYY-MM-DD }
 *               month: { type: string, description: Short month e.g. OCT }
 *               day: { type: integer, description: Day of month }
 *               weekday: { type: string, description: Short weekday e.g. THU }
 *         timeSlots:
 *           type: array
 *           description: Fixed time windows — app maps id to button labels
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 enum: [MORNING, AFTERNOON, EVENING, ANYTIME]
 *                 description: Slot code to send in POST body timeSlot
 *               startTime: { type: string, description: HH:mm start }
 *               endTime: { type: string, description: HH:mm end }
 *               icon: { type: string, description: Icon key for UI e.g. sun, moon, clock }
 *         selected:
 *           type: object
 *           nullable: true
 *           description: Currently selected date+slot if any
 *           properties:
 *             date: { type: string, description: YYYY-MM-DD }
 *             timeSlot: { type: string, description: MORNING | AFTERNOON | EVENING | ANYTIME }
 *         proposedSlots:
 *           type: array
 *           description: Saved SITE VISIT SLOTS list for this trader (edit/delete locally then resubmit full slots[])
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, description: Slot id }
 *               date: { type: string, description: YYYY-MM-DD }
 *               timeSlot: { type: string, description: Slot code }
 *               startTime: { type: string }
 *               endTime: { type: string }
 *               isSelected: { type: boolean }
 *         mode:
 *           type: string
 *           enum: [REQUEST, RESCHEDULE]
 *           description: REQUEST = first/update proposal; RESCHEDULE = reschedule flow. App chooses CTA copy
 *     TraderSiteVisitRequestBody:
 *       type: object
 *       description: |
 *         Body for POST site-visit/request or reschedule.
 *         Prefer slots[]. Legacy single date + timeSlot still accepted.
 *       properties:
 *         slots:
 *           type: array
 *           description: Full list of preferred slots to save (replaces previous proposed slots)
 *           items:
 *             type: object
 *             required: [date, timeSlot]
 *             properties:
 *               date:
 *                 type: string
 *                 example: '2026-10-24'
 *                 description: Visit date YYYY-MM-DD
 *               timeSlot:
 *                 type: string
 *                 enum: [MORNING, AFTERNOON, EVENING, ANYTIME]
 *                 description: Time window code from GET slots timeSlots[].id
 *         date:
 *           type: string
 *           description: Legacy single-slot date YYYY-MM-DD (use with timeSlot)
 *         timeSlot:
 *           type: string
 *           enum: [MORNING, AFTERNOON, EVENING, ANYTIME]
 *           description: Legacy single-slot time window
 *     TraderQuoteRequestBody:
 *       type: object
 *       required: [amount]
 *       description: Body for POST .../quotes (submit or update)
 *       properties:
 *         amount:
 *           type: number
 *           example: 450
 *           description: Quotation amount in EUR (must be positive)
 *         notes:
 *           type: string
 *           example: Includes parts and labour
 *           description: Optional notes shown to the customer
 *     TraderQuoteResponse:
 *       type: object
 *       description: Quote upsert result — job stays on Discover until customer confirms
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Quote id
 *         jobId:
 *           type: string
 *           format: uuid
 *           description: Job id
 *         amount:
 *           type: number
 *           example: 450
 *           description: Saved quoted amount EUR
 *         notes:
 *           type: string
 *           nullable: true
 *           description: Saved notes
 *         status:
 *           type: string
 *           example: PENDING
 *           description: Quote status after save (PENDING until customer accepts)
 *         hasSubmittedQuote:
 *           type: boolean
 *           description: Always true after a successful quote submit/update
 *         canUpdateQuote:
 *           type: boolean
 *           description: true if trader may call quotes again to change amount
 *         isJobRequested:
 *           type: boolean
 *           description: true if Request Job was already called
 *         isWaitingForCustomerConfirmation:
 *           type: boolean
 *           description: true if waiting on customer after Request Job
 *     TraderRequestJobBody:
 *       type: object
 *       description: Optional body for POST /traders/jobs/discover/{id}/request
 *       properties:
 *         amount:
 *           type: number
 *           description: Optional if quote already exists; otherwise required to create quote + request
 *         notes:
 *           type: string
 *           description: Optional notes when creating/updating quote during request
 */
export {};
