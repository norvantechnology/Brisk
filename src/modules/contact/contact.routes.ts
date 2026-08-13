import { Router } from 'express';
import * as contactController from './contact.controller';
import { validate } from '../../middlewares/validate.middleware';
import { createContactSubmissionSchema } from './contact.validation';

const router = Router();

/**
 * @swagger
 * /contact:
 *   post:
 *     summary: Submit Contact Us form (website)
 *     tags: ['Website / Contact']
 *     description: |
 *       **Use on:** Website Contact Us page.
 *
 *       **Auth:** Not required.
 *
 *       **Flow:**
 *       1. User submits form
 *       2. Saved to database with reference code `CNT-####`
 *       3. Confirmation email sent to user + notification to admin (mock log until SMTP/SES is wired)
 *
 *       **Response:** flat `data` object (not nested).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, phone, subject, message, agreementAccepted]
 *             properties:
 *               fullName: { type: string, example: Jane Doe }
 *               email: { type: string, format: email, example: jane@example.com }
 *               phone: { type: string, example: "+353871234567" }
 *               subject: { type: string, example: General enquiry }
 *               message: { type: string, example: I would like to know more about BRISK services. }
 *               agreementAccepted:
 *                 type: boolean
 *                 enum: [true]
 *                 description: Must be true — user accepted Privacy Policy & Terms
 *     responses:
 *       201:
 *         description: Submission saved. Returns referenceCode and submitted fields in flat `data`.
 *       400:
 *         description: Validation failed.
 */
router.post('/', validate(createContactSubmissionSchema), contactController.submitContact);

export default router;
