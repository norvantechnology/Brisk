import { Router } from 'express';
import * as tradersController from './traders.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { updateTraderBankDetailsSchema, updateTraderProfileSchema } from './traders.validation';
import {
  categoriesSchema,
  documentRuleIdParamSchema,
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
