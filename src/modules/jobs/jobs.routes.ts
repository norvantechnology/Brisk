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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryId, description]
 *             properties:
 *               categoryId: { type: string, format: uuid }
 *               subcategoryId: { type: string, format: uuid }
 *               title: { type: string }
 *               description: { type: string }
 *               scheduledDate: { type: string, format: date-time }
 *               timeSlot: { type: string, example: Morning }
 *               durationLabel: { type: string, example: "1 Hour" }
 *               phoneNumber: { type: string }
 *               photoUrls: { type: array, items: { type: string, format: uri } }
 *               qaFormAnswers: { type: object }
 *               offerId: { type: string, format: uuid }
 *               appliedTraderOfferId: { type: string, format: uuid }
 *               claimId: { type: string, format: uuid }
 *               traderId: { type: string, format: uuid }
 *               serviceCharge: { type: number, example: 95 }
 *     responses:
 *       201:
 *         description: Job draft created.
 *   get:
 *     summary: List my jobs
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, QUOTED, ACCEPTED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, PAYMENT_PENDING]
 *     responses:
 *       200:
 *         description: Job list in data.
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job detail with photos, offer, address, booking/invoice ids.
 *   patch:
 *     summary: Update a draft job
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job updated.
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
 *             type: object
 *             required: [addressId]
 *             properties:
 *               addressId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Location copied onto the job.
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               addressId: { type: string, format: uuid }
 *               serviceCharge: { type: number, example: 95 }
 *     responses:
 *       200:
 *         description: Returns job, booking, and invoice for Direct Trader flow.
 */
router.post(
  '/:id/publish',
  ...customerOnly,
  validate(publishJobSchema),
  controller.publishJob
);

export default router;
