import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './trader-offers.controller';
import {
  createOfferSchema,
  offerFilterSchema,
  offerIdParamSchema,
  offerStatusSchema,
  updateOfferSchema,
} from '../../admin/admin-offers/admin-offers.validation';

const router = Router();

/**
 * @swagger
 * /traders/offers:
 *   get:
 *     summary: List the authenticated trader's offers
 *     tags: ['Trader / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns offers this trader authored (`offerType=TRADER`).
 *       Use the same filters as admin list (status, category, search, dates).
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Rows per page (max 100).
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search offer ID (`OFF-####`), title, or coupon code.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, EXPIRED, DISABLED] }
 *         description: Filter by effective status. Omit for all.
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *         description: Category UUID or comma-separated UUIDs.
 *       - in: query
 *         name: discountType
 *         schema: { type: string, enum: [FLAT, PERCENTAGE, FREE_SERVICE] }
 *         description: Discount type filter.
 *     responses:
 *       200:
 *         description: Paginated list in `data.offers`.
 *   post:
 *     summary: Create a trader offer
 *     tags: ['Trader / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates `offerType=TRADER` owned by the logged-in trader.
 *       Customers see it on Offers → Traders Offers while it is ACTIVE and in date.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, discountType, discountValue, validUntil]
 *             properties:
 *               title: { type: string, example: €5 off first job }
 *               couponCode: { type: string, example: FIRST5 }
 *               shortDescription:
 *                 type: string
 *                 description: Optional short card blurb (max 300). Not the Description & Terms field.
 *               description:
 *                 type: string
 *                 description: |
 *                   **Description & Terms** (mobile). Stored as `fullDescription`.
 *                   Send this key from the app. Response also returns `description`.
 *               fullDescription:
 *                 type: string
 *                 description: Same as `description` (alias). Prefer `description` from mobile.
 *               bannerImageUrl: { type: string, format: uri }
 *               discountType: { type: string, enum: [FLAT, PERCENTAGE, FREE_SERVICE] }
 *               discountValue: { type: number, example: 5 }
 *               discountLabel: { type: string, example: Fixed €5 }
 *               validFrom:
 *                 type: string
 *                 format: date-time
 *                 description: Optional. Omit / empty — server sets start to now. App UI can collect only expiry.
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *                 description: Required expiry date from the date picker (ISO). Example `2026-08-21T23:59:59.000Z` or `2026-08-21`.
 *               categoryIds:
 *                 type: array
 *                 description: |
 *                   Multi-select categories. UUID array.
 *                   One: `["e076d231-b0da-46cb-b60d-8aa9fbb8ce26"]`
 *                   Many: `["uuid1","uuid2"]`
 *                   Empty `[]` = no category link.
 *                 items: { type: string, format: uuid }
 *               subcategoryIds:
 *                 type: array
 *                 description: |
 *                   Multi-select sub-categories. UUID array (same style as categoryIds).
 *                   Pass IDs that belong to the selected categories.
 *                   One: `["8a44f8fb-1598-40c9-a658-7f3db5748f14"]`
 *                   Many: `["uuid1","uuid2"]`
 *                   Empty `[]` or omit = no subcategory link.
 *                 items: { type: string, format: uuid }
 *               ctaLabel: { type: string, example: Claim now }
 *               ctaAction: { type: string, enum: [CLAIM, BOOK_INSPECTION] }
 *           example:
 *             title: €5 off first job
 *             discountType: FLAT
 *             discountValue: 5
 *             validUntil: '2026-12-31T23:59:59.000Z'
 *             categoryIds:
 *               - e076d231-b0da-46cb-b60d-8aa9fbb8ce26
 *             subcategoryIds:
 *               - 8a44f8fb-1598-40c9-a658-7f3db5748f14
 *               - 769c87fc-f67f-4a8f-b25c-9fadd1aaab90
 *     responses:
 *       201:
 *         description: Offer created. Response is the offer object in `data` (includes `categories` + `subcategories`).
 */
router.get('/', validate(offerFilterSchema), controller.listMyOffers);
router.post('/', validate(createOfferSchema), controller.createMyOffer);

/**
 * @swagger
 * /traders/offers/{id}:
 *   get:
 *     summary: Get one of the trader's offers
 *     tags: ['Trader / Offers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Offer UUID.
 *     responses:
 *       200:
 *         description: Offer detail.
 *       404:
 *         description: Not found or not owned by this trader.
 *   patch:
 *     summary: Update one of the trader's offers
 *     tags: ['Trader / Offers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               discountType: { type: string, enum: [FLAT, PERCENTAGE, FREE_SERVICE] }
 *               discountValue: { type: number }
 *               validFrom: { type: string, format: date-time }
 *               validUntil: { type: string, format: date-time }
 *               categoryIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 description: Multi-select category UUIDs.
 *               subcategoryIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 description: Multi-select sub-category UUIDs.
 *               status: { type: string, enum: [ACTIVE, DISABLED, EXPIRED] }
 *     responses:
 *       200:
 *         description: Offer updated.
 */
router.get('/:id', validate(offerIdParamSchema), controller.getMyOffer);
router.patch('/:id', validate(updateOfferSchema), controller.updateMyOffer);

/**
 * @swagger
 * /traders/offers/{id}/status:
 *   patch:
 *     summary: Enable, disable, or expire the trader's offer
 *     tags: ['Trader / Offers']
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
 *               status: { type: string, enum: [ACTIVE, DISABLED, EXPIRED] }
 *     responses:
 *       200:
 *         description: Status updated.
 */
router.patch('/:id/status', validate(offerStatusSchema), controller.updateMyOfferStatus);

export default router;
