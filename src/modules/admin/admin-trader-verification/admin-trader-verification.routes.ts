import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-trader-verification.controller';
import {
  reviewTraderSchema,
  traderIdParamSchema,
  verificationQueueSchema,
} from './admin-trader-verification.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/trader-verification/stats:
 *   get:
 *     summary: Trader verification KPI counts
 *     description: |
 *       Counts for the **Documents / verification queue** (not the All Traders KPI cards).
 *       For All Traders cards use `GET /admin/traders/stats`.
 *     tags: ['Admin / Trader Verification']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader verification stats retrieved successfully.
 *               data:
 *                 pending: 1
 *                 verified: 10
 *                 rejected: 2
 *                 submitted: 3
 *       401:
 *         description: Unauthorized.
 */
router.get('/trader-verification/stats', controller.getStats);

/**
 * @swagger
 * /admin/trader-verification/queue:
 *   get:
 *     summary: List traders awaiting or completed verification review
 *     description: |
 *       Onboarding document review queue (sidebar **Documents**).
 *       For the main Traders Management table use `GET /admin/traders`.
 *     tags: ['Admin / Trader Verification']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, VERIFIED, REJECTED, SUSPENDED] }
 *       - in: query
 *         name: entityType
 *         schema: { type: string, enum: [SOLO, COMPANY] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Queue retrieved.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader verification queue retrieved successfully.
 *               data:
 *                 - id: f0f8b572-de03-48d2-a080-34b8966082a6
 *                   traderCode: TRD-1001
 *                   traderType: SOLO
 *                   businessName: The Book Nook
 *                   verificationStatus: PENDING
 *                   onboardingStatus: SUBMITTED
 *               meta:
 *                 total: 1
 *                 page: 1
 *                 limit: 10
 *                 totalPages: 1
 *       401:
 *         description: Unauthorized.
 */
router.get(
  '/trader-verification/queue',
  validate(verificationQueueSchema),
  controller.listQueue
);

/**
 * @swagger
 * /admin/trader-verification/{traderId}:
 *   get:
 *     summary: Full trader onboarding detail with documents for admin review
 *     tags: ['Admin / Trader Verification']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: traderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Detail retrieved (trader + documents + documentRequirements).
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.get(
  '/trader-verification/:traderId',
  validate(traderIdParamSchema),
  controller.getDetail
);

/**
 * @swagger
 * /admin/trader-verification/{traderId}:
 *   patch:
 *     summary: Approve or reject trader verification (document review)
 *     tags: ['Admin / Trader Verification']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Approve (`VERIFIED`) or reject (`REJECTED`) a **submitted** onboarding application.
 *
 *       On **approve**, the trader's existing access and refresh tokens are revoked immediately
 *       so the app logs them out. They must log in again to receive `nextStep: TRADER_HOME`.
 *       Mobile should treat `401` with `data.code = SESSION_INVALIDATED` as a forced logout.
 *
 *       For quick verification badge changes from All Traders table, you may also use
 *       `PATCH /admin/traders/{id}/verification`.
 *     parameters:
 *       - in: path
 *         name: traderId
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
 *               verificationStatus: { type: string, enum: [VERIFIED, REJECTED], example: 'VERIFIED' }
 *               rejectionReason: { type: string, example: 'Incomplete insurance document' }
 *           examples:
 *             approve:
 *               value: { verificationStatus: VERIFIED }
 *             reject:
 *               value:
 *                 verificationStatus: REJECTED
 *                 rejectionReason: Incomplete insurance document
 *     responses:
 *       200:
 *         description: Verification updated. Approved traders are logged out of existing sessions.
 *       400:
 *         description: Only submitted applications can be reviewed / validation error.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.patch(
  '/trader-verification/:traderId',
  validate(reviewTraderSchema),
  controller.review
);

export default router;
