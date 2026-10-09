import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-offers.controller';
import {
  createOfferSchema,
  offerFilterSchema,
  offerIdParamSchema,
  offerStatusSchema,
  updateOfferSchema,
} from './admin-offers.validation';

const router = Router();
router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/offers/stats:
 *   get:
 *     summary: Offer list KPI cards
 *     tags: ['Admin / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Admin screen:** Offers & Promotions → Offer List & Management (top KPI row).
 *
 *       Returns Total Offers (with platform/trader split), Active, Total Claims, Revenue Generated, Avg Conversion %.
 *     responses:
 *       200:
 *         description: KPI cards for the offer list page.
 */
router.get('/offers/stats', controller.getStats);

/**
 * @swagger
 * /admin/offers/analytics:
 *   get:
 *     summary: Offers analytics & statistics tab
 *     tags: ['Admin / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Admin screen:** Offers & Promotions → Analytics & Statistics.
 *
 *       KPIs: Total / Admin(Platform) / Trader / Active / Expired / Claims / Used / Unused / Discount Given.
 *       Table: offer name, created by/trader, category, valid until, claims, used, discount, status.
 *     responses:
 *       200:
 *         description: Analytics KPIs plus offer breakdown rows.
 */
router.get('/offers/analytics', controller.getAnalytics);

/**
 * @swagger
 * /admin/offers:
 *   get:
 *     summary: List marketplace offers (paginated)
 *     tags: ['Admin / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Admin screen:** Offers & Promotions → Offer List & Management table.
 *
 *       Columns: OFFER ID (`OFF-####`), Title + Coupon, TYPE (`PLATFORM`/`TRADER`), Created By, Trader, Category, Sub Category, Discount, Valid From/Until, Status.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number for the offers table.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Rows per page (max 100).
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: |
 *           **Purpose:** Search box on Offer List.
 *           **Matches:** offer ID (`OFF-####`), title, coupon code, trader name / business name.
 *           **Example:** `?search=PEST10`
 *       - in: query
 *         name: offerType
 *         schema: { type: string, enum: [PLATFORM, TRADER] }
 *         description: |
 *           **Purpose:** Offer Type filter (`PLATFORM` = Brisk/admin offer, `TRADER` = trader-authored).
 *           Omit for all types.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, EXPIRED, DISABLED] }
 *         description: |
 *           **Purpose:** Status filter. `EXPIRED` includes ACTIVE rows whose `validUntil` is in the past.
 *           Omit for all statuses.
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *         description: |
 *           **Purpose:** Category filter. One UUID or comma-separated UUIDs.
 *           **Example:** `?categoryId=uuid` or `?categoryId=uuid1,uuid2`
 *       - in: query
 *         name: subcategoryId
 *         schema: { type: string }
 *         description: |
 *           **Purpose:** Sub-category filter. One UUID or comma-separated UUIDs.
 *       - in: query
 *         name: traderId
 *         schema: { type: string }
 *         description: Filter by trader UUID (or comma-separated list).
 *       - in: query
 *         name: discountType
 *         schema: { type: string, enum: [FLAT, PERCENTAGE, FREE_SERVICE] }
 *         description: |
 *           **Purpose:** Discount column filter (`Fixed €N` / `%` / `Free Visit`).
 *       - in: query
 *         name: dateRange
 *         schema: { type: string, enum: [today, yesterday, last_7_days, last_30_days, custom] }
 *         description: |
 *           **Purpose:** Restrict offers whose validity window overlaps this range.
 *           For `custom`, also pass `from` and `to`.
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Custom range start (`dateRange=custom`).
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: Custom range end (`dateRange=custom`).
 *       - in: query
 *         name: sortBy
 *         description: |
 *           Any table column. `status` = effective status (ACTIVE past validUntil sorts as EXPIRED) ·
 *           `traderName` = business name, else trader full name · `categoryName` = first linked category ·
 *           `claimsCount` = claim rows. Empty values are always last.
 *         schema:
 *           type: string
 *           enum: [offerCode, title, offerType, couponCode, discountType, discountValue, traderName, categoryName, validFrom, validUntil, status, claimsCount, revenueGenerated, viewsCount, createdAt, updatedAt]
 *           default: createdAt
 *       - $ref: '#/components/parameters/AdminSortOrder'
 *     responses:
 *       200:
 *         description: Paginated offer list (`data.offers` + `data.meta`).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Offers retrieved successfully.
 *               data:
 *                 meta: { total: 12, page: 1, limit: 10, totalPages: 2 }
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
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 *   post:
 *     summary: Create platform offer
 *     tags: ['Admin / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Admin screen:** + Create Platform Offer.
 *
 *       Creates `offerType=PLATFORM`. Optionally pass `traderId` to tie a Brisk offer to a trader.
 *       If `couponCode` is set, a matching promo code row is also created.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, discountType, discountValue, validFrom, validUntil]
 *             properties:
 *               title: { type: string, example: 10% off Pest Control }
 *               couponCode: { type: string, example: PEST10BRISK }
 *               shortDescription: { type: string }
 *               fullDescription: { type: string }
 *               bannerImageUrl: { type: string, format: uri }
 *               badgeTag: { type: string, example: special_local_promo, description: Brisk Offers tag e.g. special_local_promo, limited_availability }
 *               discountType: { type: string, enum: [FLAT, PERCENTAGE, FREE_SERVICE], description: FLAT = Fixed €N, PERCENTAGE = %, FREE_SERVICE = Free Visit }
 *               discountValue: { type: number, example: 10 }
 *               discountLabel: { type: string, example: 10% off }
 *               validFrom: { type: string, format: date-time }
 *               validUntil: { type: string, format: date-time }
 *               categoryIds:
 *                 type: array
 *                 description: Multi-select category UUIDs. Example `["uuid1"]` or `["uuid1","uuid2"]`.
 *                 items: { type: string, format: uuid }
 *               subcategoryIds:
 *                 type: array
 *                 description: Multi-select sub-category UUIDs. Example `["uuid1","uuid2"]`.
 *                 items: { type: string, format: uuid }
 *               traderId: { type: string, format: uuid, nullable: true }
 *               ctaLabel: { type: string, example: Claim Offer }
 *               ctaAction: { type: string, enum: [CLAIM, BOOK_INSPECTION] }
 *               status: { type: string, enum: [ACTIVE, DISABLED, EXPIRED] }
 *           example:
 *             title: 10% off Pest Control
 *             couponCode: PEST10BRISK
 *             shortDescription: Save on pest control this month
 *             discountType: PERCENTAGE
 *             discountValue: 10
 *             validFrom: '2026-08-01T00:00:00.000Z'
 *             validUntil: '2026-09-30T23:59:59.000Z'
 *             categoryIds:
 *               - e076d231-b0da-46cb-b60d-8aa9fbb8ce26
 *             subcategoryIds:
 *               - 8a44f8fb-1598-40c9-a658-7f3db5748f14
 *             ctaAction: CLAIM
 *     responses:
 *       201:
 *         description: Platform offer created. Response is the offer object in `data` (no extra wrapper).
 */
router.get('/offers', validate(offerFilterSchema), controller.listOffers);
router.post('/offers', validate(createOfferSchema), controller.createOffer);

/**
 * @swagger
 * /admin/offers/{id}:
 *   get:
 *     summary: Get one offer by ID
 *     tags: ['Admin / Offers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Offer UUID from the list (`data.offers[].id`), not the OFF-#### code.
 *     responses:
 *       200:
 *         description: Offer detail.
 *       404:
 *         description: Offer not found.
 *   patch:
 *     summary: Update an offer
 *     tags: ['Admin / Offers']
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
 *               couponCode: { type: string, nullable: true }
 *               discountType: { type: string, enum: [FLAT, PERCENTAGE, FREE_SERVICE] }
 *               discountValue: { type: number }
 *               validFrom: { type: string, format: date-time }
 *               validUntil: { type: string, format: date-time }
 *               categoryIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               subcategoryIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               status: { type: string, enum: [ACTIVE, DISABLED, EXPIRED] }
 *     responses:
 *       200:
 *         description: Offer updated.
 */
router.get('/offers/:id', validate(offerIdParamSchema), controller.getOffer);
router.patch('/offers/:id', validate(updateOfferSchema), controller.updateOffer);

/**
 * @swagger
 * /admin/offers/{id}/status:
 *   patch:
 *     summary: Enable, disable, or expire an offer
 *     tags: ['Admin / Offers']
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
 *           example:
 *             status: DISABLED
 *     responses:
 *       200:
 *         description: Status updated.
 */
router.patch('/offers/:id/status', validate(offerStatusSchema), controller.updateOfferStatus);

/**
 * @swagger
 * /admin/reports/offers:
 *   get:
 *     summary: Offers performance report
 *     tags: ['Admin / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Alias of `GET /admin/offers/analytics` for Reports → Offers & Promotions (`GET /admin/reports/offers`).
 *     responses:
 *       200:
 *         description: Same payload as `/admin/offers/analytics`.
 */
router.get('/reports/offers', controller.getAnalytics);

export default router;
