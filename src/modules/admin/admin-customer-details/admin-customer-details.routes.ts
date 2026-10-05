import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-customer-details.controller';
import {
  customerActivityQuerySchema,
  customerAddressesQuerySchema,
  customerChatThreadParamSchema,
  customerChatsQuerySchema,
  customerDetailsIdParamSchema,
  customerJobIdParamSchema,
  customerJobsQuerySchema,
  customerNotificationsQuerySchema,
  customerOffersQuerySchema,
  customerPaymentsQuerySchema,
  customerPropertiesQuerySchema,
  customerPropertyIdParamSchema,
  customerReviewsQuerySchema,
} from './admin-customer-details.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * tags:
 *   - name: Admin / Customer Details
 *     description: |
 *       Nested APIs for Customer Details tabs (Overview KPIs, Addresses, Jobs, Payments,
 *       Offers, Reviews, Notifications, Activity, Chats). Profile CRUD stays on
 *       GET/PATCH /admin/customers/{id}. Auth: admin Bearer.
 */

/**
 * @swagger
 * /admin/customers/{id}/stats:
 *   get:
 *     summary: Customer details overview KPIs
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/stats',
  validate(customerDetailsIdParamSchema),
  controller.getStats
);

/**
 * @swagger
 * /admin/customers/{id}/verification:
 *   get:
 *     summary: Email/phone verification + deletion request summary
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/verification',
  validate(customerDetailsIdParamSchema),
  controller.getVerification
);

/**
 * @swagger
 * /admin/customers/{id}/addresses:
 *   get:
 *     summary: List saved addresses for a customer
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: addressType
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, city, addressType] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 */
router.get(
  '/customers/:id/addresses',
  validate(customerAddressesQuerySchema),
  controller.listAddresses
);

/**
 * @swagger
 * /admin/customers/{id}/properties:
 *   get:
 *     summary: Customer properties list (Property Details tab)
 *     description: |
 *       Customer's saved properties (My Property). `data` is an array; pagination in `meta`.
 *       Each row: address fields, `fullAddress`, `isPrimary`, `mprnNumber` / `gprnNumber` / `utnNumber`,
 *       `metersCount`, `activeSubscriptionsCount`, `jobsCount`.
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         description: Property name, address line, city, county or eircode
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, propertyName, city], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Customer properties retrieved successfully.
 *               data:
 *                 - id: 7c1d2e3f-0000-4000-8000-000000000001
 *                   propertyName: Home
 *                   label: Home
 *                   addressId: 8d2e3f40-0000-4000-8000-000000000002
 *                   addressType: Home
 *                   houseNumber: '12'
 *                   addressLine1: Main Street
 *                   addressLine2: null
 *                   city: Dublin
 *                   county: Dublin
 *                   eircode: D02 X285
 *                   country: Ireland
 *                   fullAddress: 12 Main Street, Dublin, Dublin, D02 X285
 *                   latitude: 53.3498
 *                   longitude: -6.2603
 *                   mapImageUrl: null
 *                   isPrimary: true
 *                   mprnNumber: '10012345678'
 *                   gprnNumber: '1234567'
 *                   utnNumber: null
 *                   metersCount: 2
 *                   activeSubscriptionsCount: 2
 *                   jobsCount: 3
 *                   createdAt: '2026-09-20T10:00:00.000Z'
 *                   updatedAt: '2026-09-20T10:00:00.000Z'
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       404: { description: Customer not found. }
 */
router.get(
  '/customers/:id/properties',
  validate(customerPropertiesQuerySchema),
  controller.listProperties
);

/**
 * @swagger
 * /admin/customers/{id}/properties/{propertyId}:
 *   get:
 *     summary: Customer property detail
 *     description: |
 *       Same fields as the list row plus:
 *       - `meters[]` — electricity (MPRN) / gas (GPRN) meters with full `readings[]` history (latest first)
 *       - `subscriptions[]` — utility provider subscriptions (active and cancelled, with `status`)
 *       - `jobs[]` — jobs posted at this property's address (latest first)
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Customer property retrieved successfully.
 *               data:
 *                 id: 7c1d2e3f-0000-4000-8000-000000000001
 *                 propertyName: Home
 *                 fullAddress: 12 Main Street, Dublin, Dublin, D02 X285
 *                 isPrimary: true
 *                 mprnNumber: '10012345678'
 *                 gprnNumber: '1234567'
 *                 utnNumber: null
 *                 meters:
 *                   - id: 9e3f4051-0000-4000-8000-000000000003
 *                     meterType: electricity
 *                     referenceLabel: MPRN
 *                     referenceNumber: '10012345678'
 *                     serialNumber: null
 *                     unitLabel: kWh
 *                     readingsCount: 1
 *                     readings:
 *                       - id: a0405162-0000-4000-8000-000000000004
 *                         value: 15234.5
 *                         readingDate: '2026-10-01T09:00:00.000Z'
 *                         status: pending
 *                         photoUrl: null
 *                         createdAt: '2026-10-01T09:00:00.000Z'
 *                 subscriptions:
 *                   - id: b1516273-0000-4000-8000-000000000005
 *                     serviceType: electricity
 *                     serviceLabel: Electricity
 *                     status: active
 *                     accountNumber: null
 *                     provider: { id: c2627384-0000-4000-8000-000000000006, name: Electric Ireland, logoUrl: null, iconUrl: null }
 *                     createdAt: '2026-09-20T10:00:00.000Z'
 *                 jobsCount: 1
 *                 jobs:
 *                   - id: d3738495-0000-4000-8000-000000000007
 *                     jobRef: JOB-411A
 *                     title: Boiler Repair
 *                     status: COMPLETED
 *                     scheduledDate: '2026-10-02T00:00:00.000Z'
 *                     createdAt: '2026-09-28T10:00:00.000Z'
 *                     trader: { id: e48495a6-0000-4000-8000-000000000008, businessName: Wilson Electrics }
 *       404: { description: Customer or property not found. }
 */
router.get(
  '/customers/:id/properties/:propertyId',
  validate(customerPropertyIdParamSchema),
  controller.getProperty
);

/**
 * @swagger
 * /admin/customers/{id}/jobs/stats:
 *   get:
 *     summary: Customer jobs status breakdown
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/jobs/stats',
  validate(customerDetailsIdParamSchema),
  controller.getJobsStats
);

/**
 * @swagger
 * /admin/customers/{id}/jobs:
 *   get:
 *     summary: List customer jobs / bookings
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, QUOTED, ACCEPTED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, PAYMENT_PENDING]
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, scheduledDate, status, title] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/jobs',
  validate(customerJobsQuerySchema),
  controller.listJobs
);

/**
 * @swagger
 * /admin/customers/{id}/jobs/{jobId}:
 *   get:
 *     summary: Customer job detail (drawer payload)
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/jobs/:jobId',
  validate(customerJobIdParamSchema),
  controller.getJob
);

/**
 * @swagger
 * /admin/customers/{id}/jobs/{jobId}/site-visits:
 *   get:
 *     summary: Traders who requested a site visit on this customer's job
 *     description: |
 *       Full list (no pagination) — one row per trader, oldest request first.
 *       Same item shape and statuses as `GET /admin/traders/{id}/site-visits` and `GET /traders/site-visits`.
 *
 *       **status** (`statusLabel`):
 *       - `PENDING` (Waiting for Customer) · `CONFIRMED` (Visit Confirmed) · `RESCHEDULE_REQUIRED` (Reschedule Requested)
 *         → `group: REQUESTED`
 *       - `COMPLETED` (Site Visited) → `group: VISITED`
 *       - `CANCELLED` (Cancelled) · `CLOSED` (Closed — job cancelled/completed or awarded to another trader,
 *         see `closedReason`) → `group: CLOSED`
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Site visit requests for the job.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Job site visit requests retrieved successfully. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     job:
 *                       type: object
 *                       example: { id: 1f2e3d4c-5b6a-4789-8abc-def012345678, jobRef: JOB-1042, title: Boiler not heating, status: PUBLISHED }
 *                     summary: { $ref: '#/components/schemas/SiteVisitSummary' }
 *                     items:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/SiteVisitItem' }
 *       404:
 *         description: Customer or job not found.
 */
router.get(
  '/customers/:id/jobs/:jobId/site-visits',
  validate(customerJobIdParamSchema),
  controller.getJobSiteVisits
);

/**
 * @swagger
 * /admin/customers/{id}/payments/stats:
 *   get:
 *     summary: Customer payments KPIs
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/payments/stats',
  validate(customerDetailsIdParamSchema),
  controller.getPaymentsStats
);

/**
 * @swagger
 * /admin/customers/{id}/payments:
 *   get:
 *     summary: List customer payments / transactions
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, COMPLETED, FAILED] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, amount, status, paidAt] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/payments',
  validate(customerPaymentsQuerySchema),
  controller.listPayments
);

/**
 * @swagger
 * /admin/customers/{id}/refunds:
 *   get:
 *     summary: List customer refunds
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, amount, status] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/refunds',
  validate(customerPaymentsQuerySchema),
  controller.listRefunds
);

/**
 * @swagger
 * /admin/customers/{id}/offers/stats:
 *   get:
 *     summary: Customer offer claims KPIs
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/offers/stats',
  validate(customerDetailsIdParamSchema),
  controller.getOffersStats
);

/**
 * @swagger
 * /admin/customers/{id}/offers:
 *   get:
 *     summary: List customer claimed / used offers
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string, enum: [ALL, CLAIMED, USED, EXPIRED, CANCELLED] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [CLAIMED, USED, EXPIRED, CANCELLED] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [claimedAt, usedAt, status] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/offers',
  validate(customerOffersQuerySchema),
  controller.listOffers
);

/**
 * @swagger
 * /admin/customers/{id}/reviews/stats:
 *   get:
 *     summary: Customer reviews average + star distribution
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/reviews/stats',
  validate(customerDetailsIdParamSchema),
  controller.getReviewsStats
);

/**
 * @swagger
 * /admin/customers/{id}/reviews:
 *   get:
 *     summary: List reviews given by customer
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: stars
 *         schema: { type: string, enum: ['1', '2', '3', '4', '5'] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, stars] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/reviews',
  validate(customerReviewsQuerySchema),
  controller.listReviews
);

/**
 * @swagger
 * /admin/customers/{id}/notifications:
 *   get:
 *     summary: List customer notifications
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: read
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/notifications',
  validate(customerNotificationsQuerySchema),
  controller.listNotifications
);

/**
 * @swagger
 * /admin/customers/{id}/notifications/read-all:
 *   patch:
 *     summary: Mark all customer notifications as read
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.patch(
  '/customers/:id/notifications/read-all',
  validate(customerDetailsIdParamSchema),
  controller.markNotificationsRead
);

/**
 * @swagger
 * /admin/customers/{id}/activity:
 *   get:
 *     summary: Customer activity timeline (audit logs)
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: eventType
 *         schema: { type: string }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/activity',
  validate(customerActivityQuerySchema),
  controller.listActivity
);

/**
 * @swagger
 * /admin/customers/{id}/chats:
 *   get:
 *     summary: List customer chat conversations (grouped by job)
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/chats',
  validate(customerChatsQuerySchema),
  controller.listChats
);

/**
 * @swagger
 * /admin/customers/{id}/chats/{jobId}:
 *   get:
 *     summary: Customer chat thread for a job
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 */
router.get(
  '/customers/:id/chats/:jobId',
  validate(customerChatThreadParamSchema),
  controller.getChatThread
);

export default router;
