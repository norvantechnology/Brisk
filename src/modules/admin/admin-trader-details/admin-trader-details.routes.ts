import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-trader-details.controller';
import {
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
 *         schema: { type: string, enum: [uploadedAt, name, status, reviewedAt], default: uploadedAt }
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
 *                   uploadedAt: '2026-09-10T10:00:00.000Z'
 *                   reviewedAt: null
 *                   reviewedById: null
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       401:
 *         description: Unauthorized.
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
 *         schema: { type: string, enum: [createdAt, scheduledDate, amount, status, title], default: createdAt }
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
 *         description: Paginated jobs (`data` array includes `siteVisitStatus`).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader jobs retrieved successfully.
 *               data:
 *                 - id: uuid
 *                   jobRef: JOB-0001
 *                   title: Boiler repair
 *                   customer: { id: uuid, fullName: Jane Doe, email: jane@example.com }
 *                   service: Boiler repair
 *                   category: { id: uuid, name: Plumbing }
 *                   subcategory: { id: uuid, name: Boilers }
 *                   date: '2026-09-01T09:00:00.000Z'
 *                   createdAt: '2026-08-28T12:00:00.000Z'
 *                   scheduledDate: '2026-09-01T09:00:00.000Z'
 *                   amount: 180
 *                   currencyCode: EUR
 *                   status: COMPLETED
 *                   siteVisitRequested: true
 *                   siteVisitFee: 40
 *                   siteVisitStatus: COMPLETED
 *                   bookingId: uuid
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       401:
 *         description: Unauthorized.
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
 *         schema: { type: string, enum: [createdAt, stars], default: createdAt }
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
 *       401:
 *         description: Unauthorized.
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
 *         schema: { type: string, enum: [createdAt, amount, status, processedAt], default: createdAt }
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
 *       401:
 *         description: Unauthorized.
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
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, claimsCount, viewsCount, validUntil, title], default: createdAt }
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
 *                 - id: uuid
 *                   offerCode: OFF-1001
 *                   title: 10% off plumbing
 *                   status: ACTIVE
 *                   claimsCount: 12
 *                   viewsCount: 80
 *                   validUntil: '2026-12-31T23:59:59.000Z'
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/traders/:id/offers',
  validate(traderOffersQuerySchema),
  controller.listOffers
);

export default router;
