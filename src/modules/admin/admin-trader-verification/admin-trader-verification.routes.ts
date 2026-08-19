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
 *     tags: ['Admin / Trader Verification']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved.
 */
router.get('/trader-verification/stats', controller.getStats);

/**
 * @swagger
 * /admin/trader-verification/queue:
 *   get:
 *     summary: List traders awaiting or completed verification review
 *     tags: ['Admin / Trader Verification']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue retrieved.
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
 *     responses:
 *       200:
 *         description: Detail retrieved.
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
 *     summary: Approve or reject trader verification
 *     tags: ['Admin / Trader Verification']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Approve (`VERIFIED`) or reject (`REJECTED`) a submitted trader application.
 *
 *       On **approve**, the trader's existing access and refresh tokens are revoked immediately
 *       so the app logs them out. They must log in again to receive `nextStep: TRADER_HOME`.
 *       Mobile should treat `401` with `data.code = SESSION_INVALIDATED` as a forced logout.
 *     responses:
 *       200:
 *         description: Verification updated. Approved traders are logged out of existing sessions.
 */
router.patch(
  '/trader-verification/:traderId',
  validate(reviewTraderSchema),
  controller.review
);

export default router;
