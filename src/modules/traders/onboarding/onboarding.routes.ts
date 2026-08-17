import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { roleMiddleware } from '../../../middlewares/role.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as onboardingController from './onboarding.controller';
import {
  bankDetailsSchema,
  businessTypeSchema,
  categoriesSchema,
  companyProfileSchema,
  documentRuleIdParamSchema,
  serviceRadiusSchema,
  soloProfileSchema,
  uploadDocumentSchema,
} from './onboarding.validation';

const router = Router();

router.use(authMiddleware, roleMiddleware(['TRADER']));

/**
 * @swagger
 * /traders/onboarding:
 *   get:
 *     summary: Get trader onboarding status, current step, documents, and requirements
 *     tags: ['Trader / Onboarding']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding status retrieved.
 */
router.get('/', onboardingController.getStatus);

/**
 * @swagger
 * /traders/onboarding/start:
 *   post:
 *     summary: Start trader onboarding (after auth + email verification)
 *     tags: ['Trader / Onboarding']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding started.
 */
router.post('/start', onboardingController.start);

/**
 * @swagger
 * /traders/onboarding/business-type:
 *   put:
 *     summary: Step 1 — Select Sole Trader (SOLO) or Company Trader (COMPANY)
 *     tags: ['Trader / Onboarding']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entityType]
 *             properties:
 *               entityType: { type: string, enum: [SOLO, COMPANY] }
 *     responses:
 *       200:
 *         description: Business type saved.
 */
router.put('/business-type', validate(businessTypeSchema), onboardingController.saveBusinessType);

/**
 * @swagger
 * /traders/onboarding/document-requirements:
 *   get:
 *     summary: Get entity-level and category-level document requirements for current trader
 *     tags: ['Trader / Onboarding']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Document requirements retrieved.
 */
router.get('/document-requirements', onboardingController.getRequirements);

/**
 * @swagger
 * /traders/onboarding/documents:
 *   put:
 *     summary: Upload or replace a document (PDF/image URL) for a document rule
 *     tags: ['Trader / Onboarding']
 *     security:
 *       - bearerAuth: []
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
 *               fileName: { type: string, example: passport.pdf }
 *     responses:
 *       200:
 *         description: Document uploaded.
 */
router.put('/documents', validate(uploadDocumentSchema), onboardingController.uploadDocument);

/**
 * @swagger
 * /traders/onboarding/documents/{documentRuleId}:
 *   delete:
 *     summary: Remove an uploaded document
 *     tags: ['Trader / Onboarding']
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
  '/documents/:documentRuleId',
  validate(documentRuleIdParamSchema),
  onboardingController.removeDocument
);

/**
 * @swagger
 * /traders/onboarding/categories:
 *   put:
 *     summary: Step 3 — Select trade categories (multi-select)
 *     tags: ['Trader / Onboarding']
 *     security:
 *       - bearerAuth: []
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
 *         description: Categories saved.
 */
router.put('/categories', validate(categoriesSchema), onboardingController.saveCategories);

/**
 * @swagger
 * /traders/onboarding/personal-info:
 *   put:
 *     summary: Step 5 (Sole Trader) — Personal info, PPS, bio, experience, business address
 *     tags: ['Trader / Onboarding']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personal info saved.
 */
router.put('/personal-info', validate(soloProfileSchema), onboardingController.saveSoloProfile);

/**
 * @swagger
 * /traders/onboarding/company-info:
 *   put:
 *     summary: Step 5 (Company Trader) — Company name, CRO, VAT, director, address
 *     tags: ['Trader / Onboarding']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Company info saved.
 */
router.put('/company-info', validate(companyProfileSchema), onboardingController.saveCompanyProfile);

/**
 * @swagger
 * /traders/onboarding/bank-details:
 *   put:
 *     summary: Step 6 — Bank details (optional — send skip=true to skip)
 *     tags: ['Trader / Onboarding']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bank details saved or skipped.
 */
router.put('/bank-details', validate(bankDetailsSchema), onboardingController.saveBankDetails);

/**
 * @swagger
 * /traders/onboarding/service-radius:
 *   put:
 *     summary: Step 7 — Service radius and map center point
 *     tags: ['Trader / Onboarding']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service radius saved.
 */
router.put('/service-radius', validate(serviceRadiusSchema), onboardingController.saveServiceRadius);

/**
 * @swagger
 * /traders/onboarding/save-progress:
 *   post:
 *     summary: Save progress draft (returns current onboarding state)
 *     tags: ['Trader / Onboarding']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Progress saved.
 */
router.post('/save-progress', onboardingController.saveProgress);

/**
 * @swagger
 * /traders/onboarding/submit:
 *   post:
 *     summary: Submit onboarding for admin verification
 *     tags: ['Trader / Onboarding']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding submitted.
 */
router.post('/submit', onboardingController.submit);

export default router;
