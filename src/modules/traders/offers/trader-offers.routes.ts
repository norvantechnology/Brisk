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
 *       Returns offers this trader authored (`offerType=TRADER`). Default order: `createdAt` desc.
 *
 *       Example: `GET /traders/offers?page=1&limit=10&search=PEST&status=ACTIVE&categoryId=e076d231-b0da-46cb-b60d-8aa9fbb8ce26&discountType=PERCENTAGE&dateRange=custom&from=2026-09-01&to=2026-09-30&sortBy=validUntil&sortOrder=asc`
 *     parameters:
 *       - $ref: '#/components/parameters/TraderPage'
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, default: 10, maximum: 100 }
 *         description: Rows per page (max 100).
 *       - in: query
 *         name: search
 *         schema: { type: string, example: PEST }
 *         description: Search offer ID (`OFF-####`), title, or coupon code.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, EXPIRED, DISABLED] }
 *         description: Filter by effective status (`EXPIRED` includes ACTIVE offers past `validUntil`). Omit for all.
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *         description: Category UUID or comma-separated UUIDs.
 *       - in: query
 *         name: subcategoryId
 *         schema: { type: string }
 *         description: Sub-category UUID or comma-separated UUIDs.
 *       - in: query
 *         name: discountType
 *         schema: { type: string, enum: [FLAT, PERCENTAGE, FREE_SERVICE] }
 *         description: Discount type filter.
 *       - in: query
 *         name: dateRange
 *         schema: { type: string, enum: [today, yesterday, last_7_days, last_30_days, custom] }
 *         description: Offers whose validity window (`validFrom`–`validUntil`) overlaps this range. For `custom`, also pass `from` and `to`.
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date, example: '2026-09-01' }
 *         description: Custom range start (`dateRange=custom`).
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date, example: '2026-09-30' }
 *         description: Custom range end (`dateRange=custom`).
 *       - in: query
 *         name: sortBy
 *         description: |
 *           `status` = effective status (ACTIVE past validUntil sorts as EXPIRED) · `categoryName` = first linked category ·
 *           `claimsCount` = claim rows. Empty values are always last.
 *         schema:
 *           type: string
 *           enum: [offerCode, title, couponCode, discountType, discountValue, categoryName, validFrom, validUntil, status, claimsCount, revenueGenerated, viewsCount, createdAt, updatedAt]
 *           default: createdAt
 *       - $ref: '#/components/parameters/TraderSortOrder'
 *     responses:
 *       200:
 *         description: Paginated list in `data.offers` + `data.meta`.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Your offers retrieved successfully.
 *               data:
 *                 meta: { total: 3, page: 1, limit: 10, totalPages: 1 }
 *                 offers:
 *                   - id: 0d6b1f6e-0000-4000-8000-000000000060
 *                     offerId: 0d6b1f6e-0000-4000-8000-000000000060
 *                     offerCode: OFF-1004
 *                     offerType: TRADER
 *                     title: 10% off Pest Control
 *                     badgeTag: special_local_promo
 *                     couponCode: PEST10BRISK
 *                     shortDescription: Save on pest control this month
 *                     fullDescription: Valid for residential properties only.
 *                     description: Valid for residential properties only.
 *                     bannerImageUrl: 'https://api.brisk.ie/uploads/offers/pest.jpg'
 *                     discountType: PERCENTAGE
 *                     discountValue: 10
 *                     currencyCode: EUR
 *                     discountLabel: 10% off
 *                     validFrom: '2026-08-01T00:00:00.000Z'
 *                     validUntil: '2026-12-31T23:59:59.000Z'
 *                     status: ACTIVE
 *                     storedStatus: ACTIVE
 *                     claimsCount: 8
 *                     revenueGenerated: 960
 *                     viewsCount: 240
 *                     ctaLabel: Claim Offer
 *                     ctaAction: CLAIM
 *                     createdAt: '2026-07-28T09:00:00.000Z'
 *                     updatedAt: '2026-08-02T12:00:00.000Z'
 *                     createdBy: null
 *                     traderId: 4d5e6f70-0000-4000-8000-000000000030
 *                     trader:
 *                       id: 4d5e6f70-0000-4000-8000-000000000030
 *                       businessName: Byrne Pest Control
 *                       traderType: COMPANY
 *                       fullName: John Byrne
 *                       displayName: Byrne Pest Control
 *                       avgRating: 4.7
 *                       reviewsCount: 23
 *                       topRated: true
 *                       isVerified: true
 *                       yearsExperience: 10
 *                       experienceLabel: 10+ Yrs
 *                       jobsDoneCount: 54
 *                       city: Dublin
 *                       country: Ireland
 *                       location: 'Dublin, Ireland'
 *                       profilePhotoUrl: null
 *                       imageUrl: null
 *                     termsAndConditions: Valid for residential properties only.
 *                     expiresOn: '2026-12-31T23:59:59.000Z'
 *                     categoryLabel: Pest Control
 *                     primaryCategory: { id: e076d231-b0da-46cb-b60d-8aa9fbb8ce26, name: Pest Control, categoryCode: CAT-0007, iconName: pest, iconUrl: 'https://api.brisk.ie/uploads/categories/pest.svg' }
 *                     categories:
 *                       - { id: e076d231-b0da-46cb-b60d-8aa9fbb8ce26, name: Pest Control, categoryCode: CAT-0007, iconName: pest, iconUrl: 'https://api.brisk.ie/uploads/categories/pest.svg' }
 *                     subcategories:
 *                       - { id: 8a44f8fb-1598-40c9-a658-7f3db5748f14, name: Rodent Control, categoryId: e076d231-b0da-46cb-b60d-8aa9fbb8ce26, siteVisitEnabled: false, siteVisitFee: 0, priceEnabled: true, priceEnteredBy: TRADER }
 *                     siteVisitEnabled: false
 *                     priceEnabled: true
 *                     siteVisitFee: 0
 *                     priceEnteredBy: TRADER
 *       400:
 *         $ref: '#/components/responses/TraderListValidationError'
 *       401:
 *         $ref: '#/components/responses/TraderUnauthorized'
 *       403:
 *         $ref: '#/components/responses/TraderForbidden'
 *       404:
 *         description: Trader profile not found.
 *         content:
 *           application/json:
 *             example: { success: false, message: 'Trader profile not found.' }
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
 *       Field mapping (Figma to API):
 *       - Offer Type % / Flat -> discountType (PERCENTAGE or FLAT; FREE_SERVICE also allowed)
 *       - Offer Value -> discountValue
 *       - Offer Headline -> title
 *       - Category -> categoryIds[]
 *       - Sub-category -> subcategoryIds[]
 *       - Expiry Date -> validUntil
 *       - Description and Terms -> description
 *
 *       Prefer sending `termsAndConditions` (or `description`) for Description and Terms.
 *       Aliases: `fullDescription`, `termsAndConditions` — all store to `fullDescription`.
 *       Empty `description: ""` will not overwrite a non-empty `termsAndConditions`.
 *       Response returns `description`, `fullDescription`, and `termsAndConditions` (same value).
 *
 *       `bannerImageUrl: ""` is treated as omitted (not a validation error).
 *       `discountValue` accepts number or numeric string.
 *
 *       Active/Deactive toggle after create: PATCH /traders/offers/{id}/status.
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
 *                 example: "10 EUR off your first job"
 *                 description: Offer Headline on Create Offers form (card title).
 *               couponCode: { type: string, example: FIRST10, description: Optional coupon code }
 *               shortDescription:
 *                 type: string
 *                 description: Optional short card blurb (max 300). Not the Description and Terms box.
 *               description:
 *                 type: string
 *                 maxLength: 4000
 *                 example: "Valid for first-time customers only. Cannot be combined with other offers."
 *                 description: Description and Terms text box. Stored as fullDescription.
 *               fullDescription:
 *                 type: string
 *                 description: Alias of description. Prefer description from mobile.
 *               termsAndConditions:
 *                 type: string
 *                 description: Alias of description (same Description and Terms text box).
 *               bannerImageUrl: { type: string, format: uri }
 *               discountType:
 *                 type: string
 *                 enum: [FLAT, PERCENTAGE, FREE_SERVICE]
 *                 description: Offer Type radios. Percentage -> PERCENTAGE, Flat Amount -> FLAT.
 *               discountValue:
 *                 type: number
 *                 example: 10
 *                 description: Offer Value number (10 for 10% or 10 EUR flat). Max 100 when PERCENTAGE.
 *               discountLabel: { type: string, example: "10%", description: Optional display override }
 *               validFrom:
 *                 type: string
 *                 format: date-time
 *                 description: Optional. Omit and server starts now.
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *                 description: Expiry Date from date picker (ISO).
 *               categoryIds:
 *                 type: array
 *                 description: Category dropdown UUID array.
 *                 items: { type: string, format: uuid }
 *               subcategoryIds:
 *                 type: array
 *                 description: Sub-category dropdown UUID array.
 *                 items: { type: string, format: uuid }
 *               ctaLabel: { type: string, example: "Claim now" }
 *               ctaAction: { type: string, enum: [CLAIM, BOOK_INSPECTION] }
 *           example:
 *             title: "10 EUR off your first job"
 *             discountType: PERCENTAGE
 *             discountValue: 10
 *             description: "Valid for first-time customers only. Explain any conditions here."
 *             validUntil: "2026-10-30T23:59:59.000Z"
 *             categoryIds:
 *               - e076d231-b0da-46cb-b60d-8aa9fbb8ce26
 *             subcategoryIds:
 *               - 8a44f8fb-1598-40c9-a658-7f3db5748f14
 *     responses:
 *       201:
 *         description: Offer created in data with description aliases plus categories and subcategories.
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
