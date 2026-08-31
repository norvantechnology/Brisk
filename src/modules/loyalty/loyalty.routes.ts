import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './loyalty.controller';
import { loyaltyOfferIdParamSchema } from './loyalty.validation';

const router = Router();

/**
 * @swagger
 * /loyalty/account:
 *   get:
 *     summary: Get customer BRP points balance
 *     tags: ['Customer / Loyalty']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Offers → Loyalty tab header ("Your BRISK points balance").
 *     responses:
 *       200:
 *         description: `{ pointsBalance, accountId }`
 */
router.get(
  '/account',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  controller.getAccount
);

/**
 * @swagger
 * /loyalty/offers:
 *   get:
 *     summary: List BRP-redeemable loyalty offers
 *     tags: ['Customer / Loyalty']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Offers → Loyalty tab list.
 *       Each item includes `pointsRequired`, `claimed`, and `redeemCode` when already redeemed.
 *     responses:
 *       200:
 *         description: `{ pointsBalance, offers[] }`
 */
router.get(
  '/offers',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  controller.listOffers
);

/**
 * @swagger
 * /loyalty/offers/{id}/redeem:
 *   post:
 *     summary: Redeem a loyalty offer for BRP points
 *     tags: ['Customer / Loyalty']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Deducts points, generates a unique `redeemCode` (valid 30 days).
 *       Powers "Confirm Redemption" → "Offer Claimed!" success screen.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Redemption created with code and updated balance.
 *       400:
 *         description: Insufficient points.
 *       409:
 *         description: Already redeemed.
 */
router.post(
  '/offers/:id/redeem',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  validate(loyaltyOfferIdParamSchema),
  controller.redeemOffer
);

/**
 * @swagger
 * /loyalty/redemptions:
 *   get:
 *     summary: List customer's loyalty redemptions
 *     tags: ['Customer / Loyalty']
 *     security:
 *       - bearerAuth: []
 *     description: Claimed loyalty rewards with redeem codes for the wallet / claimed badge UI.
 *     responses:
 *       200:
 *         description: `{ pointsBalance, redemptions[] }`
 */
router.get(
  '/redemptions',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  controller.listRedemptions
);

export default router;
