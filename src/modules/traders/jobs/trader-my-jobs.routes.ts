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
  myJobPartialPaymentBodySchema,
  myJobQuoteBodySchema,
  myJobSubmitCompletionBodySchema,
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
 *         description: |
 *           ACTIVE = in-progress / site-visit / awaiting payout.
 *           COMPLETED = finished jobs only.
 *           OTHER = cancelled jobs only.
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
 * /traders/jobs/mine/{id}/submit:
 *   post:
 *     summary: Submit job proof + finish (Job Progress → Submit & Next)
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Mobile screen:** Job Progress (materials + Job Proof + **Submit & Next**).
 *
 *       Single API for Submit & Next — saves work-proof photo URL(s) and marks the job completed.
 *       Prefer this over calling `POST .../proof-photos` then `POST .../finish` separately.
 *
 *       **Client flow:**
 *       1. User picks image(s) on device
 *       2. Upload file(s) via `POST /uploads` → get URL(s)
 *       3. On Submit & Next → call this endpoint once with those URL(s)
 *
 *       Body accepts either `photoUrl` (single) or `photoUrls` (array). At least one is required.
 *
 *       **`isPartPayment`:**
 *       - `false` → Mark as Finished: save proof + complete job → `flowStatus=COMPLETED`
 *       - `true` → Partial path: save proof only; job stays ACTIVE → then call
 *         `POST .../request-partial-payment` with `amount` + `description`
 *         (images already on Submit screen; Partial Payment screen needs no upload)
 *
 *       Response includes `paymentStatus`, `flowStatus`, `isPartPayment` for screen routing.
 *
 *       **Response** is shaped for the Payment Request screen (no extra GET needed):
 *       `id`, `jobRef`, `title`, `completedAt`, `location.fullAddress`, `paymentSummary`, `paymentStatus`, `flowStatus`, `isPartPayment`.
 *
 *       `paymentStatus` is a **string** (not boolean) for future part-payment support, e.g.
 *       `UNPAID` | `PENDING` | `PARTIALLY_PAID` | `PAID` | `FAILED` | `REFUNDED` | `CANCELLED`.
 *       After submit (before payment request) it is typically `UNPAID`.
 *       `flowStatus` on list/detail also returns `PARTIAL_PAYMENT_PENDING` / `PARTIALLY_PAID` after part payment.
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
 *             properties:
 *               photoUrl: { type: string, format: uri, description: Single proof image URL }
 *               photoUrls:
 *                 type: array
 *                 items: { type: string, format: uri }
 *                 description: One or more proof image URLs
 *               isPartPayment:
 *                 type: boolean
 *                 default: false
 *                 description: false = finish job; true = save proof only then use request-partial-payment
 *           examples:
 *             markFinished:
 *               value:
 *                 photoUrls:
 *                   - https://api.brisk.ie/uploads/files/job_proof/a.jpg
 *                 isPartPayment: false
 *             partialProofOnly:
 *               value:
 *                 photoUrls:
 *                   - https://api.brisk.ie/uploads/files/job_proof/a.jpg
 *                 isPartPayment: true
 *             single:
 *               value:
 *                 photoUrl: https://api.brisk.ie/uploads/files/job_proof/example.jpg
 *                 isPartPayment: false
 *     responses:
 *       200:
 *         description: Proof saved. Finished (false) or ready for partial request (true).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Proof uploaded successfully
 *               data:
 *                 id: uuid
 *                 jobRef: BRK-99281
 *                 title: Emergency Pipe Repair
 *                 completedAt: '2026-10-24T14:30:00.000Z'
 *                 location:
 *                   fullAddress: 24 Windsor Terrace, SE1 7PB
 *                 paymentSummary:
 *                   baseRate: 120
 *                   materialCost: 0
 *                   platformFee: 10
 *                   offerApplied: 0
 *                   vatRate: 20
 *                   vatAmount: 26
 *                   totalAmount: 156
 *                 paymentStatus: UNPAID
 *                 flowStatus: COMPLETED
 *                 isPartPayment: false
 *       400:
 *         description: Missing photos, not arrived, or cancelled
 *       409:
 *         description: Already finished
 */
router.post(
  '/mine/:id/submit',
  validate(myJobSubmitCompletionBodySchema),
  controller.submitJobCompletion
);

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
 * /traders/jobs/mine/{id}/payment-request:
 *   get:
 *     summary: Payment Request screen details (re-open after Submit / app relaunch)
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Use when trader already submitted proof (`POST .../submit`), closed the app,
 *       then opens the job again → Payment Request screen.
 *
 *       **Same `data` shape as `POST /traders/jobs/mine/{id}/submit`**
 *       (`paymentSummary`, `paymentStatus`, `location`, `completedAt`, …).
 *
 *       Alias: `GET /traders/jobs/mine/{id}/payment-summary`
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payment Request screen payload
 *       400:
 *         description: Job not finished / cancelled
 */
router.get(
  '/mine/:id/payment-request',
  validate(myJobIdParamSchema),
  controller.getPaymentRequestScreen
);

/**
 * @swagger
 * /traders/jobs/mine/{id}/payment-summary:
 *   get:
 *     summary: Payment Request screen details (alias of payment-request)
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: Same response as GET /traders/jobs/mine/{id}/payment-request
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Fee breakdown / payment request payload
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
 * /traders/jobs/mine/{id}/partial-payment:
 *   get:
 *     summary: Partial payment screen (Request Partial Payment details)
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Returns Job Amount, Already Paid, remaining balance, previous payments, and `paymentStatus`
 *       for the Payment Request (installment) screen.
 *
 *       `paymentStatus` is a string: `UNPAID` | `PENDING` | `PARTIALLY_PAID` | `PAID` | …
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Partial payment screen payload
 *       400:
 *         description: Not arrived / cancelled
 */
router.get(
  '/mine/:id/partial-payment',
  validate(myJobIdParamSchema),
  controller.getPartialPaymentScreen
);

/**
 * @swagger
 * /traders/jobs/mine/{id}/part-payment-history:
 *   get:
 *     summary: Part Payment History (flat list)
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Screen:** Installment / Part Payment History → Transaction History list.
 *       Returns flat `data[]` with title, amount, amountLabel, formattedPaymentDate, transactionId.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Flat installment history list
 */
router.get(
  '/mine/:id/part-payment-history',
  validate(myJobIdParamSchema),
  controller.listPartPaymentHistory
);

/**
 * @swagger
 * /traders/jobs/mine/{id}/request-partial-payment:
 *   post:
 *     summary: Send partial installment payment request
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Screen:** Payment Request → Send Payment Request.
 *       Separate from full-job `POST .../request-payment`.
 *
 *       Allowed while job is in progress (arrived, not finished).
 *       Body: `amount` (installment) + `description`.
 *       Optional: `photoUrls` / `photoUrl` — proof images (upload via `POST /uploads` first).
 *       Job stays `IN_PROGRESS` (does not move to PAYMENT_PENDING).
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
 *             required: [amount, description]
 *             properties:
 *               amount: { type: number, example: 420 }
 *               description:
 *                 type: string
 *                 example: Electrical wiring and mounting hardware completed.
 *               photoUrl: { type: string, format: uri }
 *               photoUrls:
 *                 type: array
 *                 items: { type: string, format: uri }
 *           example:
 *             amount: 420
 *             description: Electrical wiring and mounting hardware completed.
 *             photoUrls:
 *               - https://api.brisk.ie/uploads/files/job_proof/example.jpg
 *     responses:
 *       200:
 *         description: Partial payment request sent
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Partial payment request sent successfully.
 *               data:
 *                 paymentRequestId: uuid
 *                 paymentStatus: PENDING
 *                 installment:
 *                   amount: 420
 *                   description: Electrical wiring and mounting hardware completed.
 *                   netDue: 420
 *                 jobAmount: 931.5
 *                 alreadyPaid: 511.5
 *                 remainingBalance: 420
 *                 duePaymentSummary:
 *                   installmentDueAmount: 420
 *                   netDue: 420
 *       400:
 *         description: Invalid amount / not arrived / exceeds remaining
 *       409:
 *         description: Open partial request already pending / fully paid
 */
router.post(
  '/mine/:id/request-partial-payment',
  validate(myJobPartialPaymentBodySchema),
  controller.requestPartialPayment
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

/**
 * @swagger
 * /traders/jobs/mine/{id}/invoice/download:
 *   get:
 *     summary: Download job invoice as PDF
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Returns `application/pdf` attachment for finished / payment-pending / completed jobs.
 *       Use `invoiceUrl` from job outcome / payment screens:
 *       `GET /traders/jobs/mine/{id}/invoice/download`
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Job not finished yet
 */
router.get(
  '/mine/:id/invoice/download',
  validate(myJobIdParamSchema),
  controller.downloadJobInvoice
);

export default router;
