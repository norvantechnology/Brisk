import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-loyalty.controller';
import {
  createLoyaltyOfferSchema,
  listLoyaltyOffersSchema,
  loyaltyOfferIdParamSchema,
  updateLoyaltyOfferSchema,
} from './admin-loyalty.validation';

const router = Router();
router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/loyalty/offers:
 *   get:
 *     summary: List loyalty / BRP offers (Admin)
 *     tags: ['Admin / Loyalty']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Admin → Loyalty / BRP Offers management.**
 *       Offers created here appear dynamically on customer `GET /loyalty/offers`.
 *     parameters:
 *       - $ref: '#/components/parameters/AdminPage'
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: search
 *         description: Title or description.
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *       - in: query
 *         name: minPoints
 *         schema: { type: integer, minimum: 0, example: 100 }
 *       - in: query
 *         name: maxPoints
 *         schema: { type: integer, minimum: 0, example: 1000 }
 *       - in: query
 *         name: sortBy
 *         description: Omit for the default order (status, then pointsRequired ascending, then newest).
 *         schema: { type: string, enum: [title, pointsRequired, status, redemptionsCount, createdAt, updatedAt] }
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         description: Paginated loyalty offers.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Loyalty offers retrieved successfully.
 *               data:
 *                 meta: { total: 3, page: 1, limit: 20, totalPages: 1 }
 *                 offers:
 *                   - id: 9a8b7c6d-0000-4000-8000-000000000070
 *                     title: €10 off your next job
 *                     pointsRequired: 500
 *                     description: Redeem 500 BRP for €10 off any booking.
 *                     imageUrl: 'https://api.brisk.ie/uploads/loyalty/10-off.png'
 *                     status: active
 *                     redemptionsCount: 14
 *                     createdAt: '2026-08-01T09:00:00.000Z'
 *                     updatedAt: '2026-08-01T09:00:00.000Z'
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 */
router.get('/loyalty/offers', validate(listLoyaltyOffersSchema), controller.listLoyaltyOffers);

/**
 * @swagger
 * /admin/loyalty/offers:
 *   post:
 *     summary: Create loyalty / BRP offer (Admin)
 *     tags: ['Admin / Loyalty']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, pointsRequired]
 *             properties:
 *               title: { type: string, example: 'Claim 100 BRP at Grand Heritage Hotel' }
 *               pointsRequired: { type: integer, example: 100 }
 *               description: { type: string }
 *               imageUrl: { type: string, format: uri }
 *               status: { type: string, enum: [active, inactive], example: active }
 *     responses:
 *       201:
 *         description: Loyalty offer created.
 */
router.post('/loyalty/offers', validate(createLoyaltyOfferSchema), controller.createLoyaltyOffer);

/**
 * @swagger
 * /admin/loyalty/offers/{id}:
 *   get:
 *     summary: Get one loyalty offer (Admin)
 *     tags: ['Admin / Loyalty']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Loyalty offer detail.
 */
router.get(
  '/loyalty/offers/:id',
  validate(loyaltyOfferIdParamSchema),
  controller.getLoyaltyOffer
);

/**
 * @swagger
 * /admin/loyalty/offers/{id}:
 *   put:
 *     summary: Update loyalty offer (Admin)
 *     tags: ['Admin / Loyalty']
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
 *               title: { type: string }
 *               pointsRequired: { type: integer }
 *               description: { type: string }
 *               imageUrl: { type: string, format: uri }
 *               status: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Loyalty offer updated.
 */
router.put(
  '/loyalty/offers/:id',
  validate(updateLoyaltyOfferSchema),
  controller.updateLoyaltyOffer
);

/**
 * @swagger
 * /admin/loyalty/offers/{id}:
 *   delete:
 *     summary: Delete loyalty offer (Admin)
 *     tags: ['Admin / Loyalty']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Loyalty offer deleted.
 */
router.delete(
  '/loyalty/offers/:id',
  validate(loyaltyOfferIdParamSchema),
  controller.deleteLoyaltyOffer
);

export default router;
