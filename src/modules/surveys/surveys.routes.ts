import { Router } from 'express';
import * as surveysController from './surveys.controller';
import { validate } from '../../middlewares/validate.middleware';
import {
  createSurveyConsumerPublicSchema,
  createSurveyTraderPublicSchema,
} from '../admin/admin-cms/admin-cms.validation';

const router = Router();

/**
 * @swagger
 * /surveys/consumer:
 *   post:
 *     summary: Submit consumer survey form (website)
 *     tags: ['Website / Surveys']
 *     description: |
 *       **Who uses this:** BRISK website — consumer-survey page ("Join the BRISK Consumer Platform").
 *
 *       **When to call:** User fills the form and clicks **Submit Survey**.
 *
 *       **Login needed?** No — anyone can submit.
 *
 *       **What it does:** Saves the person's details in the database for the app launch list.
 *       Returns a reference code like **CS-0001**.
 *
 *       **Admin can see this later** in Admin Panel → Survey Management → Consumer tab.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - phone
 *               - county
 *               - agreementAccepted
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: Person's full name (required)
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address (required)
 *                 example: john@example.com
 *               phone:
 *                 type: string
 *                 description: Contact / mobile number (required)
 *                 example: "+353871234567"
 *               county:
 *                 type: string
 *                 description: County / location (required) — e.g. Dublin. Prefer this over country.
 *                 example: Dublin
 *               country:
 *                 type: string
 *                 description: Optional legacy alias — if county is missing, country is accepted and stored as county
 *                 example: Ireland
 *               ageRange:
 *                 type: string
 *                 description: Optional — e.g. 18-29 or 18–29 (dashes normalized)
 *                 example: "18-29"
 *               consentLaunchUpdates:
 *                 type: boolean
 *                 description: Yes = wants app launch notifications
 *                 example: true
 *               consentMarketing:
 *                 type: boolean
 *                 description: Yes = wants marketing emails
 *                 example: true
 *               consentPartnerComm:
 *                 type: boolean
 *                 description: Yes = wants messages from trusted partners
 *                 example: false
 *               agreementAccepted:
 *                 type: boolean
 *                 description: Must be true — user agreed to Privacy Policy & Terms
 *                 example: true
 *     responses:
 *       201:
 *         description: Saved successfully. Response includes registration code (CS-####) and saved details.
 *       400:
 *         description: Form validation failed — check required fields and agreementAccepted is true.
 */
router.post(
  '/consumer',
  validate(createSurveyConsumerPublicSchema),
  surveysController.createConsumer
);

/**
 * @swagger
 * /surveys/trader:
 *   post:
 *     summary: Submit trader survey form (website)
 *     tags: ['Website / Surveys']
 *     description: |
 *       **Who uses this:** BRISK website — trader-survey page ("Join the BRISK Trader Platform").
 *
 *       **When to call:** Tradesperson fills the form and clicks **Register Interest**.
 *
 *       **Login needed?** No — anyone can submit.
 *
 *       **What it does:** Saves tradesperson / company details in the database for the trader launch list.
 *       Returns a reference code like **TS-0001**.
 *
 *       **Admin can see this later** in Admin Panel → Survey Management → Trader tab.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - companyName
 *               - email
 *               - phone
 *               - country
 *               - agreementAccepted
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: Contact person's full name (required)
 *                 example: John Doe
 *               companyName:
 *                 type: string
 *                 description: Business / company name (required)
 *                 example: Acme Construction
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Business email (required)
 *                 example: john@example.com
 *               phone:
 *                 type: string
 *                 description: Contact number (required)
 *                 example: "+353871234567"
 *               country:
 *                 type: string
 *                 description: Selected country from dropdown (required)
 *                 example: Ireland
 *               companyWebsite:
 *                 type: string
 *                 description: Optional company website URL
 *                 example: https://example.com
 *               consentLaunchUpdates:
 *                 type: boolean
 *                 description: Yes = wants product / launch updates
 *                 example: true
 *               consentMarketing:
 *                 type: boolean
 *                 description: Yes = wants marketing emails
 *                 example: true
 *               consentPartnerComm:
 *                 type: boolean
 *                 description: Yes = wants messages from trusted partners
 *                 example: false
 *               agreementAccepted:
 *                 type: boolean
 *                 description: Must be true — user agreed to Privacy Policy & Terms
 *                 example: true
 *     responses:
 *       201:
 *         description: Saved successfully. Response includes registration code (TS-####) and saved details.
 *       400:
 *         description: Form validation failed — check required fields and agreementAccepted is true.
 */
router.post(
  '/trader',
  validate(createSurveyTraderPublicSchema),
  surveysController.createTrader
);

export default router;
