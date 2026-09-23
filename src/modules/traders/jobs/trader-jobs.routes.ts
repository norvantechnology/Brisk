import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './trader-jobs.controller';
import {
  discoverJobDetailQuerySchema,
  discoverJobIdParamSchema,
  discoverJobsQuerySchema,
  siteVisitRequestBodySchema,
  discoverQuoteBodySchema,
  discoverRequestJobBodySchema,
} from './trader-jobs.validation';

const router = Router();

/**
 * @swagger
 * /traders/jobs/discover:
 *   get:
 *     summary: Nearby Opportunities job list (Discover tab)
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Discover feed cards. data is a job array — use data.length for "X jobs found".
 *       badge Site Visit | Reschedule | null. Format Posted ago from createdAt on app.
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string, example: Solar }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: radiusKm
 *         schema: { type: number, example: 10 }
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: siteVisit
 *         schema: { type: boolean }
 *         description: When true, only site-visit jobs
 *       - in: query
 *         name: urgent
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Job card array
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/TraderDiscoverJobCard' }
 *             example:
 *               success: true
 *               message: Nearby opportunities retrieved successfully.
 *               data:
 *                 - id: 8a8fb0e5-a330-4c62-8e76-a358bd792b84
 *                   title: Solar Panel Installation
 *                   badge: Site Visit
 *                   distanceKm: 2.5
 *                   areaName: Dublin 2
 *                   siteVisitFee: 30
 *                   minBudget: null
 *                   maxBudget: null
 *                   serviceCharge: null
 *                   currencyCode: EUR
 *                   currencySymbol: €
 *                   createdAt: '2026-09-15T10:00:00.000Z'
 *                   isBookmarked: false
 *                   isSiteVisit: true
 *                   hasSubmittedQuote: false
 *                   canUpdateQuote: false
 *                   canSubmitQuote: false
 *                   isJobRequested: false
 *                   isWaitingForCustomerConfirmation: false
 *                   quoteAmount: null
 *                 - id: 11111111-1111-1111-1111-111111111112
 *                   title: Full Bathroom Re-tiling
 *                   badge: null
 *                   distanceKm: 5.1
 *                   areaName: Rathmines
 *                   siteVisitFee: null
 *                   minBudget: 800
 *                   maxBudget: 1200
 *                   serviceCharge: null
 *                   currencyCode: EUR
 *                   currencySymbol: €
 *                   createdAt: '2026-09-15T09:00:00.000Z'
 *                   isBookmarked: false
 *                   isSiteVisit: false
 *                   hasSubmittedQuote: true
 *                   canUpdateQuote: true
 *                   canSubmitQuote: false
 *                   isJobRequested: false
 *                   isWaitingForCustomerConfirmation: false
 *                   quoteAmount: 420
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a trader
 */
router.get('/discover', validate(discoverJobsQuerySchema), controller.listDiscoverJobs);

/**
 * @swagger
 * /traders/jobs/waiting:
 *   get:
 *     summary: Home Active/Waiting cards (awaiting customer confirmation)
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Blue Waiting cards for Home. Jobs this trader requested via Request Job
 *       that are still PUBLISHED and unassigned (customer has not confirmed yet).
 *       After customer confirms, job leaves this list and appears in My Jobs ACTIVE.
 *     responses:
 *       200:
 *         description: Waiting job cards
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/TraderWaitingJobsResponse' }
 *             example:
 *               success: true
 *               message: Waiting jobs retrieved successfully.
 *               data:
 *                 count: 1
 *                 items:
 *                   - id: 8a8fb0e5-a330-4c62-8e76-a358bd792b84
 *                     title: Full Bathroom Re-tiling
 *                     customerName: Jane Customer
 *                     areaName: Dublin
 *                     distanceKm: 2.1
 *                     quoteAmount: 420
 *                     statusBadge: Waiting
 *                     colorHint: blue
 *                     isJobRequested: true
 *                     isWaitingForCustomerConfirmation: true
 *                     hasSubmittedQuote: true
 *                     requestedAt: '2026-09-15T12:00:00.000Z'
 *                     primaryAction: WAITING_FOR_CUSTOMER
 */
router.get('/waiting', controller.listWaitingJobs);

/**
 * @swagger
 * /traders/jobs/discover/{id}/site-visit/slots:
 *   get:
 *     summary: Site Visit Date and Time bottom sheet
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Opens from Select Date and Time.
 *       dates = horizontal strip. timeSlots = Morning Afternoon Evening Any time.
 *       Use mode REQUEST | RESCHEDULE; button copy is owned by the app.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dates and slots for bottom sheet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/TraderSiteVisitSlots' }
 *             example:
 *               success: true
 *               message: Site visit slots retrieved successfully.
 *               data:
 *                 jobId: 8a8fb0e5-a330-4c62-8e76-a358bd792b84
 *                 title: Site Visit Date & Time
 *                 dates:
 *                   - { date: '2026-09-15', month: SEP, day: 15, weekday: TUE }
 *                   - { date: '2026-09-16', month: SEP, day: 16, weekday: WED }
 *                 timeSlots:
 *                   - { id: MORNING, startTime: '08:00', endTime: '12:00', icon: sun }
 *                   - { id: AFTERNOON, startTime: '12:00', endTime: '17:00', icon: sun_cloud }
 *                   - { id: EVENING, startTime: '17:00', endTime: '21:00', icon: moon }
 *                   - { id: ANYTIME, startTime: '08:00', endTime: '21:00', icon: clock }
 *                 selected: null
 *                 mode: REQUEST
 *       400:
 *         description: Job is not a site-visit job
 *       404:
 *         description: Job not found
 */
router.get(
  '/discover/:id/site-visit/slots',
  validate(discoverJobIdParamSchema),
  controller.getSiteVisitSlots
);

/**
 * @swagger
 * /traders/jobs/discover/{id}/site-visit/request:
 *   post:
 *     summary: Request For Site Visit
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Submit date + timeSlot (or slots[]) from bottom sheet.
 *       Creates/updates visit as **PENDING** (waiting for customer to confirm).
 *       Response: `siteVisit.status=PENDING`, `primaryAction=WAITING_FOR_CONFIRMATION`.
 *       After customer confirms → `CONFIRMED` + `primaryAction=BACK_TO_JOB` (Confirmed Job Details screen).
 *       Already `CONFIRMED` → 409 — use reschedule endpoint.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TraderSiteVisitRequestBody' }
 *           example:
 *             slots:
 *               - { date: '2026-09-16', timeSlot: AFTERNOON }
 *               - { date: '2026-09-17', timeSlot: MORNING }

 *     responses:
 *       200:
 *         description: Slots proposed — status PENDING, waiting for customer confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/TraderDiscoverJobDetail' }
 *       409:
 *         description: Already confirmed — use reschedule endpoint
 *       400:
 *         description: Validation or not a site-visit job
 *       404:
 *         description: Job not found
 */
router.post(
  '/discover/:id/site-visit/request',
  validate(siteVisitRequestBodySchema),
  controller.requestSiteVisit
);

/**
 * @swagger
 * /traders/jobs/discover/{id}/site-visit/reschedule:
 *   post:
 *     summary: Request For Reschedule Site Visit
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Same body as request. For existing visit in RESCHEDULE_REQUIRED (or past preferred date).
 *       Sets visit to **PENDING** again (new slots proposed → wait for customer).
 *       Response: `primaryAction=WAITING_FOR_CONFIRMATION`.
 *       After customer confirms → `CONFIRMED` + `BACK_TO_JOB` (Confirmed / Rescheduled Confirmed screen).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TraderSiteVisitRequestBody' }
 *           example:
 *             slots:
 *               - { date: '2026-09-18', timeSlot: MORNING }
 *               - { date: '2026-09-19', timeSlot: EVENING }

 *     responses:
 *       200:
 *         description: New slots proposed — PENDING, waiting for customer confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/TraderDiscoverJobDetail' }
 *       400:
 *         description: No existing site visit to reschedule
 *       404:
 *         description: Job not found
 */
router.post(
  '/discover/:id/site-visit/reschedule',
  validate(siteVisitRequestBodySchema),
  controller.rescheduleSiteVisit
);

/**
 * @swagger
 * /traders/jobs/discover/{id}/quotes:
 *   post:
 *     summary: Submit Quote from Job Details
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Use when Discover Job Details has canSubmitQuote or canUpdateQuote.
 *       Job stays PUBLISHED on Discover (does not move to My Jobs).
 *       Response includes hasSubmittedQuote / canUpdateQuote flags.
 *       Alias: POST /traders/jobs/mine/{id}/quotes
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Job id from Discover Job Details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TraderQuoteRequestBody'
 *           example:
 *             amount: 450
 *             notes: Includes parts and labour
 *     responses:
 *       200:
 *         description: Quote submitted (PENDING). Job stays on Discover.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Quote submitted successfully. }
 *                 data:
 *                   allOf:
 *                     - { $ref: '#/components/schemas/TraderQuoteResponse' }
 *                     - type: object
 *                       properties:
 *                         hasSubmittedQuote: { type: boolean, example: true }
 *                         canUpdateQuote: { type: boolean, example: true }
 *                         isJobRequested: { type: boolean, example: false }
 *                         isWaitingForCustomerConfirmation: { type: boolean, example: false }
 *             example:
 *               success: true
 *               message: Quote submitted successfully.
 *               data:
 *                 id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
 *                 jobId: 8a8fb0e5-a330-4c62-8e76-a358bd792b84
 *                 amount: 450
 *                 notes: Includes parts and labour
 *                 status: PENDING
 *                 hasSubmittedQuote: true
 *                 canUpdateQuote: true
 *                 isJobRequested: false
 *                 isWaitingForCustomerConfirmation: false
 *       400:
 *         description: Invalid amount
 *       404:
 *         description: Job not found or no longer available for quoting
 *       409:
 *         description: Job already assigned to another trader
 */
router.post(
  '/discover/:id/quotes',
  validate(discoverQuoteBodySchema),
  controller.submitDiscoverQuote
);

/**
 * @swagger
 * /traders/jobs/discover/{id}/request:
 *   post:
 *     summary: Request / Accept Job (wait for customer confirmation)
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       After quotation (and site-visit slots if required), trader requests the job.
 *       Does NOT assign the trader. Job stays on Discover with
 *       isJobRequested / isWaitingForCustomerConfirmation = true.
 *       App should return to Home and show blue Waiting card (GET /traders/jobs/waiting).
 *       Only customer confirm moves the job to My Jobs ACTIVE.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number, description: Optional if quote already submitted }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Job requested — waiting for customer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Job requested. Waiting for customer confirmation. }
 *                 data: { $ref: '#/components/schemas/TraderDiscoverJobDetail' }
 *             example:
 *               success: true
 *               message: Job requested. Waiting for customer confirmation.
 *               data:
 *                 id: 8a8fb0e5-a330-4c62-8e76-a358bd792b84
 *                 title: Full Bathroom Re-tiling
 *                 hasSubmittedQuote: true
 *                 canUpdateQuote: true
 *                 canSubmitQuote: false
 *                 canRequestJob: false
 *                 isJobRequested: true
 *                 isWaitingForCustomerConfirmation: true
 *                 quoteAmount: 420
 *                 primaryAction: WAITING_FOR_CUSTOMER
 *       400:
 *         description: Missing quote amount or site-visit slots
 */
router.post(
  '/discover/:id/request',
  validate(discoverRequestJobBodySchema),
  controller.requestDiscoverJob
);

/**
 * @swagger
 * /traders/jobs/discover/{id}:
 *   get:
 *     summary: Job Details (Site Visit / Quote / Request / Waiting)
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Purpose:** Single Discover Job Details API for marketplace jobs (not yet fully assigned
 *       in My Jobs progress). Powers Site Visit / Quote / Accept / Waiting screens from Figma.
 *
 *       Drive UI from `primaryAction` + `siteVisit.status` + flags below — do not invent local state.
 *
 *       | primaryAction | Screen / CTA |
 *       |---|---|
 *       | REQUEST_SITE_VISIT | Select Date & Time + Request For Site Visit |
 *       | WAITING_FOR_CONFIRMATION | Slots sent — waiting customer (PENDING) |
 *       | REQUEST_RESCHEDULE | RESCHEDULE REQUESTED + Request For Reschedule |
 *       | BACK_TO_JOB | CONFIRMED visit — Back to Job |
 *       | SUBMIT_QUOTE / UPDATE_QUOTE | Normal quote flow |
 *       | REQUEST_JOB / WAITING_FOR_CUSTOMER | Accept / Request Job + waiting |
 *
 *       Key flags: `isSiteVisit`, `isSiteVisitDone`, `isReschedule`, `visitStatusBadge`,
 *       `visitSectionLabel`, `canSelectDateTime`, `canRequestSiteVisit`, `canRequestReschedule`,
 *       `canSubmitQuote`, `canAcceptJob` (= `canRequestJob`), `isWaitingForCustomerConfirmation`.
 *
 *       After customer assigns trader → use My Jobs (`/traders/jobs/mine/{id}`).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Full job detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/TraderDiscoverJobDetail' }
 *             example:
 *               success: true
 *               message: Job details retrieved successfully.
 *               data:
 *                 id: 8a8fb0e5-a330-4c62-8e76-a358bd792b84
 *                 title: Solar Panel Installation
 *                 badge: Site Visit
 *                 distanceKm: 1.8
 *                 areaName: Dublin 6
 *                 siteVisitFee: null
 *                 minBudget: null
 *                 maxBudget: null
 *                 serviceCharge: null
 *                 currencyCode: EUR
 *                 currencySymbol: €
 *                 createdAt: '2026-09-15T10:00:00.000Z'
 *                 isBookmarked: false
 *                 isSiteVisit: false
 *                 hasSubmittedQuote: true
 *                 canUpdateQuote: true
 *                 canSubmitQuote: false
 *                 canRequestJob: true
 *                 isJobRequested: false
 *                 isWaitingForCustomerConfirmation: false
 *                 quoteId: a1b2c3d4-e5f6-7890-abcd-ef1234567890
 *                 quoteAmount: 420
 *                 quoteNotes: Includes parts and labour
 *                 quoteStatus: PENDING
 *                 description: Looking for a professional to install solar panels.
 *                 photos: ['https://cdn.example.com/roof1.jpg']
 *                 photoCount: 1
 *                 isReschedule: false
 *                 canSelectDateTime: false
 *                 canRequestSiteVisit: false
 *                 canRequestReschedule: false
 *                 primaryAction: REQUEST_JOB
 *                 siteVisit:
 *                   status: NONE
 *                   visitDate: null
 *                   timeSlot: null
 *                   startTime: null
 *                   endTime: null
 *                   requestId: null
 *                   slots: []
 *                   slotCount: 0
 *                 customer:
 *                   id: uuid
 *                   fullName: Sarah Jenkins
 *                   profilePhotoUrl: null
 *                   isVerified: true
 *                 category: { id: uuid, name: Solar, iconName: sun }
 *                 subcategory: null
 *                 categoryName: Solar
 *                 subcategoryName: null
 *                 tags: [{ label: Solar, icon: sun }]
 *                 scheduledDate: null
 *                 timeSlot: null
 *                 durationLabel: null
 *                 location:
 *                   fullAddress: 8 Bypass Circle, Idar Road, 383110
 *                   areaName: Dublin 6
 *                   distanceKm: 1.8
 *                   latitude: 53.34
 *                   longitude: -6.27
 *                   mapPreviewUrl: https://www.openstreetmap.org/export/embed.html?...
 *       404:
 *         description: Job not found or no longer available
 */
router.get(
  '/discover/:id',
  validate(discoverJobDetailQuerySchema),
  controller.getDiscoverJob
);

/**
 * @swagger
 * /traders/jobs/discover/{id}/bookmark:
 *   post:
 *     summary: Bookmark a nearby job
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Bookmarked
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job bookmarked successfully.
 *               data: { id: '8a8fb0e5-a330-4c62-8e76-a358bd792b84', isBookmarked: true }
 *   delete:
 *     summary: Remove job bookmark
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Bookmark removed
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job bookmark removed successfully.
 *               data: { id: '8a8fb0e5-a330-4c62-8e76-a358bd792b84', isBookmarked: false }
 */
router.post(
  '/discover/:id/bookmark',
  validate(discoverJobIdParamSchema),
  controller.bookmarkDiscoverJob
);
router.delete(
  '/discover/:id/bookmark',
  validate(discoverJobIdParamSchema),
  controller.unbookmarkDiscoverJob
);

export default router;
