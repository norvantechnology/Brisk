import { Router } from 'express';
import * as tradersController from './traders.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { updateTraderAccountSchema, updateTraderBankDetailsSchema, updateTraderProfileSchema } from './traders.validation';
import {
  categoriesSchema,
  companyProfileSchema,
  documentRuleIdParamSchema,
  soloProfileSchema,
  uploadDocumentSchema,
} from './onboarding/onboarding.validation';
import onboardingRoutes from './onboarding/onboarding.routes';
import traderOffersRoutes from './offers/trader-offers.routes';

const router = Router();

router.use('/onboarding', onboardingRoutes);

router.use(authMiddleware, roleMiddleware(['TRADER']));
router.use('/offers', traderOffersRoutes);

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
 *       **Header card:** `fullName`, `profilePhotoUrl`, `email`, `mobileCountryCode` + `mobileNumber`
 *       **Completion card:** `profileCompletionPercent`, `profileCompletionHint`, `missingProfileItems`
 *       **Verification badge:** `verificationStatus` (`VERIFIED` / `PENDING` / `REJECTED`)
 *       **Email / phone verify flags:** `emailVerified`, `mobileVerified` (booleans)
 *       **Support WebViews:** `supportLinks[]` with `key`, `title`, `url` for Help Center, Terms, Privacy
 *       **Bank Details:** `bankDetails` — `status` (`VERIFIED` / `MISSING` / `SKIPPED`), `bankHolderName`,
 *       `bankName`, `accountNumber` (full), `accountNumberMasked` (e.g. `****1234` for display), `ifscCode`
 *       **Business info (Sole/Company):** `businessInfo` — fullLegalName, ppsNumber, companyName, croNumber, etc.
 *       Edit account: `PATCH /traders/me/account`. Edit business: `PUT /traders/me/personal-info` or `/company-info`.
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
 *     summary: Edit account (full name, phone, photo) from Profile
 *     tags: ['Trader / Profile']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Use on:** Profile → Edit your account.
 *
 *       Editable: `fullName`, `mobileNumber` (E.164 e.g. `+353212121212`), `profilePhotoUrl`.
 *       **Email is locked** (`emailLocked: true` on GET /traders/me) — do not send `email`.
 *       Changing phone sets `mobileVerified: false` and `mobileReverificationRequired: true`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string, example: Brisk Trader }
 *               mobileNumber: { type: string, example: "+353212121212" }
 *               profilePhotoUrl: { type: string, format: uri }
 *     responses:
 *       200:
 *         description: Account updated. Full profile in `data`.
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
 *             required: [fullLegalName, ppsNumber, addressLine1, city, postcode]
 *             properties:
 *               fullLegalName: { type: string }
 *               ppsNumber: { type: string }
 *               bio: { type: string }
 *               yearsExperience: { type: integer }
 *               addressLine1: { type: string }
 *               addressLine2: { type: string }
 *               city: { type: string }
 *               postcode: { type: string }
 *               country: { type: string, example: Ireland }
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
 *             required: [companyName, croNumber, directorFullName, addressLine1, city, postcode]
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
 *               country: { type: string }
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
 *     responses:
 *       200:
 *         description: Document saved. Same onboarding snapshot shape in `data`.
 */
router.put('/me/documents', validate(uploadDocumentSchema), tradersController.updateMyDocuments);

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
 *       Removing a category also drops its category-scoped uploaded docs.
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
 *     responses:
 *       200:
 *         description: Categories updated. Onboarding snapshot in `data` (includes documentRequirements).
 */
router.put('/me/categories', validate(categoriesSchema), tradersController.updateMyCategories);

export default router;
