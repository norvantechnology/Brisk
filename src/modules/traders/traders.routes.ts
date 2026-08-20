import { Router } from 'express';
import * as tradersController from './traders.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { updateTraderProfileSchema } from './traders.validation';
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
 *       **Bank Details:** `bankDetails` — `status` (`VERIFIED` / `MISSING` / `SKIPPED`), `bankHolderName`,
 *       `bankName`, `accountNumber` (full), `accountNumberMasked` (e.g. `****1234` for display), `ifscCode`
 *       **Certifications row:** `certifications.activeDocumentsCount` ("4 Active Documents")
 *       **Categories row:** `selectedCategories` / `categoriesCount`
 *       **Offers row:** `offers.activeCount` — list via `GET /traders/offers`
 *
 *       Menu rows (Personal Information, Payouts, Tax, Earnings, Help, TOS, Privacy) are navigation only.
 *       Notification toggles live in `notifications` and can be updated with `PATCH /users/me`.
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

export default router;
