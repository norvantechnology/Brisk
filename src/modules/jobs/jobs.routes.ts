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
 *       **Mobile screen:** Post a New Job (draft).
 *
 *       **Auth:** Customer Bearer token.
 *
 *       **Flow order:**
 *       1. Claim offer → `POST /trader-offers/{id}/claim` → use `data.nextJobPrefill`
 *       2. `POST /jobs` with prefill fields (`appliedTraderOfferId`, `claimId`, `traderId`, `categoryId`, …)
 *       3. `PUT /jobs/{id}/location` with saved `addressId`
 *       4. `POST /jobs/{id}/publish` → booking + invoice
 *       5. Checkout via `/invoices` + `/payments`
 *
 *       **Aliases:** `appliedTraderOfferId` and `offerId` are both accepted (same offer UUID).
 *
 *       **Response:** `data` is a Job object (includes `offerApplied`, `offer.bannerTitle`, `nextSteps`).
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
 *             photoUrls: []
 *             appliedTraderOfferId: b7692de1-4d8c-40db-98e6-079ce14e8d68
 *             claimId: cbc8fa2a-4044-4aa7-9702-d5843d9920c3
 *             traderId: 2a0d6b4d-889c-4e48-8270-11a20d00d169
 *             serviceCharge: 125
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
 *     summary: Set job location from a saved address
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Choose location / saved address step.
 *
 *       Copies address fields onto the job (`addressLine`, `city`, `postcode`, lat/lng).
 *       After success, `nextSteps.needsLocation` becomes false and `canPublish` true (while DRAFT).
 *
 *       Create addresses first via `POST /addresses`.
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
 *     summary: Publish job (Direct Trader creates Quote + Booking + Invoice)
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Review and publish / continue to payment.
 *
 *       **Requirements:**
 *       - Job must be DRAFT
 *       - Address required (body.addressId or previously set via location)
 *       - Direct Trader (`traderId` set) requires `serviceCharge` on body or draft
 *
 *       **Direct Trader side effects:**
 *       - Auto-accepted Quote
 *       - Booking (SCHEDULED)
 *       - Unpaid Invoice with Service Charge / Platform Fee (10% post-offer) / Trader Offer discount
 *       - Offer claim marked USED
 *       - Job status → SCHEDULED
 *
 *       **Response `data`:** `{ job, booking, invoice }` where `invoice` is the full Payment Details payload
 *       (same shape as GET /invoices/{id}), including `lineItems`, `payNowLabel`, `orderId`, `serviceSummary`.
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
