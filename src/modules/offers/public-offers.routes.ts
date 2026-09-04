import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './public-offers.controller';
import {
  offerIdParamSchema,
  promoListSchema,
  publicOfferFilterSchema,
  validatePromoSchema,
} from './public-offers.validation';

const router = Router();

/**
 * @swagger
 * components:
 *   parameters:
 *     OfferDateRange:
 *       in: query
 *       name: date_range
 *       schema: { type: string, enum: [today, yesterday, last_7_days, last_30_days, custom] }
 *       description: |
 *         **Purpose:** Date Range control on the Offers filter modal.
 *         **When to use:** Restrict offers whose validity window overlaps this range.
 *         **Alias:** `dateRange` (camelCase) is also accepted.
 *         **Custom:** when value is `custom`, also send `from` and `to` (ISO dates).
 *     OfferDateFrom:
 *       in: query
 *       name: from
 *       schema: { type: string, format: date }
 *       description: Start date when `date_range=custom`. Example `2026-08-01`.
 *     OfferDateTo:
 *       in: query
 *       name: to
 *       schema: { type: string, format: date }
 *       description: End date when `date_range=custom`. Example `2026-08-31`.
 *     OfferTraderIds:
 *       in: query
 *       name: trader_ids
 *       schema: { type: string }
 *       description: |
 *         **Purpose:** Traders multi-select (search-as-you-type on the filter modal).
 *         **Format:** one UUID, comma-separated UUIDs, or repeated query keys.
 *         **Aliases:** `traderId`, `traderIds`, `trader_id`.
 *         **Example:** `?trader_ids=uuid1,uuid2`
 *     OfferDiscountType:
 *       in: query
 *       name: offer_type
 *       schema: { type: string, enum: [percentage, flat_amount, free_visit] }
 *       description: |
 *         **Purpose:** Offer type icons on trader offer cards (percent / cash / piggy-bank).
 *         Maps to discount type: `percentage` → PERCENTAGE, `flat_amount` → FLAT, `free_visit` → FREE_SERVICE.
 *         This is **not** PLATFORM vs TRADER — that is implied by `/trader-offers` vs `/brisk-offers`.
 *         **Aliases:** `offerType`, `discountType`.
 *     OfferCategoryId:
 *       in: query
 *       name: category_id
 *       schema: { type: string }
 *       description: |
 *         **Purpose:** Category multi-select with icon per category.
 *         **Format:** one UUID or comma-separated UUIDs.
 *         **Alias:** `categoryId`.
 *     OfferSubcategoryId:
 *       in: query
 *       name: subcategory_id
 *       schema: { type: string }
 *       description: Optional sub-category filter. Alias `subcategoryId`.
 *     OfferSearch:
 *       in: query
 *       name: search
 *       schema: { type: string }
 *       description: Optional search on title, coupon code, or trader name.
 *     OfferPage:
 *       in: query
 *       name: page
 *       schema: { type: integer, default: 1 }
 *       description: Page number.
 *     OfferLimit:
 *       in: query
 *       name: limit
 *       schema: { type: integer, default: 20 }
 *       description: Page size (max 100).
 */

/**
 * @swagger
 * /trader-offers:
 *   get:
 *     summary: List trader-authored offers (Traders Offers tab)
 *     tags: ['Customer / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Offers → Traders Offers list.
 *
 *       **Claim Now button:** navigate only to Offer Detail (GET /trader-offers/{id}).
 *       Do **not** call claim/accept API from the list CTA.
 *
 *       Returns active, currently valid offers with offerType=TRADER.
 *       Each card includes discountType for the type icon, claimed, and trader info:
 *       fullName, displayName (businessName or person name), avgRating, reviewsCount, topRated, isVerified,
 *       yearsExperience, experienceLabel (e.g. 10+ Yrs), city, location,
 *       profilePhotoUrl / imageUrl, plus primaryCategory.iconUrl and categoryLabel.
 *       Query params map 1:1 to the confirmed filter modal.
 *     parameters:
 *       - $ref: '#/components/parameters/OfferDateRange'
 *       - $ref: '#/components/parameters/OfferDateFrom'
 *       - $ref: '#/components/parameters/OfferDateTo'
 *       - $ref: '#/components/parameters/OfferTraderIds'
 *       - $ref: '#/components/parameters/OfferDiscountType'
 *       - $ref: '#/components/parameters/OfferCategoryId'
 *       - $ref: '#/components/parameters/OfferSubcategoryId'
 *       - $ref: '#/components/parameters/OfferSearch'
 *       - $ref: '#/components/parameters/OfferPage'
 *       - $ref: '#/components/parameters/OfferLimit'
 *     responses:
 *       200:
 *         description: Paginated trader offers in `data.offers` plus `data.meta`.
 */
router.get(
  '/trader-offers',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  validate(publicOfferFilterSchema),
  controller.listTraderOffers
);

/**
 * @swagger
 * /trader-offers/claimed:
 *   get:
 *     summary: List offers the customer has claimed
 *     tags: ['Customer / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: Claimed trader and Brisk offers for the logged-in customer (Claimed badge / next-job banner).
 *     responses:
 *       200:
 *         description: data.claims with nested offer objects.
 */
router.get(
  '/trader-offers/claimed',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  controller.listMyClaims
);

/**
 * @swagger
 * /trader-offers/{id}:
 *   get:
 *     summary: Offer Detail screen (after Claim Now navigate)
 *     tags: ['Customer / Offers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Offer UUID from data.offers[].id.
 *     description: |
 *       **Mobile screen:** Offer Detail (opened from list Claim Now — navigation only).
 *
 *       Shows banner, Description and Terms (termsAndConditions / fullDescription), expiresOn,
 *       trader.displayName / yearsExperience / experienceLabel / location.
 *
 *       **Accept Offer button** is optional: POST /trader-offers/{id}/accept for prefill,
 *       or navigate to Post a New Job with offerId from this detail. **Does not claim.**
 *       Offer is claimed only on Payment Successful (`POST /payments/{id}/confirm`).
 *     responses:
 *       200:
 *         description: |
 *           Offer detail plus actions.claimNow (navigate) and actions.acceptOffer (optional prefill).
 */
router.get(
  '/trader-offers/:id',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  validate(offerIdParamSchema),
  controller.getTraderOffer
);

/**
 * @swagger
 * /trader-offers/{id}/claim:
 *   post:
 *     summary: "[Optional alias] Same as /accept — prefill only, does NOT claim"
 *     tags: ['Customer / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Not a claim API.** Same as POST /trader-offers/{id}/accept — optional prefill only.
 *       Frontend does not need this; pass `offerId` on POST /jobs. Offer is claimed on Payment Successful.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Prefill payload; claim object empty for trader offers.
 *       409:
 *         description: Offer already USED.
 */
router.post(
  '/trader-offers/:id/claim',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  validate(offerIdParamSchema),
  controller.claimTraderOffer
);

/**
 * @swagger
 * /trader-offers/{id}/accept:
 *   post:
 *     summary: Optional Accept Offer prefill — does NOT claim the offer
 *     tags: ['Customer / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile:**
 *       1. List Claim Now → GET detail (navigate only)
 *       2. Accept Offer → THIS endpoint is **optional** (prefill). Or skip and open Post Job with offerId.
 *       3. POST /jobs with offerId → location → publish → pay
 *       4. **POST /payments/{id}/confirm** → offer claimed (USED) — Payment Successful
 *
 *       No separate claim API is required. `data.claim` is empty for trader offers.
 *       `claimTiming.claimOnAccept=false`, `softClaimOnPublish=false`, `claimUsedOnPaymentConfirm=true`.
 *
 *       **Request:** path `id` only. No body.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Prefill only — claim happens on Payment Successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Offer prepared. Continue to Post a New Job. Claim happens on Payment Successful only." }
 *                 data:
 *                   type: object
 *                   properties:
 *                     claim:
 *                       type: object
 *                       description: Always empty strings for trader offers (no claim yet)
 *                       properties:
 *                         id: { type: string, example: "" }
 *                         status: { type: string, example: "" }
 *                         claimedAt: { type: string, example: "" }
 *                         jobId: { type: string, example: "" }
 *                     offer: { type: object }
 *                     claimTiming:
 *                       type: object
 *                       properties:
 *                         claimOnAccept: { type: boolean, example: false }
 *                         softClaimOnPublish: { type: boolean, example: false }
 *                         claimUsedOnPaymentConfirm: { type: boolean, example: true }
 *                         claimRequiredApi: { type: boolean, example: false }
 *                         confirmPaymentPath: { type: string, example: "POST /payments/{paymentId}/confirm" }
 *                     navigation:
 *                       type: object
 *                       properties:
 *                         nextScreen: { type: string, example: POST_NEW_JOB }
 *                         afterJobForm: { type: string, example: CHOOSE_LOCATION }
 *                         afterLocation: { type: string, example: SITE_VISIT_PAY_FEE }
 *                         afterPayment: { type: string, example: SUCCESS }
 *                     nextJobPrefill:
 *                       type: object
 *                       properties:
 *                         offerApplied: { type: boolean, example: true }
 *                         claimId: { type: string, example: "" }
 *                         appliedTraderOfferId: { type: string, format: uuid }
 *                         offerId: { type: string, format: uuid }
 *                         traderId: { type: string }
 *                         categoryId: { type: string }
 *                         subcategoryId: { type: string }
 *                     jobFormConfig: { type: object }
 *       409:
 *         description: Offer already USED.
 */
router.post(
  '/trader-offers/:id/accept',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  validate(offerIdParamSchema),
  controller.acceptTraderOffer
);

/**
 * @swagger
 * /brisk-offers:
 *   get:
 *     summary: List platform-curated Brisk Offers
 *     tags: ['Customer / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Offers → Brisk Offers.
 *
 *       Active `offerType=PLATFORM` offers. Each row has `badgeTag` (e.g. `special_local_promo`,
 *       `limited_availability`) and `ctaLabel` / `ctaAction` (`CLAIM` vs `BOOK_INSPECTION`).
 *       When a trader is linked, `trader.profilePhotoUrl` / `trader.imageUrl` is included for the avatar.
 *       `data.pointsBalance` is the customer's BRP header (display only — not used to redeem here).
 *     parameters:
 *       - $ref: '#/components/parameters/OfferDateRange'
 *       - $ref: '#/components/parameters/OfferDateFrom'
 *       - $ref: '#/components/parameters/OfferDateTo'
 *       - $ref: '#/components/parameters/OfferTraderIds'
 *       - $ref: '#/components/parameters/OfferDiscountType'
 *       - $ref: '#/components/parameters/OfferCategoryId'
 *       - $ref: '#/components/parameters/OfferSubcategoryId'
 *       - $ref: '#/components/parameters/OfferSearch'
 *       - $ref: '#/components/parameters/OfferPage'
 *       - $ref: '#/components/parameters/OfferLimit'
 *     responses:
 *       200:
 *         description: Paginated Brisk offers plus `pointsBalance`.
 */
router.get(
  '/brisk-offers',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  validate(publicOfferFilterSchema),
  controller.listBriskOffers
);

/**
 * @swagger
 * /brisk-offers/{id}:
 *   get:
 *     summary: Get one Brisk / platform offer
 *     tags: ['Customer / Offers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Platform offer UUID.
 *     responses:
 *       200:
 *         description: Offer detail including `claimed`, `badgeTag`, and `ctaAction`.
 */
router.get(
  '/brisk-offers/:id',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  validate(offerIdParamSchema),
  controller.getTraderOffer
);

/**
 * @swagger
 * /brisk-offers/{id}/claim:
 *   post:
 *     summary: Claim a Brisk / platform offer
 *     tags: ['Customer / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Same claim record as trader offers. If `ctaAction=BOOK_INSPECTION`, still records a claim
 *       and returns prefill so the app can open the inspection/booking flow instead of a generic claim toast.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Platform offer UUID.
 *     responses:
 *       200:
 *         description: Claim created.
 */
router.post(
  '/brisk-offers/:id/claim',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  validate(offerIdParamSchema),
  controller.claimBriskOffer
);

/**
 * @swagger
 * /promo-codes:
 *   get:
 *     summary: List active BRISK promo codes
 *     tags: ['Customer / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       BRISK-issued codes (e.g. `PEST10BRISK`). Filterable by category.
 *       Codes are applied at **invoice/checkout**, not when posting a job.
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: |
 *           **Purpose:** Promo search/filter by category.
 *           Codes with empty `categoryScope` apply to all categories.
 *           **Alias:** `category_id`.
 *     responses:
 *       200:
 *         description: data.promoCodes array.
 */
router.get(
  '/promo-codes',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  validate(promoListSchema),
  controller.listPromoCodes
);

/**
 * @swagger
 * /promo-codes/validate:
 *   post:
 *     summary: Validate a promo code (checkout)
 *     tags: ['Customer / Offers']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Checks code, active flag, validity window, and optional category scope.
 *       Does **not** consume the code. Apply later with `POST /invoices/:id/apply-promo` (invoices module).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: PEST10BRISK }
 *               categoryId: { type: string, format: uuid, description: Job/invoice category to check scope }
 *     responses:
 *       200:
 *         description: Code is valid. Returns discount fields to preview on checkout.
 *       400:
 *         description: Invalid, expired, or category mismatch.
 */
router.post(
  '/promo-codes/validate',
  authMiddleware,
  roleMiddleware(['CUSTOMER']),
  validate(validatePromoSchema),
  controller.validatePromoCode
);

export default router;
