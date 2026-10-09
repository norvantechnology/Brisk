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
  customerRefundsQuerySchema,
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
 *     description: Paginated saved addresses. `data` is an array; pagination in `meta`.
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         description: Label, address line 1, city, county or eircode
 *         schema: { type: string }
 *       - in: query
 *         name: addressType
 *         description: Exact address type (e.g. Home, Work)
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         description: Column to sort by (default `createdAt`). Unknown values return 400.
 *         schema: { type: string, enum: [label, addressType, addressLine1, city, county, eircode, country, isDefault, createdAt, updatedAt], default: createdAt }
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Customer addresses retrieved successfully.
 *               data:
 *                 - id: 8d2e3f40-0000-4000-8000-000000000002
 *                   label: Home
 *                   addressType: Home
 *                   houseNumber: '12'
 *                   addressLine1: Main Street
 *                   addressLine2: null
 *                   city: Dublin
 *                   county: Dublin
 *                   eircode: D02 X285
 *                   country: Ireland
 *                   latitude: 53.3498
 *                   longitude: -6.2603
 *                   mapImageUrl: null
 *                   isDefault: true
 *                   isPrimary: true
 *                   createdAt: '2026-09-20T10:00:00.000Z'
 *                   updatedAt: '2026-09-20T10:00:00.000Z'
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404: { description: Customer not found. }
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
 *         description: Column to sort by (default `createdAt`). Unknown values return 400.
 *         schema: { type: string, enum: [propertyName, addressLine1, city, county, eircode, country, metersCount, createdAt, updatedAt], default: createdAt }
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
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
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
 *     description: Paginated jobs posted by the customer. `data` is an array; pagination in `meta`.
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         description: Job ref, title, address, category, subcategory, trader business or full name
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, QUOTED, ACCEPTED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, PAYMENT_PENDING]
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/AdminDateFrom'
 *       - $ref: '#/components/parameters/AdminDateTo'
 *       - in: query
 *         name: sortBy
 *         description: Column to sort by (default `createdAt`). Unknown values return 400.
 *         schema: { type: string, enum: [jobRef, title, status, categoryName, traderName, city, postcode, serviceCharge, quotesCount, photosCount, scheduledDate, createdAt], default: createdAt }
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Customer jobs retrieved successfully.
 *               data:
 *                 - id: d3738495-0000-4000-8000-000000000007
 *                   jobRef: JOB-411A
 *                   title: Boiler Repair
 *                   status: COMPLETED
 *                   category: { id: f5a6b7c8-0000-4000-8000-000000000009, name: Plumbing }
 *                   subcategory: { id: a6b7c8d9-0000-4000-8000-000000000010, name: Boiler Service }
 *                   addressLine: 12 Main Street, Dublin
 *                   city: Dublin
 *                   postcode: D02 X285
 *                   scheduledDate: '2026-10-02T00:00:00.000Z'
 *                   createdAt: '2026-09-28T10:00:00.000Z'
 *                   serviceCharge: 120
 *                   siteVisitFee: null
 *                   siteVisitRequested: false
 *                   coverPhotoUrl: https://cdn.example.com/jobs/boiler.jpg
 *                   photosCount: 2
 *                   quotesCount: 3
 *                   trader:
 *                     id: e48495a6-0000-4000-8000-000000000008
 *                     traderCode: TRD-1001
 *                     businessName: Wilson Electrics
 *                     fullName: James Wilson
 *                     profilePhotoUrl: null
 *                   booking:
 *                     id: b7c8d9e0-0000-4000-8000-000000000011
 *                     bookingRef: BKG-2001
 *                     status: COMPLETED
 *                     invoiceId: c8d9e0f1-0000-4000-8000-000000000012
 *                     totalAmount: 147.6
 *                     invoiceStatus: PAID
 *                     currencyCode: EUR
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404: { description: Customer not found. }
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
 *     description: Paginated payments made by the customer. `data` is an array; pagination in `meta`.
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         description: Transaction ref, invoice number, job ref or trader business name
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, COMPLETED, FAILED] }
 *       - $ref: '#/components/parameters/AdminDateFrom'
 *       - $ref: '#/components/parameters/AdminDateTo'
 *       - in: query
 *         name: sortBy
 *         description: Column to sort by (default `createdAt`). Unknown values return 400.
 *         schema: { type: string, enum: [transactionRef, amount, status, method, billingType, invoiceNumber, jobRef, traderName, paidAt, createdAt], default: createdAt }
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Customer payments retrieved successfully.
 *               data:
 *                 - id: d9e0f1a2-0000-4000-8000-000000000013
 *                   transactionRef: TXN-30001
 *                   amount: 147.6
 *                   status: COMPLETED
 *                   method: CARD
 *                   billingType: INDIVIDUAL
 *                   paidAt: '2026-10-02T15:00:00.000Z'
 *                   createdAt: '2026-10-02T14:58:00.000Z'
 *                   currencyCode: EUR
 *                   invoice:
 *                     id: c8d9e0f1-0000-4000-8000-000000000012
 *                     invoiceNumber: INV-5001
 *                     totalAmount: 147.6
 *                     status: PAID
 *                   job: { id: d3738495-0000-4000-8000-000000000007, jobRef: JOB-411A, title: Boiler Repair }
 *                   trader:
 *                     id: e48495a6-0000-4000-8000-000000000008
 *                     businessName: Wilson Electrics
 *                     fullName: James Wilson
 *                   bookingRef: BKG-2001
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404: { description: Customer not found. }
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
 *     description: Paginated refunds for the customer. `data` is an array; pagination in `meta`.
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         description: Refund reason, or exact refund id (uuid)
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, COMPLETED, REJECTED] }
 *       - $ref: '#/components/parameters/AdminDateFrom'
 *       - $ref: '#/components/parameters/AdminDateTo'
 *       - in: query
 *         name: sortBy
 *         description: Column to sort by (default `createdAt`). Unknown values return 400.
 *         schema: { type: string, enum: [refundRef, transactionRef, amount, originalAmount, reason, status, processedAt, createdAt], default: createdAt }
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Customer refunds retrieved successfully.
 *               data:
 *                 - id: e0f1a2b3-0000-4000-8000-000000000014
 *                   refundRef: RFD-7001
 *                   amount: 50
 *                   originalAmount: 147.6
 *                   currencyCode: EUR
 *                   status: COMPLETED
 *                   reason: Partial work not completed
 *                   processedAt: '2026-10-05T11:00:00.000Z'
 *                   createdAt: '2026-10-04T09:00:00.000Z'
 *                   payment:
 *                     id: d9e0f1a2-0000-4000-8000-000000000013
 *                     transactionRef: TXN-30001
 *                     amount: 147.6
 *                     method: CARD
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404: { description: Customer not found. }
 */
router.get(
  '/customers/:id/refunds',
  validate(customerRefundsQuerySchema),
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
 *     description: |
 *       Paginated offer claims. `data` is an array; pagination in `meta`.
 *       `from`/`to` filter on `claimedAt`. `status` wins over `state` when both are sent.
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         description: Offer title, offer code or coupon code
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string, enum: [ALL, CLAIMED, USED, EXPIRED, CANCELLED] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [CLAIMED, USED, EXPIRED, CANCELLED] }
 *       - $ref: '#/components/parameters/AdminDateFrom'
 *       - $ref: '#/components/parameters/AdminDateTo'
 *       - in: query
 *         name: sortBy
 *         description: Column to sort by (default `claimedAt`). Unknown values return 400.
 *         schema: { type: string, enum: [offerCode, title, couponCode, discountValue, validUntil, jobRef, status, usedAt, claimedAt], default: claimedAt }
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Customer offers retrieved successfully.
 *               data:
 *                 - id: f1a2b3c4-0000-4000-8000-000000000015
 *                   status: USED
 *                   claimedAt: '2026-09-25T10:00:00.000Z'
 *                   usedAt: '2026-10-02T15:00:00.000Z'
 *                   job: { id: d3738495-0000-4000-8000-000000000007, jobRef: JOB-411A, title: Boiler Repair }
 *                   offer:
 *                     id: a2b3c4d5-0000-4000-8000-000000000016
 *                     offerCode: OFF-101
 *                     title: 10% off boiler service
 *                     couponCode: BOILER10
 *                     discountType: PERCENTAGE
 *                     discountValue: 10
 *                     currencyCode: EUR
 *                     offerType: TRADER
 *                     status: ACTIVE
 *                     validFrom: '2026-09-01T00:00:00.000Z'
 *                     validUntil: '2026-12-31T23:59:59.000Z'
 *                     trader:
 *                       id: e48495a6-0000-4000-8000-000000000008
 *                       businessName: Wilson Electrics
 *                       fullName: James Wilson
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404: { description: Customer not found. }
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
 *     description: Paginated reviews written by the customer. `data` is an array; pagination in `meta`.
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         description: Review text, trader business name, job ref or job title
 *         schema: { type: string }
 *       - in: query
 *         name: stars
 *         schema: { type: string, enum: ['1', '2', '3', '4', '5'] }
 *       - $ref: '#/components/parameters/AdminDateFrom'
 *       - $ref: '#/components/parameters/AdminDateTo'
 *       - in: query
 *         name: sortBy
 *         description: Column to sort by (default `createdAt`). Unknown values return 400.
 *         schema: { type: string, enum: [stars, review, traderName, jobRef, jobTitle, createdAt], default: createdAt }
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Customer reviews retrieved successfully.
 *               data:
 *                 - id: b3c4d5e6-0000-4000-8000-000000000017
 *                   stars: 5
 *                   review: Quick and professional.
 *                   createdAt: '2026-10-03T08:00:00.000Z'
 *                   trader:
 *                     id: e48495a6-0000-4000-8000-000000000008
 *                     traderCode: TRD-1001
 *                     businessName: Wilson Electrics
 *                     fullName: James Wilson
 *                     profilePhotoUrl: null
 *                   bookingRef: BKG-2001
 *                   job:
 *                     id: d3738495-0000-4000-8000-000000000007
 *                     jobRef: JOB-411A
 *                     title: Boiler Repair
 *                     category: { id: f5a6b7c8-0000-4000-8000-000000000009, name: Plumbing }
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404: { description: Customer not found. }
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
 *     description: |
 *       Paginated notifications. `data` is an array; pagination in `meta`.
 *       `meta.unreadCount` is the customer's total unread count (ignores filters).
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         description: Notification type (contains)
 *         schema: { type: string }
 *       - in: query
 *         name: read
 *         schema: { type: string, enum: ['true', 'false'] }
 *       - in: query
 *         name: type
 *         description: Exact notification type
 *         schema: { type: string }
 *       - $ref: '#/components/parameters/AdminDateFrom'
 *       - $ref: '#/components/parameters/AdminDateTo'
 *       - in: query
 *         name: sortBy
 *         description: Column to sort by (default `createdAt`). Unknown values return 400.
 *         schema: { type: string, enum: [type, read, createdAt], default: createdAt }
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Customer notifications retrieved successfully.
 *               data:
 *                 - id: c4d5e6f7-0000-4000-8000-000000000018
 *                   type: QUOTE_RECEIVED
 *                   payload: { title: New quote received, body: Wilson Electrics sent you a quote., jobId: d3738495-0000-4000-8000-000000000007 }
 *                   read: false
 *                   createdAt: '2026-09-29T12:00:00.000Z'
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1, unreadCount: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404: { description: Customer not found. }
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
 *     description: Paginated audit logs about or by the customer. `data` is an array; pagination in `meta`.
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         description: Description, event type or actor label
 *         schema: { type: string }
 *       - in: query
 *         name: eventType
 *         description: Exact event type
 *         schema: { type: string }
 *       - $ref: '#/components/parameters/AdminDateFrom'
 *       - $ref: '#/components/parameters/AdminDateTo'
 *       - in: query
 *         name: sortBy
 *         description: Column to sort by (default `createdAt`). Unknown values return 400.
 *         schema: { type: string, enum: [eventType, actorType, actorLabel, description, createdAt], default: createdAt }
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Customer activity retrieved successfully.
 *               data:
 *                 - id: d5e6f7a8-0000-4000-8000-000000000019
 *                   eventType: CUSTOMER_UPDATED
 *                   actorType: ADMIN
 *                   actorId: 1b2c3d4e-0000-4000-8000-000000000021
 *                   actorLabel: admin@brisk.ie
 *                   subjectType: User
 *                   subjectId: 0a1b2c3d-0000-4000-8000-000000000020
 *                   description: Customer profile updated
 *                   createdAt: '2026-09-28T10:00:00.000Z'
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404: { description: Customer not found. }
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
