import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './trader-jobs.controller';
import {
  discoverJobDetailQuerySchema,
  discoverJobIdParamSchema,
  discoverJobsQuerySchema,
  siteVisitRequestBodySchema,
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
 *                   priceLabel: "€30"
 *                   createdAt: '2026-09-15T10:00:00.000Z'
 *                   isBookmarked: false
 *                   isSiteVisit: true
 *                 - id: 11111111-1111-1111-1111-111111111112
 *                   title: Full Bathroom Re-tiling
 *                   badge: Reschedule
 *                   distanceKm: 5.1
 *                   areaName: Rathmines
 *                   priceLabel: "€800 - €1,200"
 *                   createdAt: '2026-09-15T09:00:00.000Z'
 *                   isBookmarked: false
 *                   isSiteVisit: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a trader
 */
router.get('/discover', validate(discoverJobsQuerySchema), controller.listDiscoverJobs);

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
 *       Use mode + submitLabel for Request vs Reschedule CTA on the sheet.
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
 *                   - { id: MORNING, label: Morning, startTime: '08:00', endTime: '12:00', rangeLabel: '08:00 - 12:00', icon: sun }
 *                   - { id: AFTERNOON, label: Afternoon, startTime: '12:00', endTime: '17:00', rangeLabel: '12:00 - 17:00', icon: sun_cloud }
 *                   - { id: EVENING, label: Evening, startTime: '17:00', endTime: '21:00', rangeLabel: '17:00 - 21:00', icon: moon }
 *                   - { id: ANYTIME, label: Any time, startTime: '08:00', endTime: '21:00', rangeLabel: '08:00 - 21:00', icon: clock }
 *                 selected: null
 *                 mode: REQUEST
 *                 submitLabel: Request For Site Visit
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
 *       Submit date + timeSlot from bottom sheet.
 *       MVP auto-confirms. Response is full Job Details with siteVisit.status CONFIRMED
 *       and primaryAction BACK_TO_JOB.
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
 *           example: { date: '2026-09-16', timeSlot: AFTERNOON }
 *     responses:
 *       200:
 *         description: Confirmed — open Confirmed Job Details
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
 *       Same body as request. Requires an existing site visit (any non-cancelled).
 *       Sets CONFIRMED with new slot. Response primaryAction BACK_TO_JOB.
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
 *           example: { date: '2026-09-17', timeSlot: MORNING }
 *     responses:
 *       200:
 *         description: Reschedule confirmed
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
 * /traders/jobs/discover/{id}:
 *   get:
 *     summary: Job Details (Site Visit / Reschedule / Confirmed)
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       One payload for all Job Details screens.
 *
 *       UI mapping:
 *       - siteVisit.status NONE + canSelectDateTime → Select Date and Time + Request For Site Visit
 *       - siteVisit.status RESCHEDULE_REQUIRED → orange badge + Select Date and Time + Request For Reschedule
 *       - siteVisit.status CONFIRMED → green CONFIRMED + displayLabel + Back to Job
 *
 *       Always present keys listed in TraderDiscoverJobDetail schema.
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
 *                 priceLabel: "€30"
 *                 createdAt: '2026-09-15T10:00:00.000Z'
 *                 isBookmarked: false
 *                 isSiteVisit: true
 *                 description: Looking for a professional to install solar panels.
 *                 photos: ['https://cdn.example.com/roof1.jpg']
 *                 photoCount: 1
 *                 photosSectionTitle: Customer Photos (1)
 *                 photosHint: null
 *                 siteVisitFeeTitle: SITE VISIT FEE
 *                 siteVisitFee: 30
 *                 siteVisitFeeLabel: "€30"
 *                 siteVisitFeeNote: This fee is paid to the platform to secure the visit and ensure high intent for both parties.
 *                 isReschedule: false
 *                 canSelectDateTime: true
 *                 canRequestSiteVisit: true
 *                 canRequestReschedule: false
 *                 selectDateTimeLabel: Select Date & Time
 *                 primaryAction: REQUEST_SITE_VISIT
 *                 primaryActionLabel: Request For Site Visit
 *                 siteVisit:
 *                   status: NONE
 *                   visitDate: null
 *                   timeSlot: null
 *                   timeSlotLabel: null
 *                   startTime: null
 *                   endTime: null
 *                   displayLabel: null
 *                   statusBadge: null
 *                   sectionTitle: null
 *                   requestId: null
 *                 serviceTermsNote: By accepting, you agree to the Service Terms.
 *                 customer:
 *                   id: uuid
 *                   fullName: Sarah Jenkins
 *                   profilePhotoUrl: null
 *                   isVerified: true
 *                   verifiedLabel: Verified Customer
 *                 category: { id: uuid, name: Solar, iconName: sun }
 *                 subcategory: null
 *                 categoryName: Solar
 *                 subcategoryName: null
 *                 tags: [{ label: Solar, icon: sun }]
 *                 scheduledDate: null
 *                 timeSlot: null
 *                 durationLabel: null
 *                 location:
 *                   areaName: Dublin 6
 *                   distanceKm: 1.8
 *                   distanceLabel: Approx. 1.8 km away
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
