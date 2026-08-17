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

/** Trader onboarding routes — full Swagger docs in onboarding.swagger.ts */
const router = Router();

router.use(authMiddleware, roleMiddleware(['TRADER']));

router.get('/', onboardingController.getStatus);
router.post('/start', onboardingController.start);
router.put('/business-type', validate(businessTypeSchema), onboardingController.saveBusinessType);
router.get('/document-requirements', onboardingController.getRequirements);
router.put('/documents', validate(uploadDocumentSchema), onboardingController.uploadDocument);
router.delete(
  '/documents/:documentRuleId',
  validate(documentRuleIdParamSchema),
  onboardingController.removeDocument
);
router.put('/categories', validate(categoriesSchema), onboardingController.saveCategories);
router.put('/personal-info', validate(soloProfileSchema), onboardingController.saveSoloProfile);
router.put('/company-info', validate(companyProfileSchema), onboardingController.saveCompanyProfile);
router.put('/bank-details', validate(bankDetailsSchema), onboardingController.saveBankDetails);
router.put('/service-radius', validate(serviceRadiusSchema), onboardingController.saveServiceRadius);
router.post('/save-progress', onboardingController.saveProgress);
router.post('/submit', onboardingController.submit);

export default router;
