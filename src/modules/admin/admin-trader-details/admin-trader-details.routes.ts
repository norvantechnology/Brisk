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
 *       Nested APIs for Trader Details tabs (excluding Profile Overview).
 *       Auth: admin Bearer. Approve/reject documents still uses
 *       `PATCH /admin/trader-verification/{traderId}/documents/{documentId}`.
 */

/**
 * @swagger
 * /admin/traders/{id}/documents/stats:
 *   get:
 *     summary: Document compliance KPIs for trader details
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Compliance %, active credentials, last verified date.
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
 *     summary: List trader verification documents
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
 *         description: Search document name, key, or file name
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, EXPIRED] }
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [ENTITY, CATEGORY, ALL] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [uploadedAt, name, status, reviewedAt] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string, example: '2026-01-01' }
 *       - in: query
 *         name: to
 *         schema: { type: string, example: '2026-12-31' }
 *     responses:
 *       200:
 *         description: Paginated documents list.
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
 *     summary: Jobs KPI cards for trader details
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Total/completed jobs, visit fees, selection rate, revenue.
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
 *     summary: Assigned & completed jobs for a trader
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
 *         description: Search job ref, customer, service, category
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
 *         schema: { type: string, enum: [createdAt, scheduledDate, amount, status, title] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string, example: '2026-01-01' }
 *       - in: query
 *         name: to
 *         schema: { type: string, example: '2026-12-31' }
 *     responses:
 *       200:
 *         description: Paginated jobs list with siteVisitStatus.
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
 *     summary: Review average + star distribution
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *     summary: Customer reviews for a trader
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
  '/traders/:id/reviews',
  validate(traderReviewsQuerySchema),
  controller.listReviews
);

/**
 * @swagger
 * /admin/traders/{id}/earnings/summary:
 *   get:
 *     summary: Payouts & earnings summary cards
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *     summary: Payout transactions for a trader
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
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, PROCESSING, COMPLETED, FAILED] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, amount, status, processedAt] }
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
  '/traders/:id/payouts',
  validate(traderPayoutsQuerySchema),
  controller.listPayouts
);

/**
 * @swagger
 * /admin/traders/{id}/offers/stats:
 *   get:
 *     summary: Trader offers KPI cards
 *     tags: ['Admin / Trader Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *     summary: List trader offers
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
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, EXPIRED, DISABLED] }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, claimsCount, viewsCount, validUntil, title] }
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
  '/traders/:id/offers',
  validate(traderOffersQuerySchema),
  controller.listOffers
);

export default router;
