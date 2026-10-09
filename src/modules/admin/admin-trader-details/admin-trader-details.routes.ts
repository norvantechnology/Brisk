import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-trader-details.controller';
import { adminTraderSiteVisitsSchema } from '../../site-visits/site-visits.validation';
import {
  createTraderPayoutSchema,
  traderDetailsIdParamSchema,
  traderDocumentsQuerySchema,
  traderJobsQuerySchema,
  traderOffersQuerySchema,
  traderPayoutsQuerySchema,
  traderReviewsQuerySchema,
} from './admin-trader-details.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * tags:
 *   - name: Admin / Trader Details
 *     description: |
 *       Nested APIs for **Trader Details** tabs (**Profile Overview excluded** — use `GET /admin/traders/{id}`).
 *
 *       **Base path:** `/admin/traders/{id}/...` · **Auth:** admin Bearer
 *
 *       | Tab | Stats / Summary | List |
 *       |-----|-----------------|------|
 *       | Documents | `GET .../documents/stats` | `GET .../documents` |
 *       | Jobs | `GET .../jobs/stats` | `GET .../jobs` |
 *       | Reviews | `GET .../reviews/stats` | `GET .../reviews` |
 *       | Payouts & Earnings | `GET .../earnings/summary` | `GET .../payouts` |
 *       | Offers | `GET .../offers/stats` | `GET .../offers` |
 *
 *       **Document approve/reject (same screen):**
 *       `PATCH /admin/trader-verification/{traderId}/documents/{documentId}`
 *       with `{ "status": "APPROVED" }` or `{ "status": "REJECTED", "rejectionReason": "..." }`.
 *       After approve/reject, refresh trader status from the API response (`data.trader`) — do not calculate it on the frontend.
 *
 *       **Document statuses:** `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`
 *
 *       **Common list query params:** `page`, `limit`, `search`, `sortBy`, `sortOrder` (`asc`|`desc`), `from`, `to` (`YYYY-MM-DD` or ISO datetime).
 */

/**
 * @swagger
 * /admin/traders/{id}/documents/stats:
 *   get:
 *     summary: Documents tab — compliance KPIs
 *     description: |
 *       KPI cards for the Documents tab: compliance %, required vs approved, pending/rejected counts, last verified.
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Trader UUID
 *     responses:
 *       200:
 *         description: Document compliance stats.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader document stats retrieved successfully.
 *               data:
 *                 documentCompliancePercent: 66.67
 *                 requiredTotal: 3
 *                 approvedRequired: 2
 *                 approvedLabel: 2 of 3 documents approved
 *                 activeCredentials: 2
 *                 filesSubmitted: 3
 *                 pendingFiles: 1
 *                 rejectedFiles: 0
 *                 lastVerifiedAt: '2026-09-14T12:00:00.000Z'
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/traders/:id/documents/stats',
  validate(traderDetailsIdParamSchema),
  controller.getDocumentsStats
);

/**
 * @swagger
 * /admin/traders/{id}/documents:
 *   get:
 *     summary: Documents tab — list verification documents
 *     description: |
 *       Paginated trader verification documents for the Documents tab.
 *
 *       **Filters:** `status`, `scope` (`ENTITY`|`CATEGORY`|`ALL`), `search`, `sortBy`, `sortOrder`, `from`, `to`, `page`, `limit`
 *
 *       **Document statuses:** `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`
 *
 *       **Approve/reject:** `PATCH /admin/trader-verification/{traderId}/documents/{documentId}`
 *       — then refresh trader status from that response (`data.trader`).
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Trader UUID
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search document name, documentKey, or file name
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, EXPIRED] }
 *         description: Document review status filter
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [ENTITY, CATEGORY, ALL] }
 *         description: Entity-level vs category-level documents (`ALL` or omit = no scope filter)
 *       - in: query
 *         name: sortBy
 *         description: "Column to sort by (default `uploadedAt`). Unknown values return 400. `name` = document name; `scope` = Entity/Company vs Category doc."
 *         schema: { type: string, enum: [name, documentKey, required, scope, categoryName, fileName, status, expiryDate, reviewedAt, uploadedAt], default: uploadedAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: from
 *         schema: { type: string, example: '2026-01-01' }
 *         description: Filter uploadedAt from (YYYY-MM-DD or ISO datetime)
 *       - in: query
 *         name: to
 *         schema: { type: string, example: '2026-12-31' }
 *         description: Filter uploadedAt to (YYYY-MM-DD or ISO datetime)
 *     responses:
 *       200:
 *         description: Paginated documents list (`data` = array, `meta` = pagination).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader documents retrieved successfully.
 *               data:
 *                 - id: 11111111-1111-1111-1111-111111111111
 *                   traderId: 22222222-2222-2222-2222-222222222222
 *                   documentRuleId: 33333333-3333-3333-3333-333333333333
 *                   name: Public Liability Insurance
 *                   documentKey: PUBLIC_LIABILITY
 *                   required: true
 *                   scope: ENTITY
 *                   scopeLabel: Entity Doc
 *                   category: null
 *                   fileUrl: https://cdn.example.com/docs/insurance.pdf
 *                   fileName: insurance.pdf
 *                   status: PENDING
 *                   rejectionReason: null
 *                   expiryDate: '2027-05-31'
 *                   uploadedAt: '2026-09-10T10:00:00.000Z'
 *                   reviewedAt: null
 *                   reviewedById: null
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/traders/:id/documents',
  validate(traderDocumentsQuerySchema),
  controller.listDocuments
);

/**
 * @swagger
 * /admin/traders/{id}/jobs/stats:
 *   get:
 *     summary: Jobs tab — KPI cards
 *     description: |
 *       Jobs KPIs for the trader: totals, completed, visit fees, selection rate, revenue.
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Jobs stats.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader jobs stats retrieved successfully.
 *               data:
 *                 totalJobs: 42
 *                 completedJobs: 28
 *                 visitFeesEarned: 350
 *                 visitsCompleted: 10
 *                 visitsTotal: 14
 *                 materialsAdded: 0
 *                 selectionRatePercent: 45.5
 *                 jobRevenue: 12850.5
 *                 currencyCode: EUR
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/traders/:id/jobs/stats',
  validate(traderDetailsIdParamSchema),
  controller.getJobsStats
);

/**
 * @swagger
 * /admin/traders/{id}/jobs:
 *   get:
 *     summary: Jobs tab — assigned & completed jobs
 *     description: |
 *       Paginated jobs for the trader.
 *
 *       **Filters:** `status`, `categoryId`, `search`, `sortBy`, `sortOrder`, `from`, `to`, `page`, `limit`
 *     tags: ['Admin / Trader Details']
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
 *         schema: { type: string }
 *         description: Search jobRef, title, customer name, category, subcategory
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
 *         description: "Column to sort by (default `createdAt`). Unknown values return 400. `amount` and `date` sort by the displayed values (invoice total / service charge / visit fee; scheduled date else created date)."
 *         schema: { type: string, enum: [jobRef, title, customerName, categoryName, subcategoryName, date, scheduledDate, amount, status, siteVisitFee, siteVisitStatus, bookingRef, createdAt], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: from
 *         schema: { type: string, example: '2026-01-01' }
 *         description: Filter createdAt from
 *       - in: query
 *         name: to
 *         schema: { type: string, example: '2026-12-31' }
 *         description: Filter createdAt to
 *     responses:
 *       200:
 *         description: |
 *           Paginated jobs (`data` array, pagination in `meta`).
 *           `siteVisitStatus` is null when no site visit, else one of Visit Pending / Visit Scheduled / Visit In Progress / Visit Completed / Visit Cancelled.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader jobs retrieved successfully.
 *               data:
 *                 - id: d3738495-0000-4000-8000-000000000007
 *                   jobRef: JOB-0001
 *                   title: Boiler repair
 *                   customer: { id: 0a1b2c3d-0000-4000-8000-000000000020, fullName: Jane Doe, email: jane@example.com }
 *                   service: Boiler repair
 *                   category: { id: f5a6b7c8-0000-4000-8000-000000000009, name: Plumbing }
 *                   subcategory: { id: a6b7c8d9-0000-4000-8000-000000000010, name: Boilers }
 *                   date: '2026-09-01T09:00:00.000Z'
 *                   createdAt: '2026-08-28T12:00:00.000Z'
 *                   scheduledDate: '2026-09-01T09:00:00.000Z'
 *                   amount: 180
 *                   currencyCode: EUR
 *                   status: COMPLETED
 *                   siteVisitRequested: true
 *                   siteVisitFee: 40
 *                   siteVisitStatus: Visit Completed
 *                   bookingId: b7c8d9e0-0000-4000-8000-000000000011
 *                   bookingRef: BK-0001
 *                   invoiceId: c8d9e0f1-0000-4000-8000-000000000012
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/traders/:id/jobs',
  validate(traderJobsQuerySchema),
  controller.listJobs
);

/**
 * @swagger
 * /admin/traders/{id}/site-visits:
 *   get:
 *     summary: Jobs this trader requested a site visit on
 *     description: |
 *       Paginated list of the trader's site-visit requests (one per job), newest activity first.
 *       Same item shape and statuses as `GET /admin/customers/{id}/jobs/{jobId}/site-visits`
 *       and the Trader Portal `GET /traders/site-visits`.
 *
 *       `summary` counts cover all of this trader's requests matching `search` / `categoryId` / dates
 *       (not affected by `group`, `status` or pagination).
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - in: query
 *         name: group
 *         schema: { type: string, enum: [REQUESTED, VISITED, CLOSED] }
 *         description: Tab filter. REQUESTED = PENDING/CONFIRMED/RESCHEDULE_REQUIRED, VISITED = COMPLETED, CLOSED = CANCELLED/CLOSED.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, CONFIRMED, RESCHEDULE_REQUIRED, COMPLETED, CANCELLED, CLOSED] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Job ref, job title or customer name.
 *       - { in: query, name: categoryId, schema: { type: string, format: uuid } }
 *       - { in: query, name: from, schema: { type: string, example: '2026-10-01' }, description: Visit date from (YYYY-MM-DD) }
 *       - { in: query, name: to, schema: { type: string, example: '2026-10-31' }, description: Visit date to (YYYY-MM-DD) }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [updatedAt, requestedAt, visitDate, jobRef, jobTitle, customerName, categoryName], default: updatedAt }, description: "visitDate = displayed visit date (selected slot, else requested date); requestedAt = request created date" }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200:
 *         description: Trader site visits.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Trader site visits retrieved successfully. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/SiteVisitItem' }
 *                     summary: { $ref: '#/components/schemas/SiteVisitSummary' }
 *                     meta:
 *                       type: object
 *                       example: { total: 4, page: 1, limit: 20, totalPages: 1 }
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/traders/:id/site-visits',
  validate(adminTraderSiteVisitsSchema),
  controller.listSiteVisits
);

/**
 * @swagger
 * /admin/traders/{id}/reviews/stats:
 *   get:
 *     summary: Reviews tab — average + star distribution
 *     description: Average rating, total count, and 1–5 star distribution for the Reviews tab.
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Review stats.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader reviews stats retrieved successfully.
 *               data:
 *                 average: 4.6
 *                 total: 25
 *                 distribution: { '1': 0, '2': 1, '3': 2, '4': 6, '5': 16 }
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/traders/:id/reviews/stats',
  validate(traderDetailsIdParamSchema),
  controller.getReviewsStats
);

/**
 * @swagger
 * /admin/traders/{id}/reviews:
 *   get:
 *     summary: Reviews tab — customer reviews list
 *     description: |
 *       Paginated customer reviews for the trader.
 *
 *       **Filters:** `stars` (1–5), `search`, `sortBy`, `sortOrder`, `from`, `to`, `page`, `limit`
 *     tags: ['Admin / Trader Details']
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
 *         schema: { type: string }
 *         description: Search review text, customer name, bookingRef, jobRef
 *       - in: query
 *         name: stars
 *         schema: { type: string, enum: ['1', '2', '3', '4', '5'] }
 *         description: Filter by exact star rating (1–5)
 *       - in: query
 *         name: sortBy
 *         description: "Column to sort by (default `createdAt`). Unknown values return 400."
 *         schema: { type: string, enum: [stars, review, customerName, bookingRef, jobRef, jobTitle, categoryName, createdAt], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: from
 *         schema: { type: string, example: '2026-01-01' }
 *       - in: query
 *         name: to
 *         schema: { type: string, example: '2026-12-31' }
 *     responses:
 *       200:
 *         description: Paginated reviews list.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader reviews retrieved successfully.
 *               data:
 *                 - id: uuid
 *                   stars: 5
 *                   review: Great service
 *                   createdAt: '2026-09-01T18:00:00.000Z'
 *                   customer:
 *                     id: uuid
 *                     fullName: Jane Doe
 *                     email: jane@example.com
 *                     profilePhotoUrl: null
 *                   bookingId: uuid
 *                   bookingRef: BK-0001
 *                   job:
 *                     id: uuid
 *                     jobRef: JOB-0001
 *                     title: Boiler repair
 *                     category: { id: uuid, name: Plumbing }
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/traders/:id/reviews',
  validate(traderReviewsQuerySchema),
  controller.listReviews
);

/**
 * @swagger
 * /admin/traders/{id}/earnings/summary:
 *   get:
 *     summary: Payouts & Earnings — summary cards
 *     description: |
 *       Gross earnings, platform commission, net paid out, pending payout, and masked bank details.
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Earnings summary.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader earnings summary retrieved successfully.
 *               data:
 *                 grossEarnings: 10000
 *                 platformCommission: 1000
 *                 platformCommissionPercent: 10
 *                 netPaidOut: 8200
 *                 pendingPayout: 800
 *                 currencyCode: EUR
 *                 bank:
 *                   bankName: AIB
 *                   bankHolderName: Acme Plumbing Ltd
 *                   accountNumberMasked: '****1234'
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/traders/:id/earnings/summary',
  validate(traderDetailsIdParamSchema),
  controller.getEarningsSummary
);

/**
 * @swagger
 * /admin/traders/{id}/payouts:
 *   get:
 *     summary: Payouts & Earnings — payout transactions
 *     description: |
 *       Paginated payout rows for the trader.
 *
 *       **Filters:** `status`, `search`, `sortBy`, `sortOrder`, `from`, `to`, `page`, `limit`
 *
 *       **Payout statuses:** `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`
 *     tags: ['Admin / Trader Details']
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
 *         schema: { type: string }
 *         description: Search stripeTransferId or exact payout UUID
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, PROCESSING, COMPLETED, FAILED] }
 *       - in: query
 *         name: sortBy
 *         description: "Column to sort by (default `createdAt`). Unknown values return 400."
 *         schema: { type: string, enum: [payoutRef, amount, currencyCode, status, stripeTransferId, processedAt, createdAt], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: from
 *         schema: { type: string, example: '2026-01-01' }
 *       - in: query
 *         name: to
 *         schema: { type: string, example: '2026-12-31' }
 *     responses:
 *       200:
 *         description: Paginated payouts list.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader payouts retrieved successfully.
 *               data:
 *                 - id: uuid
 *                   payoutRef: PO-ABCD1234
 *                   amount: 420.5
 *                   currencyCode: EUR
 *                   status: COMPLETED
 *                   stripeTransferId: tr_xxx
 *                   processedAt: '2026-09-02T10:00:00.000Z'
 *                   createdAt: '2026-09-01T10:00:00.000Z'
 *                   bank:
 *                     bankName: AIB
 *                     bankHolderName: Acme Plumbing Ltd
 *                     accountNumberMasked: '****1234'
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/traders/:id/payouts',
  validate(traderPayoutsQuerySchema),
  controller.listPayouts
);

/**
 * @swagger
 * /admin/traders/{id}/payouts:
 *   post:
 *     summary: Payouts & Earnings — send payout to trader (Stripe transfer)
 *     description: |
 *       Transfers `amount` from the Brisk Stripe balance to the trader's connected Stripe
 *       account (trader must finish `POST /traders/payouts/stripe/onboarding-link`). Stripe then
 *       pays out to the trader's bank on their payout schedule. The row appears in
 *       `GET /admin/traders/{id}/payouts` as COMPLETED (or FAILED if Stripe rejects it).
 *
 *       `currencyCode` defaults to the trader's Stripe account currency. The Brisk Stripe
 *       balance must have enough available funds in that currency.
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
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
 *             required: [amount]
 *             properties:
 *               amount: { type: number, example: 420.5 }
 *               currencyCode: { type: string, example: EUR }
 *               note: { type: string, example: September payout }
 *     responses:
 *       201:
 *         description: Payout row (same shape as the payouts list).
 *       400:
 *         description: "`STRIPE_ACCOUNT_MISSING`, `STRIPE_ACCOUNT_NOT_READY`, or Stripe error (e.g. insufficient balance)."
 *       404:
 *         description: Trader not found.
 */
router.post(
  '/traders/:id/payouts',
  validate(createTraderPayoutSchema),
  controller.createPayout
);

/**
 * @swagger
 * /admin/traders/{id}/offers/stats:
 *   get:
 *     summary: Offers tab — KPI cards
 *     description: Totals for trader-owned offers (active / expired / disabled / claims / views / revenue).
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Offers stats.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader offers stats retrieved successfully.
 *               data:
 *                 totalOffers: 8
 *                 activeOffers: 3
 *                 expiredOffers: 4
 *                 disabledOffers: 1
 *                 totalClaims: 120
 *                 totalViews: 900
 *                 revenueGenerated: 2450.75
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/traders/:id/offers/stats',
  validate(traderDetailsIdParamSchema),
  controller.getOffersStats
);

/**
 * @swagger
 * /admin/traders/{id}/offers:
 *   get:
 *     summary: Offers tab — list trader offers
 *     description: |
 *       Paginated trader offers (`offerType=TRADER` only).
 *
 *       **Filters:** `status`, `categoryId`, `search`, `sortBy`, `sortOrder`, `from`, `to`, `page`, `limit`
 *
 *       **Offer statuses:** `ACTIVE`, `EXPIRED`, `DISABLED`
 *     tags: ['Admin / Trader Details']
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
 *         schema: { type: string }
 *         description: Search title, offerCode, couponCode
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, EXPIRED, DISABLED] }
 *         description: Effective status. `EXPIRED` includes ACTIVE offers whose `validUntil` is in the past; `ACTIVE` excludes them.
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: sortBy
 *         description: "Column to sort by (default `createdAt`). Unknown values return 400. `status` = effective status (ACTIVE past validUntil sorts as EXPIRED)."
 *         schema: { type: string, enum: [offerCode, title, couponCode, discountType, discountValue, categoryName, validFrom, validUntil, status, claimsCount, revenueGenerated, viewsCount, createdAt, updatedAt], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: from
 *         schema: { type: string, example: '2026-01-01' }
 *       - in: query
 *         name: to
 *         schema: { type: string, example: '2026-12-31' }
 *     responses:
 *       200:
 *         description: Paginated offers list (same shape as admin offers serializer).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader offers retrieved successfully.
 *               data:
 *                 - id: 0d6b1f6e-0000-4000-8000-000000000060
 *                   offerId: 0d6b1f6e-0000-4000-8000-000000000060
 *                   offerCode: OFF-1004
 *                   offerType: TRADER
 *                   title: 10% off Pest Control
 *                   badgeTag: special_local_promo
 *                   couponCode: PEST10BRISK
 *                   shortDescription: Save on pest control this month
 *                   fullDescription: Valid for residential properties only.
 *                   description: Valid for residential properties only.
 *                   bannerImageUrl: 'https://api.brisk.ie/uploads/offers/pest.jpg'
 *                   discountType: PERCENTAGE
 *                   discountValue: 10
 *                   currencyCode: EUR
 *                   discountLabel: 10% off
 *                   validFrom: '2026-08-01T00:00:00.000Z'
 *                   validUntil: '2026-12-31T23:59:59.000Z'
 *                   status: ACTIVE
 *                   storedStatus: ACTIVE
 *                   claimsCount: 8
 *                   revenueGenerated: 960
 *                   viewsCount: 240
 *                   ctaLabel: Claim Offer
 *                   ctaAction: CLAIM
 *                   createdAt: '2026-07-28T09:00:00.000Z'
 *                   updatedAt: '2026-08-02T12:00:00.000Z'
 *                   createdBy: null
 *                   traderId: 4d5e6f70-0000-4000-8000-000000000030
 *                   trader:
 *                     id: 4d5e6f70-0000-4000-8000-000000000030
 *                     businessName: Byrne Pest Control
 *                     traderType: COMPANY
 *                     fullName: John Byrne
 *                     displayName: Byrne Pest Control
 *                     avgRating: 4.7
 *                     reviewsCount: 23
 *                     topRated: true
 *                     isVerified: true
 *                     yearsExperience: 10
 *                     experienceLabel: 10+ Yrs
 *                     jobsDoneCount: 54
 *                     city: Dublin
 *                     country: Ireland
 *                     location: 'Dublin, Ireland'
 *                     profilePhotoUrl: null
 *                     imageUrl: null
 *                   termsAndConditions: Valid for residential properties only.
 *                   expiresOn: '2026-12-31T23:59:59.000Z'
 *                   categoryLabel: Pest Control
 *                   primaryCategory: { id: e076d231-b0da-46cb-b60d-8aa9fbb8ce26, name: Pest Control, categoryCode: CAT-0007, iconName: pest, iconUrl: 'https://api.brisk.ie/uploads/categories/pest.svg' }
 *                   categories:
 *                     - { id: e076d231-b0da-46cb-b60d-8aa9fbb8ce26, name: Pest Control, categoryCode: CAT-0007, iconName: pest, iconUrl: 'https://api.brisk.ie/uploads/categories/pest.svg' }
 *                   subcategories:
 *                     - { id: 8a44f8fb-1598-40c9-a658-7f3db5748f14, name: Rodent Control, categoryId: e076d231-b0da-46cb-b60d-8aa9fbb8ce26, siteVisitEnabled: false, siteVisitFee: 0, priceEnabled: true, priceEnteredBy: TRADER }
 *                   siteVisitEnabled: false
 *                   priceEnabled: true
 *                   siteVisitFee: 0
 *                   priceEnteredBy: TRADER
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/traders/:id/offers',
  validate(traderOffersQuerySchema),
  controller.listOffers
);

export default router;
