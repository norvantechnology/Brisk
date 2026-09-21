import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './trader-my-jobs.controller';
import {
  incomingJobIdParamSchema,
  myJobAcceptBodySchema,
  myJobIdParamSchema,
  myJobMaterialBodySchema,
  myJobMaterialIdParamSchema,
  myJobMessageBodySchema,
  myJobProofPhotoBodySchema,
  myJobQuoteBodySchema,
  myJobsListQuerySchema,
} from './trader-my-jobs.validation';

const router = Router();

/**
 * @swagger
 * /traders/jobs/mine:
 *   get:
 *     summary: My Jobs list (Active / Completed / Other)
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tab
 *         schema: { type: string, enum: [ACTIVE, COMPLETED, OTHER], default: ACTIVE }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         description: Paginated my-jobs cards
 *       401:
 *         description: Unauthorized
 */
router.get('/mine', validate(myJobsListQuerySchema), controller.listMyJobs);

/**
 * @swagger
 * /traders/jobs/incoming/latest:
 *   get:
 *     summary: Latest incoming job for map sheet
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Incoming job payload or null
 */
router.get('/incoming/latest', controller.getIncomingLatest);

/**
 * @swagger
 * /traders/jobs/incoming/{id}/accept:
 *   post:
 *     summary: Accept incoming job interest
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Interest recorded with next-step hint
 *       404:
 *         description: Job not found
 */
router.post(
  '/incoming/:id/accept',
  validate(incomingJobIdParamSchema),
  controller.acceptIncomingJob
);

/**
 * @swagger
 * /traders/jobs/incoming/{id}/decline:
 *   post:
 *     summary: Decline incoming job
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Soft decline success
 */
router.post(
  '/incoming/:id/decline',
  validate(incomingJobIdParamSchema),
  controller.declineIncomingJob
);

/**
 * @swagger
 * /traders/jobs/mine/{id}:
 *   get:
 *     summary: My Job detail
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Full my-job detail payload
 *       404:
 *         description: Job not found
 */
router.get('/mine/:id', validate(myJobIdParamSchema), controller.getMyJobDetail);

/**
 * @swagger
 * /traders/jobs/mine/{id}/process:
 *   get:
 *     summary: Process / in-progress job screen detail
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Active process payload (materials items, proof, canFinish, arrivalStatus)
 *       400:
 *         description: Job not in active process state
 */
router.get('/mine/:id/process', validate(myJobIdParamSchema), controller.getProcessJobDetail);

/**
 * @swagger
 * /traders/jobs/mine/{id}/completed:
 *   get:
 *     summary: Completed job history screen detail
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Completed job outcome (review, photos, paymentSummary, invoice)
 *       400:
 *         description: Job is not completed
 */
router.get('/mine/:id/completed', validate(myJobIdParamSchema), controller.getCompletedJobDetail);

/**
 * @swagger
 * /traders/jobs/mine/{id}/cancelled:
 *   get:
 *     summary: Cancelled job history screen detail
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Cancelled job outcome (same shape as completed)
 *       400:
 *         description: Job is not cancelled
 */
router.get('/mine/:id/cancelled', validate(myJobIdParamSchema), controller.getCancelledJobDetail);

/**
 * @swagger
 * /traders/jobs/mine/{id}/arrive:
 *   post:
 *     summary: Mark arrived on site
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Arrival recorded; job IN_PROGRESS
 *       400:
 *         description: No booking
 *       409:
 *         description: Already arrived or finished
 */
router.post('/mine/:id/arrive', validate(myJobIdParamSchema), controller.arriveAtJob);

/**
 * @swagger
 * /traders/jobs/mine/{id}/finish:
 *   post:
 *     summary: Finish job
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job completed
 *       400:
 *         description: Must arrive first
 *       409:
 *         description: Already finished
 */
router.post('/mine/:id/finish', validate(myJobIdParamSchema), controller.finishJob);

/**
 * @swagger
 * /traders/jobs/mine/{id}/quotes:
 *   post:
 *     summary: Submit or update quote
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Upserts quote as PENDING. Job stays PUBLISHED on Discover until customer confirms.
 *       Discover alias: POST /traders/jobs/discover/{id}/quotes
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
 *             $ref: '#/components/schemas/TraderQuoteRequestBody'
 *           example:
 *             amount: 450
 *             notes: Includes parts and labour
 *     responses:
 *       200:
 *         description: Quote upserted as PENDING
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/TraderQuoteResponse' }
 *             example:
 *               success: true
 *               message: Quote submitted successfully.
 *               data:
 *                 id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
 *                 jobId: 8a8fb0e5-a330-4c62-8e76-a358bd792b84
 *                 amount: 450
 *                 notes: Includes parts and labour
 *                 status: PENDING
 *                 hasSubmittedQuote: true
 *                 canUpdateQuote: true
 *                 isJobRequested: false
 *                 isWaitingForCustomerConfirmation: false
 *       404:
 *         description: Job not found or no longer available for quoting
 *       409:
 *         description: Job already assigned to another trader
 */
router.post('/mine/:id/quotes', validate(myJobQuoteBodySchema), controller.upsertQuote);

/**
 * @swagger
 * /traders/jobs/mine/{id}/accept:
 *   post:
 *     summary: Request job (marketplace) or confirm assigned Direct Trader job
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Marketplace (PUBLISHED, unassigned): same as POST /traders/jobs/discover/{id}/request —
 *       sets waiting-for-customer flags; does NOT assign trader.
 *       Prefer Discover request endpoint from Job Details.
 *       Already-assigned Direct Trader jobs: ensures booking / ACCEPTED state.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number }
 *     responses:
 *       200:
 *         description: Job accepted; booking ensured
 *       409:
 *         description: Assigned to another trader
 */
router.post('/mine/:id/accept', validate(myJobAcceptBodySchema), controller.acceptJob);

/**
 * @swagger
 * /traders/jobs/mine/{id}/materials:
 *   get:
 *     summary: List job materials
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Materials list with running total
 *   post:
 *     summary: Add material / part
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
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
 *             required: [name, price]
 *             properties:
 *               name: { type: string }
 *               detail: { type: string }
 *               price: { type: number }
 *               photoUrl: { type: string, format: uri }
 *     responses:
 *       201:
 *         description: Material added
 */
router.get('/mine/:id/materials', validate(myJobIdParamSchema), controller.listMaterials);
router.post('/mine/:id/materials', validate(myJobMaterialBodySchema), controller.addMaterial);

/**
 * @swagger
 * /traders/jobs/mine/{id}/materials/{materialId}:
 *   delete:
 *     summary: Delete a material
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: materialId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Material removed
 *       404:
 *         description: Material not found
 */
router.delete(
  '/mine/:id/materials/:materialId',
  validate(myJobMaterialIdParamSchema),
  controller.deleteMaterial
);

/**
 * @swagger
 * /traders/jobs/mine/{id}/proof-photos:
 *   post:
 *     summary: Upload proof photo URL
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
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
 *             required: [photoUrl]
 *             properties:
 *               photoUrl: { type: string, format: uri }
 *     responses:
 *       201:
 *         description: Proof photo created
 */
router.post(
  '/mine/:id/proof-photos',
  validate(myJobProofPhotoBodySchema),
  controller.addProofPhoto
);

/**
 * @swagger
 * /traders/jobs/mine/{id}/messages:
 *   get:
 *     summary: List negotiation messages
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Chat messages
 *   post:
 *     summary: Send negotiation message
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
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
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *     responses:
 *       201:
 *         description: Message sent
 */
router.get('/mine/:id/messages', validate(myJobIdParamSchema), controller.listMessages);
router.post('/mine/:id/messages', validate(myJobMessageBodySchema), controller.sendMessage);

/**
 * @swagger
 * /traders/jobs/mine/{id}/payment-summary:
 *   get:
 *     summary: Payment summary before request
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Fee breakdown with VAT
 */
router.get(
  '/mine/:id/payment-summary',
  validate(myJobIdParamSchema),
  controller.getPaymentSummary
);

/**
 * @swagger
 * /traders/jobs/mine/{id}/request-payment:
 *   post:
 *     summary: Request full job payment
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payment Request Sent payload
 *       409:
 *         description: Already requested
 */
router.post(
  '/mine/:id/request-payment',
  validate(myJobIdParamSchema),
  controller.requestPayment
);

/**
 * @swagger
 * /traders/jobs/mine/{id}/site-visit/complete:
 *   post:
 *     summary: Complete site visit
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Site Visit Completed success payload
 *       409:
 *         description: Already completed
 */
router.post(
  '/mine/:id/site-visit/complete',
  validate(myJobIdParamSchema),
  controller.completeSiteVisit
);

/**
 * @swagger
 * /traders/jobs/mine/{id}/site-visit/request-payment:
 *   post:
 *     summary: Request site visit fee payment
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Site visit fee payment sent
 *       400:
 *         description: Visit not completed or no fee
 */
router.post(
  '/mine/:id/site-visit/request-payment',
  validate(myJobIdParamSchema),
  controller.requestSiteVisitPayment
);

export default router;
