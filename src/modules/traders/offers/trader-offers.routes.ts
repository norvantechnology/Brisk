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
 *     summary: Create Offers — Publish Offer (trader)
 *     tags: ['Trader / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Create Offers → **Publish Offer**.
 *
 *       Creates `offerType=TRADER` owned by the logged-in trader.
 *       Customers see it on Offers → Traders Offers while ACTIVE and in date range.
 *
 *       **Figma field → API key mapping:**
 *       | UI label | Body key | Notes |
 *       |----------|----------|-------|
 *       | Offer Type % / Flat | `discountType` | `PERCENTAGE` or `FLAT` (`FREE_SERVICE` also allowed) |
 *       | Offer Value | `discountValue` | e.g. 10 for 10% or €10 |
 *       | Offer Headline | `title` | Card headline e.g. "€10 off your first job" |
 *       | Category | `categoryIds[]` | UUID array (one or many) |
 *       | Sub-category | `subcategoryIds[]` | UUID array |
 *       | Expiry Date | `validUntil` | ISO date/datetime from picker |
 *       | **Description & Terms** | **`description`** | Multi-line text box — conditions / T&Cs |
 *
 *       Prefer sending **`description`** for Description & Terms.
 *       Aliases also accepted: `fullDescription`, `termsAndConditions` (same storage).
 *       Response returns all of: `description`, `fullDescription`, `termsAndConditions`.
 *
 *       Active/Deactive toggle after create: `PATCH /traders/offers/{id}/status`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, discountType, discountValue, validUntil]
 *             properties:
 *               title:
 *                 type: string
 *                 example: €10 off your first job
 *                 description: **Offer Headline** on Create Offers form (card title).
 *               couponCode: { type: string, example: FIRST10, description: Optional coupon code }
 *               shortDescription:
 *                 type: string
 *                 description: Optional short card blurb (max 300). Not the Description & Terms box.
 *               description:
 *                 type: string
 *                 maxLength: 4000
 *                 example: Valid for first-time customers only. Cannot be combined with other offers.
 *                 description: |
 *                   **Description & Terms** text box (Figma).
 *                   Explain conditions / terms and conditions.
 *                   Stored as fullDescription; echoed as description + termsAndConditions in response.
 *               fullDescription:
 *                 type: string
 *                 description: Alias of `description`. Prefer `description` from mobile.
 *               termsAndConditions:
 *                 type: string
 *                 description: Alias of `description` (same Description & Terms text box).
 *               bannerImageUrl: { type: string, format: uri }
 *               discountType:
 *                 type: string
 *                 enum: [FLAT, PERCENTAGE, FREE_SERVICE]
 *                 description: |
 *                   Offer Type radios — Percentage (%) → PERCENTAGE, Flat Amount → FLAT.
 *               discountValue:
 *                 type: number
 *                 example: 10
 *                 description: Offer Value number (10 for 10% or €10 flat). Max 100 when PERCENTAGE.
 *               discountLabel: { type: string, example: "10%", description: Optional display override }
 *               validFrom:
 *                 type: string
 *                 format: date-time
 *                 description: Optional. Omit — server starts now. UI can collect only expiry.
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *                 description: **Expiry Date** from date picker (ISO). Example `2026-10-30T23:59:59.000Z` or `2026-10-30`.
 *               categoryIds:
 *                 type: array
 *                 description: Category dropdown — UUID array (Electrical → category id).
 *                 items: { type: string, format: uuid }
 *               subcategoryIds:
 *                 type: array
 *                 description: Sub-category dropdown — UUID array (Installations → subcategory id).
 *                 items: { type: string, format: uuid }
 *               ctaLabel: { type: string, example: Claim now }
 *               ctaAction: { type: string, enum: [CLAIM, BOOK_INSPECTION] }
 *           example:
 *             title: €10 off your first job
 *             discountType: PERCENTAGE
 *             discountValue: 10
 *             description: Valid for first-time customers only. Explain any conditions here.
 *             validUntil: '2026-10-30T23:59:59.000Z'
 *             categoryIds:
 *               - e076d231-b0da-46cb-b60d-8aa9fbb8ce26
 *             subcategoryIds:
 *               - 8a44f8fb-1598-40c9-a658-7f3db5748f14
 *     responses:
 *       201:
 *         description: |
 *           Offer created in `data`. Includes `description`, `fullDescription`, `termsAndConditions`
 *           (same text), plus `categories` + `subcategories`.
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
 *     summary: Update / Edit trader offer
 *     tags: ['Trader / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile:** Edit (pencil) on Offers List.
 *       Same fields as create. Send `description` to update Description & Terms.
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
 *               title: { type: string, description: Offer Headline }
 *               description:
 *                 type: string
 *                 description: Description & Terms text box
 *               fullDescription: { type: string }
 *               termsAndConditions: { type: string, description: Alias of description }
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

/**
 * @swagger
 * /traders/offers/{id}:
 *   delete:
 *     summary: Delete the trader's own offer
 *     tags: ['Trader / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Permanently deletes a trader-authored offer (`offerType=TRADER`).
 *       Claims are removed with the offer. Linked jobs/promo codes are unlinked (not deleted).
 *
 *       **Disable without delete:** `PATCH /traders/offers/{id}/status` with `{ "status": "DISABLED" }`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Offer deleted.
 *       404:
 *         description: Offer not found or not owned by this trader.
 */
router.delete('/:id', validate(offerIdParamSchema), controller.deleteMyOffer);

export default router;
