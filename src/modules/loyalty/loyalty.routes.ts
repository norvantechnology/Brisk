import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './loyalty.controller';
import {
  claimLoyaltyOfferBodySchema,
  loyaltyOfferIdParamSchema,
} from './loyalty.validation';

const router = Router();
const loyaltyUsers = [authMiddleware, roleMiddleware(['CUSTOMER', 'TRADER'])];

/**
 * @swagger
 * /loyalty/account:
 *   get:
 *     summary: Get user BRP points balance
 *     tags: ['Loyalty']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Offers → Loyalty tab header ("Your BRISK points balance").
 *     responses:
 *       200:
 *         description: "pointsBalance and accountId"
 */
router.get('/account', ...loyaltyUsers, controller.getAccount);

/**
 * @swagger
 * /loyalty/offers:
 *   get:
 *     summary: List BRP-redeemable loyalty offers
 *     tags: ['Loyalty']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Offers → Loyalty tab list.
 *       Returns **active** offers created by Admin.
 *       Each offer includes `status`: `available` | `claimed` | `insufficient_points`, and `canRedeem`.
 *       Claimed offers cannot be redeemed again (`canRedeem: false`, `status: claimed`).
 *     responses:
 *       200:
 *         description: "pointsBalance and offers array"
 */
router.get('/offers', ...loyaltyUsers, controller.listOffers);

/**
 * @swagger
 * /loyalty/offers/{id}/claim:
 *   post:
 *     summary: Claim loyalty points for an offer (by offer ID in path)
 *     tags: ['Loyalty']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Offers → Loyalty tab → "Claim now" button.
 *       Deducts the required BRP points from the user's balance and creates a redemption with a unique `redeemCode`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Loyalty offer claimed successfully with redeemCode and updated balance.
 *       400:
 *         description: Insufficient points or offer not active.
 *       409:
 *         description: Already claimed.
 */
router.post(
  ['/offers/:id/claim', '/offers/:id/redeem'],
  ...loyaltyUsers,
  validate(loyaltyOfferIdParamSchema),
  controller.claimOffer
);

/**
 * @swagger
 * /loyalty/offers/claim:
 *   post:
 *     summary: Claim loyalty points for an offer (JSON body)
 *     tags: ['Loyalty']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - offerId
 *             properties:
 *               offerId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Loyalty offer claimed successfully.
 *       400:
 *         description: Insufficient points or offer not active.
 *       409:
 *         description: Already claimed.
 */
router.post(
  '/offers/claim',
  ...loyaltyUsers,
  validate(claimLoyaltyOfferBodySchema),
  controller.claimOffer
);

/**
 * @swagger
 * /loyalty/redemptions:
 *   get:
 *     summary: List user's loyalty redemptions
 *     tags: ['Loyalty']
 *     security:
 *       - bearerAuth: []
 *     description: Claimed loyalty rewards with redeem codes for the wallet / claimed badge UI.
 *     responses:
 *       200:
 *         description: "pointsBalance and redemptions array"
 */
router.get('/redemptions', ...loyaltyUsers, controller.listRedemptions);

/**
 * @swagger
 * /loyalty/test-add-points:
 *   post:
 *     summary: Add test BRP points to user balance (Development & testing)
 *     tags: ['Loyalty']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               points: { type: integer, default: 500 }
 *     responses:
 *       200:
 *         description: Points added successfully.
 */
router.post('/test-add-points', ...loyaltyUsers, controller.addTestPoints);

export default router;

