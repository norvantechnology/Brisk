import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './jobs.controller';
import {
  createJobSchema,
  jobIdParamSchema,
  listJobsSchema,
  publishJobSchema,
  setJobLocationSchema,
  updateJobSchema,
} from './jobs.validation';

const router = Router();
const customerOnly = [authMiddleware, roleMiddleware(['CUSTOMER'] as const)];

/**
 * @swagger
 * /jobs:
 *   post:
 *     summary: Create a job draft (Direct Trader offer prefill supported)
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Post a New Job (after Accept Offer).
 *
 *       **Auth:** Customer Bearer token.
 *
 *       **Confirmed UI flow:**
 *       1. Offers list Claim Now → Offer Detail (GET) — no claim API
 *       2. Accept Offer → POST /trader-offers/{id}/accept → use nextJobPrefill + jobFormConfig
 *       3. This endpoint — create draft (quote type / min-max budget per jobFormConfig; images via uploads)
 *       4. Choose Location → PUT /jobs/{id}/location
 *       5. Publish → Payment Details → checkout Success/Fail
 *
 *       **Images:** POST /uploads with purpose=job_photo, then pass urls in photoUrls.
 *
 *       **Show/hide:** Prefer jobFormConfig from Accept Offer (also returned on Job as data.formConfig).
 *       Direct Trader: quote type locked FIXED, min/max budget hidden, serviceCharge shown.
 *
 *       **Aliases:** appliedTraderOfferId and offerId are both accepted.
 *
 *       **Response:** Job includes offerApplied, quoteType, formConfig, nextSteps.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateJobRequest'
 *           example:
 *             categoryId: e076d231-b0da-46cb-b60d-8aa9fbb8ce26
 *             subcategoryId: a1111111-1111-1111-1111-111111111111
 *             title: Pest Control Job
 *             description: Need pest control in kitchen and attic.
 *             scheduledDate: "2026-09-20T10:00:00.000Z"
 *             timeSlot: Morning
 *             durationLabel: "1 Hour"
 *             phoneNumber: "+353871234567"
 *             photoUrls:
 *               - "https://brisk-aclm.onrender.com/uploads/files/job_photo/uuid/photo.png"
 *             appliedTraderOfferId: b7692de1-4d8c-40db-98e6-079ce14e8d68
 *             claimId: cbc8fa2a-4044-4aa7-9702-d5843d9920c3
 *             traderId: 2a0d6b4d-889c-4e48-8270-11a20d00d169
 *             quoteType: FIXED
 *             serviceCharge: 125
 *             siteVisitRequested: false
 *     responses:
 *       201:
 *         description: Job draft created. Body envelope is success/message/data (Job).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/Job' }
 *       400:
 *         description: Validation error (missing description/category, bad claim/offer link).
 *       401:
 *         description: Missing or invalid Bearer token.
 *       403:
 *         description: Not a CUSTOMER role.
 *       404:
 *         description: Offer, claim, category, subcategory, or trader not found.
 *   get:
 *     summary: List my jobs
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Auth:** Customer Bearer token.
 *
 *       **Response:** `data.jobs` array (newest first). Optional `status` filter.
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           $ref: '#/components/schemas/JobStatus'
 *         description: |
 *           Optional filter. Examples - DRAFT (wizard in progress), SCHEDULED (after Direct Trader publish + pay path).
 *     responses:
 *       200:
 *         description: Wrapped job list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/JobListResponse' }
 */
router.post('/', ...customerOnly, validate(createJobSchema), controller.createJob);
router.get('/', ...customerOnly, validate(listJobsSchema), controller.listJobs);

/**
 * @swagger
 * /jobs/{id}:
 *   get:
 *     summary: Get job detail
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns full job with photos, offer banner, address, trader, claim, booking/invoice ids, and `nextSteps`.
 *       Only the owning customer can access the job.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Job UUID from create/list.
 *     responses:
 *       200:
 *         description: Job detail.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/Job' }
 *       404:
 *         description: Job not found for this customer.
 *   patch:
 *     summary: Update a draft job
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Only DRAFT jobs** can be updated. Use before publish.
 *
 *       Sending `photoUrls` replaces the full photo set (empty array clears photos).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateJobRequest'
 *     responses:
 *       200:
 *         description: Updated job.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/Job' }
 *       400:
 *         description: Job is not DRAFT, or subcategory does not belong to category.
 *       404:
 *         description: Job / category / trader not found.
 */
router.get('/:id', ...customerOnly, validate(jobIdParamSchema), controller.getJob);
router.patch('/:id', ...customerOnly, validate(updateJobSchema), controller.updateJob);

/**
 * @swagger
 * /jobs/{id}/location:
 *   put:
 *     summary: Choose Location — select saved address on job
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Choose Location (after Post a New Job).
 *
 *       Create address first with POST /addresses, then call this to select it.
 *       Copies address fields onto the job.
 *
 *       After success (Direct Trader / offer applied): nextSteps.nextAfterLocation = PAYMENT_DETAILS.
 *       Next app step: POST /jobs/{id}/publish then open Payment Details.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SetJobLocationRequest'
 *           example:
 *             addressId: e60ca842-e86a-4825-abcf-2e79a9ff8e4d
 *     responses:
 *       200:
 *         description: Location copied onto the job.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/Job' }
 *       400:
 *         description: Job is not DRAFT.
 *       404:
 *         description: Job or address not found (address must belong to the customer).
 */
router.put(
  '/:id/location',
  ...customerOnly,
  validate(setJobLocationSchema),
  controller.setJobLocation
);

/**
 * @swagger
 * /jobs/{id}/publish:
 *   post:
 *     summary: Publish job → Payment Details (Direct Trader)
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile:** After Choose Location — continue to Payment Details.
 *
 *       **Requirements:** DRAFT job, address set, serviceCharge for Direct Trader.
 *
 *       **Direct Trader side effects:** Quote (ACCEPTED) + Booking + Unpaid Invoice;
 *       claim marked USED; job → SCHEDULED.
 *
 *       **Response data.invoice** is the Payment Details payload (lineItems, payNowLabel, orderId).
 *       Then: POST /payments/intent → confirm (Success) or fail (Fail screen).
 *
 *       **Math example:** serviceCharge 125, 5% offer → discount 6.25, platform fee 11.88, total 130.63.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PublishJobRequest'
 *           example:
 *             addressId: e60ca842-e86a-4825-abcf-2e79a9ff8e4d
 *             serviceCharge: 125
 *     responses:
 *       200:
 *         description: Published. Direct Trader returns booking + full invoice.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/PublishJobResponse' }
 *       400:
 *         description: Not DRAFT, missing address, or missing serviceCharge for Direct Trader.
 *       404:
 *         description: Job or address not found.
 */
router.post(
  '/:id/publish',
  ...customerOnly,
  validate(publishJobSchema),
  controller.publishJob
);

export default router;
