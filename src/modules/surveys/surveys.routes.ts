import { Router } from 'express';
import * as surveysController from './surveys.controller';
import { validate } from '../../middlewares/validate.middleware';
import { createSurveyConsumerPublicSchema } from '../admin/admin-cms/admin-cms.validation';

const router = Router();

/**
 * @swagger
 * /surveys/consumer:
 *   post:
 *     summary: Public consumer launch-party survey signup
 *     tags: ['📋 [Public Survey] Consumer Signup']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - agreementAccepted
 *             properties:
 *               fullName: { type: string, example: 'Aoife Murphy' }
 *               email: { type: string, format: email, example: 'aoife@example.com' }
 *               phone: { type: string, example: '+353871234567' }
 *               county: { type: string, example: 'Dublin' }
 *               ageRange: { type: string, example: '25-34' }
 *               consentLaunchUpdates: { type: boolean, example: true }
 *               consentMarketing: { type: boolean, example: false }
 *               consentPartnerComm: { type: boolean, example: false }
 *               agreementAccepted: { type: boolean, example: true }
 *     responses:
 *       201:
 *         description: Registration created (notes omitted).
 *       400:
 *         description: Validation error.
 */
router.post(
  '/consumer',
  validate(createSurveyConsumerPublicSchema),
  surveysController.createConsumer
);

export default router;
