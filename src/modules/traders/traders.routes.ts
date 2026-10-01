import { Router } from 'express';
import * as tradersController from './traders.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { traderVerifiedMiddleware } from '../../middlewares/trader-verified.middleware';
import {
  expiringDocumentsQuerySchema,
  updateTraderAccountSchema,
  updateTraderBankDetailsSchema,
  updateTraderProfileSchema,
} from './traders.validation';
import {
  categoriesSchema,
  categoryActiveSchema,
  companyProfileSchema,
  documentRuleIdParamSchema,
  soloProfileSchema,
  uploadDocumentSchema,
} from './onboarding/onboarding.validation';
import onboardingRoutes from './onboarding/onboarding.routes';
import traderOffersRoutes from './offers/trader-offers.routes';
import traderJobsRoutes from './jobs/trader-jobs.routes';
import traderMyJobsRoutes from './jobs/trader-my-jobs.routes';
import traderPaymentsRoutes from './payments/trader-payments.routes';
import traderEarningsRoutes from './earnings/trader-earnings.routes';
import traderSiteVisitsRoutes from './site-visits/trader-site-visits.routes';

const router = Router();

router.use('/onboarding', onboardingRoutes);

router.use(authMiddleware, roleMiddleware(['TRADER']));

// Marketplace APIs require VERIFIED — PENDING/REJECTED/SUSPENDED traders get 403 TRADER_NOT_VERIFIED.
// Profile (/me*) stays available so portal can show "Pending Verification" and allow limited edits.
router.use('/offers', traderVerifiedMiddleware, traderOffersRoutes);
router.use('/jobs', traderVerifiedMiddleware, traderMyJobsRoutes);
router.use('/jobs', traderVerifiedMiddleware, traderJobsRoutes);
router.use('/payments', traderVerifiedMiddleware, traderPaymentsRoutes);
router.use('/earnings', traderVerifiedMiddleware, traderEarningsRoutes);
router.use('/site-visits', traderVerifiedMiddleware, traderSiteVisitsRoutes);

/**
 * @swagger
 * /traders/me:
 *   get:
 *     summary: Get authenticated Trader profile (Profile screen)
 *     tags: ['Trader / Profile']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Use on:** Trader app Profile tab.
 *
 *       `data` is a flat object (plus nested `user`, `bankDetails`, `certifications`, `offers`, `notifications`).
 *
 *       **Header card:** `fullName`, `profilePhotoUrl`, `preferredCurrency`, `email`, `country`, `mobileCountryCode` + `mobileNumber`
 *       **Completion card:** `profileCompletionPercent`, `profileCompletionHint`, `missingProfileItems`
 *       **Verification badge:** `verificationStatus` (`VERIFIED` / `PENDING` / `REJECTED`)
 *       **Email / phone verify flags:** `emailVerified`, `mobileVerified` (booleans)
 *       **Country:** `country` (and `user.country`) — set at signup, editable via `PATCH /traders/me/account`
 *       **Support WebViews:** `supportLinks[]` with `key`, `title`, `url` for Help Center, Terms, Privacy
 *       **Bank Details:** `bankDetails` — `status` (`VERIFIED` / `MISSING` / `SKIPPED`), `bankHolderName`,
 *       `bankName`, `accountNumber` (full), `accountNumberMasked` (e.g. `****1234` for display), `ifscCode`
 *       **Business info (Sole/Company):** `businessInfo` — fullLegalName, ppsNumber, companyName, croNumber, etc.
 *       Edit account: `PATCH /traders/me/account` (`fullName`, `mobileNumber`, `profilePhotoUrl`, `preferredCurrency`, `country`). Edit business: `PUT /traders/me/personal-info` or `/company-info`.
 *       **Certifications row:** `certifications.activeDocumentsCount` ("4 Active Documents")
 *       **Categories row:** `selectedCategories` / `categoriesCount`
 *       **Offers row:** `offers.activeCount` — list via `GET /traders/offers`
 *
 *       Menu rows (Personal Information, Payouts, Tax, Earnings) are navigation only.
 *       Help / Terms / Privacy → open `supportLinks[].url` in WebView.
 *     responses:
 *       200:
 *         description: Profile payload for the Profile screen.
 *       403:
 *         description: User is not a trader.
 */
router.get('/me', tradersController.getMyTraderProfile);

/**
 * @swagger
 * /traders/me:
 *   patch:
 *     summary: Update authenticated Trader profile (bio, business info, category)
 *     tags: ['Trader / Profile']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               traderType: { type: string, enum: [SOLO, COMPANY] }
 *               businessName: { type: string, example: Metro Plumbing Ltd }
 *               bio: { type: string, example: Experienced plumber serving Dublin area. }
 *               profilePhotoUrl: { type: string }
 *               coverImageUrl: { type: string }
 *               yearsExperience: { type: integer, example: 8 }
 *               serviceRadius: { type: string, example: 25km }
 *               categoryId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Trader profile updated successfully.
 */
router.patch('/me', validate(updateTraderProfileSchema), tradersController.updateMyTraderProfile);

/**
 * @swagger
 * /traders/me/account:
 *   patch:
 *     summary: Edit account (full name, phone, photo, country, currency) from Profile
 *     tags: ['Trader / Profile']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Use on:** Profile → Edit your account.
 *
 *       Editable: `fullName`, `mobileNumber` (E.164 e.g. `+353212121212`), `profilePhotoUrl`,
 *       `preferredCurrency` (EUR/GBP), **`country`** (same field as signup `POST /auth/register`).
 *       **Profile photo update:** After login → `POST /uploads` (`purpose: profile_photo`) → pass returned `url` as `profilePhotoUrl` here (JSON only, no file on this endpoint).
 *
 *       **Profile photo clear / omit rules:**
 *       - `profilePhotoUrl: "https://..."` → save/replace photo
 *       - `profilePhotoUrl: null` → clear photo (DB NULL); response returns `profilePhotoUrl: null`
 *       - `profilePhotoUrl: ""` → treated as clear (same as null)
 *       - field omitted → keep existing photo unchanged
 *
 *       **Email is locked** (`emailLocked: true` on GET /traders/me) — do not send `email`.
 *       Changing phone sets `mobileVerified: false` and `mobileReverificationRequired: true`.
 *
 *       `GET /traders/me` returns `country` (and `user.country`) for the edit form prefill.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string, example: Brisk Trader }
 *               mobileNumber: { type: string, example: "+353212121212" }
 *               profilePhotoUrl:
 *                 oneOf:
 *                   - { type: string, format: uri }
 *                   - { type: string, enum: [""], description: Clears photo (same as null) }
 *                   - { type: "null", description: Clears photo }
 *                 nullable: true
 *                 description: |
 *                   URL to set photo; `null` or `""` to clear; omit to keep existing.
 *               preferredCurrency: { type: string, example: "EUR", description: "ISO 4217 — active currencies only (e.g. EUR, GBP)." }
 *               country: { type: string, example: Ireland, description: "Country from signup country picker — editable here too." }
 *           examples:
 *             updateCountry:
 *               value: { country: Ireland }
 *             updateAccount:
 *               value:
 *                 fullName: John Trader
 *                 mobileNumber: "+353871234567"
 *                 country: Ireland
 *                 preferredCurrency: EUR
 *             setPhoto:
 *               summary: Set / replace profile photo
 *               value:
 *                 fullName: Sarah Mur
 *                 profilePhotoUrl: https://api.brisk.ie/uploads/files/profile_photo/example.png
 *             clearPhoto:
 *               summary: Remove profile photo
 *               value:
 *                 fullName: Sarah Mur
 *                 profilePhotoUrl: null
 *     responses:
 *       200:
 *         description: Account updated. Full profile in `data` (includes `country`). After clear, `profilePhotoUrl` is null.
 *       400:
 *         description: Validation error (e.g. email change attempted).
 *       409:
 *         description: Mobile number already registered.
 */
router.patch(
  '/me/account',
  validate(updateTraderAccountSchema),
  tradersController.updateMyAccount
);
router.put(
  '/me/account',
  validate(updateTraderAccountSchema),
  tradersController.updateMyAccount
);

/**
 * @swagger
 * /traders/me/personal-info:
 *   put:
 *     summary: Edit Sole Trader business/personal info from Profile
 *     tags: ['Trader / Profile']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Use on:** Profile → Personal / Sole Trader information (after onboarding).
 *
 *       Same body as `PUT /traders/onboarding/personal-info`.
 *       Do **not** use the onboarding path after submit — that returns 403.
 *       Only for `traderType: SOLO`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullLegalName, addressLine1, city, postcode, country, county]
 *             description: Send `ppsNumber` (Ireland, e.g. 1234567FA) or `niNumber` (UK, e.g. QQ123456C). Format is checked against `country`.
 *             properties:
 *               fullLegalName: { type: string }
 *               ppsNumber: { type: string, example: '1234567FA' }
 *               niNumber: { type: string, example: 'QQ123456C' }
 *               bio: { type: string }
 *               yearsExperience: { type: integer }
 *               addressLine1: { type: string }
 *               addressLine2: { type: string }
 *               city: { type: string }
 *               postcode: { type: string }
 *               country: { type: string, example: Ireland, description: 'Name or ISO code from GET /locations/countries (stored as name)' }
 *               county: { type: string, example: Dublin, description: 'Name or code from GET /locations/counties for the country (stored as name). 400 INVALID_COUNTY if not enabled for that country.' }
 *     responses:
 *       200:
 *         description: Updated. Full profile in `data` (includes `businessInfo`).
 */
router.put(
  '/me/personal-info',
  validate(soloProfileSchema),
  tradersController.updateMyPersonalInfo
);

/**
 * @swagger
 * /traders/me/company-info:
 *   put:
 *     summary: Edit Company trader info from Profile
 *     tags: ['Trader / Profile']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Use on:** Profile → Company information (after onboarding).
 *
 *       Same body as `PUT /traders/onboarding/company-info`.
 *       Do **not** use the onboarding path after submit — that returns 403.
 *       Only for `traderType: COMPANY`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyName, croNumber, directorFullName, addressLine1, city, postcode, country, county]
 *             properties:
 *               companyName: { type: string }
 *               croNumber: { type: string, example: "12345678" }
 *               vatNumber: { type: string }
 *               directorFullName: { type: string }
 *               bio: { type: string }
 *               yearsExperience: { type: integer }
 *               addressLine1: { type: string }
 *               addressLine2: { type: string }
 *               city: { type: string }
 *               postcode: { type: string }
 *               country: { type: string, example: Ireland, description: 'Name or ISO code from GET /locations/countries (stored as name)' }
 *               county: { type: string, example: Dublin, description: 'Name or code from GET /locations/counties for the country (stored as name). 400 INVALID_COUNTY if not enabled for that country.' }
 *     responses:
 *       200:
 *         description: Updated. Full profile in `data` (includes `businessInfo`).
 */
router.put(
  '/me/company-info',
  validate(companyProfileSchema),
  tradersController.updateMyCompanyInfo
);

/**
 * @swagger
 * /traders/me/bank-details:
 *   put:
 *     summary: Update bank details from Profile (after onboarding)
 *     tags: ['Trader / Profile']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Use on:** Profile → Bank Details (edit/save).
 *
 *       Do **not** use `PUT /traders/onboarding/bank-details` after submit — that returns 403
 *       (`Onboarding has already been submitted and cannot be edited.`).
 *
 *       This endpoint works for submitted / pending / approved traders.
 *       Response is the full profile (`data.bankDetails` refreshed).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bankHolderName, bankName, accountNumber, ifscCode]
 *             properties:
 *               bankHolderName: { type: string, example: Brisk Trader Holder }
 *               bankName: { type: string, example: BRISK BANK }
 *               accountNumber: { type: string, example: AC123456789011 }
 *               ifscCode: { type: string, example: IFSC1234 }
 *     responses:
 *       200:
 *         description: Bank details updated. Full profile in `data`.
 */
router.put(
  '/me/bank-details',
  validate(updateTraderBankDetailsSchema),
  tradersController.updateMyBankDetails
);

/**
 * @swagger
 * /traders/me/documents:
 *   put:
 *     summary: Upload/replace a document from Profile (after onboarding)
 *     tags: ['Trader / Profile']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Use on:** Profile → Certifications / Documents (after submit/approval).
 *
 *       Do **not** use `PUT /traders/onboarding/documents` after submit — that returns 403.
 *       List docs with `GET /traders/onboarding` (`documentRequirements.*.uploadStatus`).
 *
 *       Category documents can be uploaded for **active and inactive** trades on the profile
 *       (e.g. before reactivating). For inactive trades, refresh with
 *       `GET /traders/onboarding/document-requirements` (`categoryRules[].isActive`).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [documentRuleId, fileUrl]
 *             properties:
 *               documentRuleId: { type: string, format: uuid }
 *               fileUrl: { type: string, format: uri }
 *               fileName: { type: string }
 *               expiryDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 example: '2030-05-31'
 *                 description: Optional expiry date (`YYYY-MM-DD`). Send again when replacing the file.
 *     responses:
 *       200:
 *         description: Document saved. Same onboarding snapshot shape in `data`.
 */
router.put('/me/documents', validate(uploadDocumentSchema), tradersController.updateMyDocuments);

/**
 * @swagger
 * /traders/me/documents/expiring:
 *   get:
 *     summary: Trader Dashboard — documents expired or expiring soon
 *     tags: ['Trader / Profile']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Uploaded documents (not REJECTED) whose `expiryDate` has passed or falls within `withinDays`
 *       (default 30 — same window as the expiry reminders). Soonest first. Dates use Ireland time.
 *       Empty `items` = nothing to show. Re-upload via `PUT /traders/me/documents` (`documentRuleId`).
 *     parameters:
 *       - in: query
 *         name: withinDays
 *         schema: { type: integer, minimum: 0, maximum: 365, default: 30 }
 *     responses:
 *       200:
 *         description: Expiring documents.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Expiring documents retrieved.
 *               data:
 *                 items:
 *                   - id: '8f0c2a1e-1111-4a5b-9c3d-2e4f5a6b7c8d'
 *                     documentRuleId: 'a1b2c3d4-2222-4e5f-8a9b-0c1d2e3f4a5b'
 *                     documentKey: 'public_liability_insurance'
 *                     documentName: 'Public Liability Insurance'
 *                     scope: 'CATEGORY'
 *                     categoryId: 'c1d2e3f4-3333-4a5b-8c9d-0e1f2a3b4c5d'
 *                     required: true
 *                     fileUrl: 'https://api.brisk.ie/uploads/files/trader_document/insurance.pdf'
 *                     fileName: 'insurance.pdf'
 *                     status: 'APPROVED'
 *                     expiryDate: '2026-10-05'
 *                     daysLeft: 7
 *                     expiryStatus: 'EXPIRING_SOON'
 *                     uploadedAt: '2026-01-10T09:30:00.000Z'
 *                 total: 1
 *                 expiredCount: 0
 *                 expiringSoonCount: 1
 *                 withinDays: 30
 *       404:
 *         description: Trader profile not found.
 */
router.get(
  '/me/documents/expiring',
  validate(expiringDocumentsQuerySchema),
  tradersController.getMyExpiringDocuments
);

/**
 * @swagger
 * /traders/me/documents/{documentRuleId}:
 *   delete:
 *     summary: Remove a document from Profile (after onboarding)
 *     tags: ['Trader / Profile']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentRuleId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Document removed.
 */
router.delete(
  '/me/documents/:documentRuleId',
  validate(documentRuleIdParamSchema),
  tradersController.removeMyDocument
);

/**
 * @swagger
 * /traders/me/categories:
 *   put:
 *     summary: Update trade categories from Profile (after onboarding)
 *     tags: ['Trader / Profile']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Use on:** Profile → Categories.
 *
 *       Do **not** use `PUT /traders/onboarding/categories` after submit — that returns 403.
 *
 *       Trades are **never deleted** from Profile — they are activated / deactivated.
 *       To toggle one trade use `PATCH /traders/me/categories/{categoryId}`.
 *
 *       **Merge by default:** `categoryIds` are added (or re-activated).
 *       `replace: true` → listed trades active, every other trade on the profile becomes **inactive**
 *       (documents are kept). At least one trade must stay active.
 *       Inactive trades get no Discover jobs, incoming jobs, or realtime job alerts.
 *       `selectedCategories` = active trades only (same as before); `allCategories[]` = every trade with `isActive`.
 *       Re-activating an inactive trade via `categoryIds` follows the same document rule as the PATCH (`CATEGORY_DOCUMENTS_REQUIRED`).
 *       With `replace: true`, trades being switched off must have no active jobs (`CATEGORY_HAS_ACTIVE_JOBS`).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryIds]
 *             properties:
 *               categoryIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               replace:
 *                 type: boolean
 *                 description: |
 *                   Profile only. Default false = merge/add. true = replace full list.
 *     responses:
 *       200:
 *         description: Categories updated. Onboarding snapshot in `data` (includes documentRequirements).
 */
router.put('/me/categories', validate(categoriesSchema), tradersController.updateMyCategories);

/**
 * @swagger
 * /traders/me/categories/{categoryId}:
 *   patch:
 *     summary: Activate / deactivate one trade category (Profile → Categories)
 *     tags: ['Trader / Profile']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Inactive trade = no Discover jobs, incoming jobs or realtime alerts for it; documents are kept.
 *       The last active trade cannot be deactivated (`LAST_ACTIVE_CATEGORY`).
 *       **Deactivate** is blocked while the trader has running jobs in that trade (My Jobs → Active):
 *       400 `CATEGORY_HAS_ACTIVE_JOBS` with `data.activeJobsCount` and `data.activeJobs[] = { id, jobRef, title, status, categoryId }`.
 *       **Reactivate** (`isActive: true`) requires every required document of that trade to be uploaded
 *       and not rejected — otherwise 400 `CATEGORY_DOCUMENTS_REQUIRED` with
 *       `data.missingDocuments[] = { documentRuleId, name, categoryId, categoryName, reason: NOT_UPLOADED | REJECTED }`.
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean, example: false }
 *     responses:
 *       200:
 *         description: Onboarding snapshot in `data`; `selectedCategories` = active trades, `allCategories[].isActive` = on/off state.
 *       400: { description: 'LAST_ACTIVE_CATEGORY, CATEGORY_HAS_ACTIVE_JOBS, CATEGORY_INACTIVE or CATEGORY_DOCUMENTS_REQUIRED' }
 *       404: { description: Category is not on this trader profile. }
 */
router.patch(
  '/me/categories/:categoryId',
  validate(categoryActiveSchema),
  tradersController.setMyCategoryActive
);

export default router;
