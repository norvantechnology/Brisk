import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './loyalty.controller';
import {
  redeemLoyaltyOfferBodySchema,
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
 * /loyalty/offers/{id}/redeem:
 *   post:
 *     summary: Redeem loyalty points for an offer (by offer ID in path)
 *     tags: ['Loyalty']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Offers → Loyalty tab → "Redeem" button.
 *       Deducts the required BRP points from the user's balance and creates a redemption with a unique `redeemCode`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Loyalty offer UUID
 *         example: "65b2f1a8-c9e1-4234-8789-0abc12345678"
 *     responses:
 *       200:
 *         description: Loyalty offer redeemed successfully with redeemCode and updated balance.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Loyalty offer redeemed successfully."
 *               data:
 *                 redeemCode: "BRC-M1XY2Z-9ABC"
 *                 validForDays: 30
 *                 validityLabel: "30 days"
 *                 pointsRedeemed: 50
 *                 pointsBalance: 450
 *                 offer:
 *                   id: "65b2f1a8-c9e1-4234-8789-0abc12345678"
 *                   title: "10% Off Plumbing Services"
 *                   description: "Redeem 50 BRP points for 10% off your next booking."
 *                   pointsRequired: 50
 *                   imageUrl: "https://cdn.example.com/images/offer.png"
 *       400:
 *         description: Insufficient points or offer not active.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Insufficient BRP points for this redemption."
 *               error:
 *                 code: "INSUFFICIENT_BRP"
 *                 data:
 *                   pointsBalance: 0
 *                   pointsRequired: 50
 *                   offerId: "65b2f1a8-c9e1-4234-8789-0abc12345678"
 *       404:
 *         description: Offer not found.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Loyalty offer not found."
 *       409:
 *         description: Already redeemed.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "You have already redeemed this loyalty offer."
 */
router.post(
  '/offers/:id/redeem',
  ...loyaltyUsers,
  validate(loyaltyOfferIdParamSchema),
  controller.redeemOffer
);

/**
 * @swagger
 * /loyalty/offers/redeem:
 *   post:
 *     summary: Redeem loyalty points for an offer (JSON body)
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
 *               offerId: { type: string, format: uuid, example: "65b2f1a8-c9e1-4234-8789-0abc12345678" }
 *     responses:
 *       200:
 *         description: Loyalty offer redeemed successfully.
 *       400:
 *         description: Insufficient points or offer not active.
 *       409:
 *         description: Already redeemed.
 */
router.post(
  '/offers/redeem',
  ...loyaltyUsers,
  validate(redeemLoyaltyOfferBodySchema),
  controller.redeemOffer
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

