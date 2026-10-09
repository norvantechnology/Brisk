import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-traders.controller';
import {
  adminExpiringDocumentsSchema,
  createTraderSchema,
  traderFilterSchema,
  traderIdParamSchema,
  traderStatsFilterSchema,
  updateTraderSchema,
  updateTraderStatusSchema,
  updateTraderVerificationSchema,
} from './admin-traders.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * tags:
 *   - name: Admin / Traders
 *     description: |
 *       Admin **Traders Management** (All Traders screen).
 *       Auth: `POST /admin/auth/login` → Bearer token.
 *       Related: onboarding document review lives under **Admin / Trader Verification**.
 *
 * components:
 *   schemas:
 *     AdminTraderListItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid, example: 'f0f8b572-de03-48d2-a080-34b8966082a6' }
 *         traderCode: { type: string, nullable: true, example: 'TRD-1001' }
 *         businessName: { type: string, example: 'The Book Nook' }
 *         businessType: { type: string, enum: [Individual, Business], example: 'Individual' }
 *         traderType: { type: string, enum: [SOLO, COMPANY], example: 'SOLO' }
 *         contact:
 *           type: object
 *           properties:
 *             email: { type: string, example: 'clara.watts@thebooknook.com' }
 *             mobileNumber: { type: string, example: '+447867880123' }
 *             fullName: { type: string, example: 'Clara Watts' }
 *         listingsCount: { type: integer, example: 56, description: 'Count of trader offers (LISTINGS column)' }
 *         bookingsCount: { type: integer, example: 12 }
 *         jobsDoneCount: { type: integer, example: 40 }
 *         revenue: { type: number, example: 8920.5, description: 'Completed booking payments for this trader' }
 *         rating:
 *           type: object
 *           properties:
 *             average: { type: number, example: 4.3 }
 *             reviewsCount: { type: integer, example: 78 }
 *         status: { type: string, enum: [ACTIVE, INACTIVE, PENDING, SUSPENDED], example: 'ACTIVE' }
 *         verificationStatus: { type: string, enum: [PENDING, VERIFIED, REJECTED, SUSPENDED], example: 'VERIFIED' }
 *         onboardingStatus: { type: string, example: 'APPROVED' }
 *         country: { type: string, nullable: true, example: 'Ireland' }
 *         city: { type: string, nullable: true, example: 'Dublin' }
 *         categories:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               name: { type: string, example: 'Plumbing Services' }
 *               categoryCode: { type: string, example: 'CAT-PLUMB' }
 *         profilePhotoUrl: { type: string, nullable: true }
 *         joinedAt: { type: string, format: date-time, example: '2025-01-08T10:00:00.000Z' }
 *     AdminTraderDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/AdminTraderListItem'
 *         - type: object
 *           properties:
 *             profile:
 *               type: object
 *               properties:
 *                 fullLegalName: { type: string, nullable: true }
 *                 businessName: { type: string, nullable: true }
 *                 ppsNumber: { type: string, nullable: true }
 *                 croNumber: { type: string, nullable: true }
 *                 vatNumber: { type: string, nullable: true }
 *                 directorFullName: { type: string, nullable: true }
 *                 bio: { type: string, nullable: true }
 *                 yearsExperience: { type: integer, nullable: true }
 *                 addressLine1: { type: string, nullable: true }
 *                 addressLine2: { type: string, nullable: true }
 *                 city: { type: string, nullable: true }
 *                 postcode: { type: string, nullable: true }
 *                 county: { type: string, nullable: true }
 *                 country: { type: string, nullable: true }
 *                 serviceRadiusKm: { type: integer, nullable: true }
 *                 serviceCenterLabel: { type: string, nullable: true }
 *             bankDetails:
 *               type: object
 *               properties:
 *                 bankHolderName: { type: string, nullable: true }
 *                 bankName: { type: string, nullable: true }
 *                 accountNumber: { type: string, nullable: true }
 *                 ifscCode: { type: string, nullable: true }
 *                 bankDetailsSkipped: { type: boolean }
 *             user:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 fullName: { type: string }
 *                 email: { type: string }
 *                 mobileNumber: { type: string }
 *                 status: { type: string }
 *             documentsCount: { type: integer, example: 3 }
 *             rejectionReason: { type: string, nullable: true }
 *             onboardingSubmittedAt: { type: string, format: date-time, nullable: true }
 *     AdminTraderStats:
 *       type: object
 *       properties:
 *         totalTraders: { type: integer, example: 47 }
 *         activeTraders: { type: integer, example: 11 }
 *         suspendedTraders: { type: integer, example: 1 }
 *         pendingVerification:
 *           type: integer
 *           example: 35
 *           description: |
 *             Count of traders with `verificationStatus=PENDING` only.
 *             Same filter as `GET /admin/traders?verificationStatus=PENDING` (`meta.total`).
 *         newTraders:
 *           type: integer
 *           example: 8
 *           description: |
 *             New/fresh traders = `trader.createdAt` inside `newTradersWindow`.
 *             Default window = current UTC calendar month. Override with `joinedFrom` / `joinedTo`.
 *             Same filter as `GET /admin/traders?joinedFrom=...&joinedTo=...`.
 *         newTradersWindow:
 *           type: object
 *           properties:
 *             joinedFrom: { type: string, format: date-time }
 *             joinedTo: { type: string, format: date-time }
 *         totalRevenue: { type: number, example: 1234266.3 }
 *         avgRating: { type: number, example: 4.61 }
 *     ApiSuccessEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string }
 *         data: { type: object }
 *     ApiErrorEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         message: { type: string, example: 'Mobile must be E.164 (e.g. +353871234567).', description: 'For 400 validation errors this is the first field error (all errors are in `error`).' }
 *         error:
 *           oneOf:
 *             - type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   field: { type: string, example: 'body.email' }
 *                   message: { type: string, example: 'Invalid email.' }
 *             - type: string
 */

/**
 * @swagger
 * /admin/traders/stats:
 *   get:
 *     summary: Traders Management KPI cards
 *     description: |
 *       Powers the top cards on **Admin → Traders Management**.
 *
 *       **Pending Verification** (`pendingVerification`):
 *       - Rule: `trader.verificationStatus = PENDING` (no extra status/onboarding filters).
 *       - Matching list call: `GET /admin/traders?verificationStatus=PENDING`
 *       - Alias also accepted on list: `?verification=PENDING`
 *       - Do **not** combine with `status=ACTIVE` — that returns a different (smaller) set.
 *       - Do **not** use `pendingApproval=true` for this card — that is the narrower approval queue
 *         (`onboardingStatus=SUBMITTED` **and** `verificationStatus=PENDING`).
 *
 *       **New / Fresh Traders** (`newTraders`):
 *       - Rule: `trader.createdAt` within `newTradersWindow`.
 *       - Default window: start of current **UTC** calendar month → now.
 *       - Override: `?joinedFrom=2026-09-01&joinedTo=2026-09-30`
 *       - Matching list call: `GET /admin/traders?joinedFrom=...&joinedTo=...`
 *         (use the same dates returned in `data.newTradersWindow`).
 *
 *       List responses are paginated (`limit` default 10). Use `meta.total` to match the KPI count,
 *       and raise `limit` / page through to load all rows.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: joinedFrom
 *         schema: { type: string, example: '2026-09-01' }
 *         description: Optional start of newTraders window (ISO date or datetime). Date-only = 00:00:00.000Z.
 *       - in: query
 *         name: joinedTo
 *         schema: { type: string, example: '2026-09-30' }
 *         description: Optional end of newTraders window (ISO date or datetime). Date-only = 23:59:59.999Z.
 *     responses:
 *       200:
 *         description: Stats retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     message: { example: 'Trader directory stats retrieved successfully.' }
 *                     data:
 *                       $ref: '#/components/schemas/AdminTraderStats'
 *             example:
 *               success: true
 *               message: Trader directory stats retrieved successfully.
 *               data:
 *                 totalTraders: 47
 *                 activeTraders: 11
 *                 suspendedTraders: 1
 *                 pendingVerification: 35
 *                 newTraders: 8
 *                 newTradersWindow:
 *                   joinedFrom: '2026-09-01T00:00:00.000Z'
 *                   joinedTo: '2026-09-23T12:00:00.000Z'
 *                 totalRevenue: 1234266.3
 *                 avgRating: 4.61
 *       401:
 *         description: Missing/invalid admin token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }
 */
router.get('/traders/stats', validate(traderStatsFilterSchema), controller.getStats);

/**
 * @swagger
 * /admin/traders/documents/expiring:
 *   get:
 *     summary: Admin dashboard — expired / expiring trader documents (all traders)
 *     description: |
 *       Same rules as trader `GET /traders/me/documents/expiring`, across every trader.
 *       Uploaded documents (not REJECTED) that are expired or expire within `withinDays` (default 30), soonest first.
 *
 *       **summary** counters cover all matching documents (ignore `expiryStatus` and pagination):
 *       `totalDocuments`, `expiredCount`, `expiresTodayCount`, `expiringSoonCount`, `tradersAffected`.
 *
 *       `lastReminderStage` = last reminder sent to the trader (30 / 7 / 1 / 0 days before expiry), `null` = none yet.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: withinDays
 *         schema: { type: integer, minimum: 0, maximum: 365, default: 30 }
 *       - in: query
 *         name: expiryStatus
 *         schema: { type: string, enum: [EXPIRED, EXPIRES_TODAY, EXPIRING_SOON] }
 *         description: Filter the list (tabs). Summary counters are not affected.
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Trader business name, full name, email or mobile.
 *       - in: query
 *         name: traderId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: sortBy
 *         description: "Column to sort by (default `expiryDate`, soonest first). `daysLeft` = `expiryDate`. `traderName` = business name, else full name. Unknown values return 400."
 *         schema: { type: string, enum: [expiryDate, daysLeft, documentName, documentKey, scope, categoryName, required, fileName, status, lastReminderStage, uploadedAt, traderName, email, mobileNumber], default: expiryDate }
 *       - in: query
 *         name: sortOrder
 *         description: Sort direction. Defaults to `asc` for this list. Empty values are always listed last.
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       200:
 *         description: Expiring documents retrieved.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Expiring documents retrieved successfully.
 *               data:
 *                 summary:
 *                   totalDocuments: 12
 *                   expiredCount: 3
 *                   expiresTodayCount: 1
 *                   expiringSoonCount: 8
 *                   tradersAffected: 7
 *                 withinDays: 30
 *                 items:
 *                   - id: 0b3f2c1e-5d6a-4f7b-9c8d-1e2f3a4b5c6d
 *                     documentRuleId: 9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d
 *                     documentKey: public_liability_insurance
 *                     documentName: Public Liability Insurance
 *                     scope: CATEGORY
 *                     categoryId: 3a07ea99-4d74-45b9-86ba-6f95ca85b8a2
 *                     categoryName: Plumbing Services
 *                     required: true
 *                     fileUrl: https://api.brisk.ie/uploads/documents/insurance.pdf
 *                     fileName: insurance.pdf
 *                     status: APPROVED
 *                     expiryDate: '2026-10-05'
 *                     daysLeft: 4
 *                     expiryStatus: EXPIRING_SOON
 *                     lastReminderStage: 7
 *                     uploadedAt: '2025-10-05T10:00:00.000Z'
 *                     trader:
 *                       id: 5c4b3a2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d
 *                       name: Murphy Plumbing
 *                       fullName: John Murphy
 *                       businessName: Murphy Plumbing
 *                       traderType: SOLO
 *                       email: john@example.com
 *                       mobileNumber: '+353871234567'
 *                       profilePhotoUrl: null
 *                 meta: { total: 12, page: 1, limit: 20, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 */
router.get(
  '/traders/documents/expiring',
  validate(adminExpiringDocumentsSchema),
  controller.listExpiringDocuments
);

/**
 * @swagger
 * /admin/traders:
 *   get:
 *     summary: List traders (table + filters)
 *     description: |
 *       Powers the Traders Management table.
 *       Search matches name, business, email, mobile, or trader code.
 *
 *       **Card → list consistency (exact query strings):**
 *
 *       | Dashboard card | Exact list query |
 *       |---|---|
 *       | Pending Verification | `GET /admin/traders?verificationStatus=PENDING` |
 *       | New / Fresh Traders | `GET /admin/traders?joinedFrom={newTradersWindow.joinedFrom}&joinedTo={newTradersWindow.joinedTo}` |
 *
 *       `verification` is an accepted alias for `verificationStatus`.
 *
 *       **Not** the Pending Verification card:
 *       - `?pendingApproval=true` → SUBMITTED + PENDING only (approval queue)
 *       - `?status=ACTIVE&verificationStatus=PENDING` → stricter subset
 *
 *       Paginated: default `limit=10`. Match KPI using `data.meta.total`, not row count on page 1.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, example: 50 }
 *         description: Max 100. Raise when opening a KPI card so more rows load per page.
 *       - in: query
 *         name: search
 *         schema: { type: string, example: 'Book Nook' }
 *         description: Search by name, business, email, mobile, or trader code.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, PENDING, SUSPENDED] }
 *         description: Account status filter (All Statuses dropdown). Do not send with Pending Verification card.
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: Filter by trade category UUID (All Categories dropdown).
 *       - in: query
 *         name: verificationStatus
 *         schema: { type: string, enum: [PENDING, VERIFIED, REJECTED, SUSPENDED] }
 *         description: |
 *           Verification filter (preferred name). Pending Verification card → `PENDING`.
 *           Same as `verification`.
 *       - in: query
 *         name: verification
 *         schema: { type: string, enum: [PENDING, VERIFIED, REJECTED, SUSPENDED] }
 *         description: Alias for `verificationStatus` (legacy).
 *       - in: query
 *         name: onboardingStatus
 *         schema: { type: string, enum: [NOT_STARTED, IN_PROGRESS, SUBMITTED, APPROVED, REJECTED] }
 *         description: Onboarding status filter.
 *       - in: query
 *         name: pendingApproval
 *         schema: { type: boolean, example: true }
 *         description: |
 *           Approval queue shortcut = `onboardingStatus=SUBMITTED` + `verificationStatus=PENDING`.
 *           Not the Pending Verification KPI.
 *       - in: query
 *         name: country
 *         schema: { type: string, example: 'Ireland' }
 *         description: Country filter (All Countries dropdown).
 *       - in: query
 *         name: joinedFrom
 *         schema: { type: string, example: '2026-09-01' }
 *         description: Inclusive start of `trader.createdAt` (ISO date or datetime). Date-only = 00:00:00.000Z.
 *       - in: query
 *         name: joinedTo
 *         schema: { type: string, example: '2026-09-30' }
 *         description: Inclusive end of `trader.createdAt` (ISO date or datetime). Date-only = 23:59:59.999Z.
 *       - in: query
 *         name: traderType
 *         schema: { type: string, enum: [SOLO, COMPANY] }
 *         description: Business Type column filter (SOLO = Individual, COMPANY = Business).
 *       - in: query
 *         name: city
 *         schema: { type: string, example: 'Dublin' }
 *         description: City filter (partial, case-insensitive).
 *       - in: query
 *         name: minRating
 *         schema: { type: number, minimum: 0, maximum: 5, example: 4 }
 *         description: Rating column — minimum average rating (inclusive).
 *       - in: query
 *         name: maxRating
 *         schema: { type: number, minimum: 0, maximum: 5, example: 5 }
 *         description: Rating column — maximum average rating (inclusive). Must be ≥ minRating.
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [traderCode, businessName, businessType, contactName, email, mobileNumber, listingsCount, bookingsCount, jobsDoneCount, revenue, rating, reviewsCount, status, verificationStatus, onboardingStatus, country, city, joinedAt]
 *           default: joinedAt
 *         description: |
 *           Sort column (one per table column). Default `joinedAt` (newest first).
 *           `rating` = rating.average, `reviewsCount` = rating.reviewsCount, `contactName`/`email`/`mobileNumber` = contact.*.
 *           Empty values (e.g. no city) are always listed last.
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated trader rows for the table.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Traders retrieved successfully.' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     meta:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 35 }
 *                         page: { type: integer, example: 1 }
 *                         limit: { type: integer, example: 10 }
 *                         totalPages: { type: integer, example: 4 }
 *                     traders:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/AdminTraderListItem' }
 *             example:
 *               success: true
 *               message: Traders retrieved successfully.
 *               data:
 *                 meta: { total: 35, page: 1, limit: 10, totalPages: 4 }
 *                 traders:
 *                   - id: f0f8b572-de03-48d2-a080-34b8966082a6
 *                     traderCode: TRD-1001
 *                     businessName: The Book Nook
 *                     businessType: Individual
 *                     traderType: SOLO
 *                     contact:
 *                       email: clara.watts@thebooknook.com
 *                       mobileNumber: '+447867880123'
 *                       fullName: Clara Watts
 *                     listingsCount: 56
 *                     bookingsCount: 12
 *                     jobsDoneCount: 40
 *                     revenue: 8920.5
 *                     rating: { average: 4.3, reviewsCount: 78 }
 *                     status: INACTIVE
 *                     verificationStatus: PENDING
 *                     onboardingStatus: SUBMITTED
 *                     country: Ireland
 *                     city: Dublin
 *                     categories: [{ id: '3f0f23dd-dfa2-4606-9eed-acdc22534f0f', name: 'Plumbing Services', categoryCode: 'CAT-PLUMB' }]
 *                     profilePhotoUrl: null
 *                     joinedAt: '2025-01-08T10:00:00.000Z'
 *       400:
 *         description: Validation error on query params (bad enum, sortBy, uuid, date, or minRating > maxRating).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }
 *             example:
 *               success: false
 *               message: 'sortBy must be one of: traderCode, businessName, businessType, contactName, email, mobileNumber, listingsCount, bookingsCount, jobsDoneCount, revenue, rating, reviewsCount, status, verificationStatus, onboardingStatus, country, city, joinedAt'
 *               error:
 *                 - field: query.sortBy
 *                   message: 'sortBy must be one of: traderCode, businessName, businessType, contactName, email, mobileNumber, listingsCount, bookingsCount, jobsDoneCount, revenue, rating, reviewsCount, status, verificationStatus, onboardingStatus, country, city, joinedAt'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             example: { success: false, message: 'Admin access token is missing or invalid.' }
 */
router.get('/traders', validate(traderFilterSchema), controller.listTraders);

/**
 * @swagger
 * /admin/traders:
 *   post:
 *     summary: Create trader (admin)
 *     description: |
 *       Creates a TRADER user + trader profile.
 *       Default login password is `Password1!` (same pattern as admin customer create).
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, mobileNumber]
 *             properties:
 *               fullName: { type: string, example: 'Clara Watts' }
 *               email: { type: string, example: 'clara.watts@thebooknook.com' }
 *               mobileNumber: { type: string, example: '+447867880123' }
 *               traderType: { type: string, enum: [SOLO, COMPANY], example: 'SOLO' }
 *               businessName: { type: string, example: 'The Book Nook' }
 *               fullLegalName: { type: string, example: 'Clara Watts' }
 *               country: { type: string, example: 'Ireland' }
 *               city: { type: string, example: 'Dublin' }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, PENDING, SUSPENDED], example: 'ACTIVE' }
 *               verificationStatus: { type: string, enum: [PENDING, VERIFIED, REJECTED, SUSPENDED], example: 'PENDING' }
 *               categoryIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 example: ['3f0f23dd-dfa2-4606-9eed-acdc22534f0f']
 *               profilePhotoUrl: { type: string, example: 'https://cdn.brisk.com/traders/clara.jpg' }
 *               yearsExperience: { type: integer, example: 5 }
 *               bio: { type: string, example: 'Independent bookseller and home repair specialist.' }
 *           example:
 *             fullName: Clara Watts
 *             email: clara.watts@thebooknook.com
 *             mobileNumber: '+447867880123'
 *             traderType: SOLO
 *             businessName: The Book Nook
 *             country: Ireland
 *             city: Dublin
 *             status: ACTIVE
 *             verificationStatus: PENDING
 *             categoryIds: ['3f0f23dd-dfa2-4606-9eed-acdc22534f0f']
 *     responses:
 *       201:
 *         description: Trader created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Trader created successfully. Default password: Password1!' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     trader: { $ref: '#/components/schemas/AdminTraderDetail' }
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }
 *             example:
 *               success: false
 *               message: 'Mobile must be E.164 (e.g. +353871234567).'
 *               error:
 *                 - field: body.mobileNumber
 *                   message: 'Mobile must be E.164 (e.g. +353871234567).'
 *       401:
 *         description: Unauthorized.
 *       409:
 *         description: Email or mobile already exists.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: Email already exists.
 */
router.post('/traders', validate(createTraderSchema), controller.createTrader);

/**
 * @swagger
 * /admin/traders/{id}:
 *   get:
 *     summary: Get trader detail (View action)
 *     description: Full trader profile for the eye/view drawer or detail page.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Trader detail.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Trader profile retrieved successfully.' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     trader: { $ref: '#/components/schemas/AdminTraderDetail' }
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: Trader not found.
 */
router.get('/traders/:id', validate(traderIdParamSchema), controller.getTrader);

/**
 * @swagger
 * /admin/traders/{id}:
 *   patch:
 *     summary: Update trader (Edit action)
 *     description: Partial update of trader + linked user fields. Pass only fields to change.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string, example: 'Clara Watts' }
 *               email: { type: string, example: 'clara.watts@thebooknook.com' }
 *               mobileNumber: { type: string, example: '+447867880123' }
 *               traderType: { type: string, enum: [SOLO, COMPANY] }
 *               businessName: { type: string, nullable: true, example: 'The Book Nook' }
 *               fullLegalName: { type: string, nullable: true }
 *               country: { type: string, nullable: true, example: 'Ireland' }
 *               city: { type: string, nullable: true }
 *               addressLine1: { type: string, nullable: true }
 *               addressLine2: { type: string, nullable: true }
 *               postcode: { type: string, nullable: true }
 *               county: { type: string, nullable: true }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, PENDING, SUSPENDED] }
 *               verificationStatus: { type: string, enum: [PENDING, VERIFIED, REJECTED, SUSPENDED] }
 *               categoryIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               profilePhotoUrl: { type: string, nullable: true }
 *               yearsExperience: { type: integer }
 *               bio: { type: string, nullable: true }
 *               serviceRadiusKm: { type: integer, nullable: true }
 *           example:
 *             businessName: The Book Nook
 *             status: ACTIVE
 *             country: Ireland
 *             categoryIds: ['3f0f23dd-dfa2-4606-9eed-acdc22534f0f']
 *     responses:
 *       200:
 *         description: Updated trader.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Trader updated successfully.' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     trader: { $ref: '#/components/schemas/AdminTraderDetail' }
 *       400:
 *         description: Validation error (empty body or invalid fields).
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 *       409:
 *         description: Email/mobile conflict.
 */
router.patch('/traders/:id', validate(updateTraderSchema), controller.updateTrader);

/**
 * @swagger
 * /admin/traders/{id}/status:
 *   patch:
 *     summary: Update account status only
 *     description: |
 *       Quick status change for Active / Inactive / Pending / Suspended badges.
 *       Updates both `traders.status` and linked `users.status`.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [ACTIVE, INACTIVE, PENDING, SUSPENDED], example: 'SUSPENDED' }
 *           example:
 *             status: SUSPENDED
 *     responses:
 *       200:
 *         description: Status updated.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader status updated successfully.
 *               data:
 *                 trader:
 *                   id: f0f8b572-de03-48d2-a080-34b8966082a6
 *                   status: SUSPENDED
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.patch(
  '/traders/:id/status',
  validate(updateTraderStatusSchema),
  controller.updateTraderStatus
);

/**
 * @swagger
 * /admin/traders/{id}/verification:
 *   patch:
 *     summary: Update verification badge (shield action)
 *     description: |
 *       Quick verification update from the Traders Management table shield icon.
 *       For full onboarding document review queue, use **Admin / Trader Verification**
 *       (`GET/PATCH /admin/trader-verification/...`).
 *
 *       When `verificationStatus=VERIFIED`, existing trader sessions are invalidated
 *       (`tokenVersion` bump) so the app refreshes `nextStep`.
 *       When `REJECTED`, `rejectionReason` is required.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [verificationStatus]
 *             properties:
 *               verificationStatus: { type: string, enum: [PENDING, VERIFIED, REJECTED, SUSPENDED], example: 'VERIFIED' }
 *               rejectionReason: { type: string, example: 'Missing trade certificate' }
 *           examples:
 *             approve:
 *               value: { verificationStatus: VERIFIED }
 *             reject:
 *               value:
 *                 verificationStatus: REJECTED
 *                 rejectionReason: Missing trade certificate
 *     responses:
 *       200:
 *         description: Verification updated.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader verification updated successfully.
 *               data:
 *                 trader:
 *                   id: f0f8b572-de03-48d2-a080-34b8966082a6
 *                   verificationStatus: VERIFIED
 *       400:
 *         description: Validation error (e.g. missing rejectionReason).
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.patch(
  '/traders/:id/verification',
  validate(updateTraderVerificationSchema),
  controller.updateTraderVerification
);

/**
 * @swagger
 * /admin/traders/{id}:
 *   delete:
 *     summary: Delete trader (trash action)
 *     description: |
 *       Permanently deletes the trader user account (cascade removes trader profile).
 *       Irreversible — confirm in UI before calling.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deleted.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader deleted successfully.
 *               data: null
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.delete('/traders/:id', validate(traderIdParamSchema), controller.deleteTrader);

export default router;
