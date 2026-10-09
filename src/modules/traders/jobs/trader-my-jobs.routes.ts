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
 *     description: |
 *       Filters combine with `tab`. Default order: `updatedAt` desc (unchanged for mobile).
 *       Computed sorts (`quotePrice`, `scheduledDate`, `distanceKm`, `areaName`, `statusLabel`, `flowStatus`, `paymentStatus`)
 *       use the same values shown on the card. Empty values are always listed last.
 *
 *       Example: `GET /traders/jobs/mine?tab=ACTIVE&page=1&limit=10&search=sink&categoryId=3f0f23dd-1c2b-4a5e-9f10-6a7b8c9d0e1f&siteVisit=false&from=2026-09-01&to=2026-09-30&sortBy=scheduledDate&sortOrder=asc`
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
 *       - $ref: '#/components/parameters/TraderPage'
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, default: 20, maximum: 50 }
 *       - in: query
 *         name: search
 *         schema: { type: string, maxLength: 100, example: sink }
 *         description: Matches job ref, title, city, postcode, customer name or category name.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PUBLISHED, QUOTED, ACCEPTED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, PAYMENT_PENDING] }
 *         description: Job status (combined with `tab`).
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: siteVisit
 *         schema: { type: boolean }
 *         description: true = site-visit jobs only, false = jobs without a site visit (same rule as card `siteVisit`).
 *       - $ref: '#/components/parameters/TraderDateFrom'
 *       - $ref: '#/components/parameters/TraderDateTo'
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [updatedAt, createdAt, jobRef, title, status, customerName, categoryName, quotePrice, scheduledDate, distanceKm, areaName, statusLabel, flowStatus, paymentStatus]
 *           default: updatedAt
 *         description: '`from`/`to` filter on `createdAt` (job posted date).'
 *       - $ref: '#/components/parameters/TraderSortOrder'
 *     responses:
 *       200:
 *         description: Paginated my-jobs cards
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/TraderMyJobsList' }
 *             example:
 *               success: true
 *               message: My jobs retrieved successfully.
 *               data:
 *                 tab: ACTIVE
 *                 items:
 *                   - id: 8a8fb0e5-a330-4c62-8e76-a358bd792b84
 *                     jobRef: JOB-1119
 *                     title: Kitchen sink leaking
 *                     status: SCHEDULED
 *                     statusBadge: Ready to Arrive
 *                     statusLabel: Ready to Arrive
 *                     flowStatus: READY_TO_ARRIVE
 *                     paymentStatus: UNPAID
 *                     isPartPayment: false
 *                     isPartialJob: false
 *                     siteVisit: false
 *                     siteVisitRequested: false
 *                     isSiteVisitDone: false
 *                     siteVisitLabel: null
 *                     arrivalStatus: ARRIVING_SOON
 *                     siteVisitedBadge: false
 *                     customerName: John Murphy
 *                     customerProfilePhotoUrl: https://cdn.brisk.ie/avatars/john.jpg
 *                     areaName: Dublin
 *                     distanceKm: 4.2
 *                     quotePrice: 120
 *                     scheduledDate: '2026-09-18T09:00:00.000Z'
 *                     createdAt: '2026-09-10T11:30:00.000Z'
 *                     primaryAction: ARRIVE
 *                 meta: { total: 14, page: 1, limit: 10, totalPages: 2 }
 *       400:
 *         $ref: '#/components/responses/TraderListValidationError'
 *       401:
 *         $ref: '#/components/responses/TraderUnauthorized'
 *       403:
 *         $ref: '#/components/responses/TraderForbidden'
 */
router.get('/mine', validate(myJobsListQuerySchema), controller.listMyJobs);

/**
 * @swagger
 * /traders/jobs/incoming/latest:
 *   get:
 *     summary: Latest customer-accepted quotation awaiting my confirmation (bottom sheet)
 *     description: |
 *       Bottom sheet (Kitchen Sink Leak style) is opened by socket event **`job:accept`**
 *       (same payload) when a customer accepts this trader's quotation. Call this on app
 *       launch / reconnect to re-open a sheet that was missed. `null` when nothing is waiting.
 *       Notification tap (`QUOTE_ACCEPTED`) → `GET /traders/jobs/incoming/{jobId}` for that exact job.
 *       New marketplace jobs (`job:created` / `job:published`) must NOT open this sheet —
 *       they only refresh Discover.
 *
 *       **View & Accept:** `POST /traders/jobs/incoming/{id}/accept` → job moves to My Jobs ACTIVE
 *       **Decline:** `POST /traders/jobs/incoming/{id}/decline`
 *       Close the sheet on `job:accept_cancelled` (customer picked another trader).
 *
 *       Fields: `jobId`, `quoteId`, `title`, `description` (note), `distanceKm`, `distanceMiles`,
 *       `charges` (accepted quote amount), `currencyCode`, `currencySymbol`,
 *       `customer{fullName, profileImage, isVerifiedCustomer}`, `actions`, `acceptedAt`.
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Incoming job payload or null
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/TraderIncomingJob'
 *             example:
 *               success: true
 *               message: Incoming job retrieved successfully.
 *               data:
 *                 id: 0100839a-7364-4d00-9323-a2b6e44d81bc
 *                 jobId: 0100839a-7364-4d00-9323-a2b6e44d81bc
 *                 quoteId: 6c6f92ce-1da9-401b-8722-95ccac9f8dd2
 *                 jobRef: BRK-1042
 *                 title: Kitchen Sink Leak
 *                 description: Water leaking under the sink, needs urgent fix.
 *                 distanceKm: 2.4
 *                 distanceMiles: 1.5
 *                 charges: 120
 *                 quoteAmount: 120
 *                 currencyCode: EUR
 *                 currencySymbol: €
 *                 customer: { fullName: Sarah Jenkins, profileImage: null, isVerifiedCustomer: true }
 *                 actions: { canAccept: true, canDecline: true }
 *                 assignmentStatus: CUSTOMER_ACCEPTED
 *                 isSiteVisit: false
 *                 areaName: Dublin
 *                 latitude: 53.36
 *                 longitude: -6.25
 *                 createdAt: '2026-10-02T09:00:00.000Z'
 *                 acceptedAt: '2026-10-02T10:15:00.000Z'
 */
router.get('/incoming/latest', controller.getIncomingLatest);

/**
 * @swagger
 * /traders/jobs/incoming/{id}:
 *   get:
 *     summary: Re-open the accepted-quotation bottom sheet for one job (notification tap)
 *     description: |
 *       Second way to open the same sheet as socket **`job:accept`** — e.g. several events arrived
 *       at once and the live popup was missed. Call it when the trader taps a **`QUOTE_ACCEPTED`**
 *       notification (FCM push `data.type` or inbox row `type`), using `data.jobId` (`data.quoteId` also works).
 *
 *       Same payload as `GET /traders/jobs/incoming/latest`. `data: null` when the job is no longer
 *       waiting for this trader (already accepted / declined, customer picked another trader or
 *       cancelled) — then open `GET /traders/jobs/mine/{jobId}` or show the message instead.
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Job id from the notification (`data.jobId`); the quote id is accepted too.
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Incoming job payload, or null when no longer waiting
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/TraderIncomingJob'
 *             examples:
 *               waiting:
 *                 value: { success: true, message: Incoming job retrieved successfully., data: { jobId: 0100839a-7364-4d00-9323-a2b6e44d81bc, quoteId: 6c6f92ce-1da9-401b-8722-95ccac9f8dd2, title: Kitchen Sink Leak, charges: 120, currencySymbol: €, actions: { canAccept: true, canDecline: true } } }
 *               notWaiting:
 *                 value: { success: true, message: This job is no longer waiting for your confirmation., data: null }
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 */
router.get('/incoming/:id', validate(incomingJobIdParamSchema), controller.getIncomingJob);

/**
 * @swagger
 * /traders/jobs/incoming/{id}/accept:
 *   post:
 *     summary: View & Accept — confirm customer-accepted job (moves to My Jobs ACTIVE)
 *     description: |
 *       Call when the trader taps **View & Accept** on the `job:accept` sheet (`id` = `jobId`).
 *
 *       **What happens**
 *       - Job is assigned to this trader → `ACCEPTED` (or `SCHEDULED` when the job has a date).
 *       - Booking is created, other open quotations are rejected, pending site visit is confirmed.
 *       - Job appears in `GET /traders/jobs/mine?tab=ACTIVE`.
 *       - Customer receives socket `job:status_changed` + inbox notification `JOB_STATUS_CHANGED` ("Job confirmed").
 *
 *       **Safe to retry** — returns 200 again if the job is already assigned to this trader.
 *       Same result as `POST /traders/jobs/mine/{id}/accept` for a customer-accepted quote.
 *
 *       Response `data` = same payload as `GET /traders/jobs/mine/{id}` (open My Job detail).
 *
 *       **404 `NO_ACCEPTED_QUOTE`** → close the sheet: the customer switched to another trader,
 *       cancelled the job, or never accepted this quote.
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Job id (`jobId` from the job:accept sheet)
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: My Job detail (now ACTIVE)
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job accepted. It is now in your active jobs.
 *               data:
 *                 id: 0100839a-7364-4d00-9323-a2b6e44d81bc
 *                 jobRef: BRK-1042
 *                 title: Kitchen Sink Leak
 *                 status: ACCEPTED
 *                 '...': Same fields as GET /traders/jobs/mine/{id}
 *       404:
 *         description: Nothing waiting for this trader on this job — close the sheet.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: This job is no longer waiting for your confirmation.
 *               data: { code: NO_ACCEPTED_QUOTE }
 *       409:
 *         description: Job already assigned to another trader.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: Job is already assigned to another trader.
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
 *     summary: Decline customer-accepted job
 *     description: |
 *       Trader taps **Decline** on the `job:accept` sheet (`id` = `jobId`).
 *
 *       **What happens**
 *       - This trader's quotation → `REJECTED`; job stays open (not assigned).
 *       - Customer receives socket `job:declined` + inbox notification `JOB_DECLINED`
 *         and can accept another trader's quotation.
 *       - Trader can still send a new quotation later from Discover.
 *
 *       **404 `NO_ACCEPTED_QUOTE`** → close the sheet (customer switched trader / cancelled).
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Job id (`jobId` from the job:accept sheet)
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Declined
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job declined. The customer has been notified.
 *               data:
 *                 jobId: 0100839a-7364-4d00-9323-a2b6e44d81bc
 *                 quoteId: 6c6f92ce-1da9-401b-8722-95ccac9f8dd2
 *                 declined: true
 *       404:
 *         description: Nothing waiting for this trader on this job — close the sheet.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: This job is no longer waiting for your confirmation.
 *               data: { code: NO_ACCEPTED_QUOTE }
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
 *     description: |
 *       Full Job Details payload for the logged-in trader.
 *
 *       **Site visit done flag:**
 *       - Top-level `isSiteVisitDone` — `true` only after trader completes site visit (`visit.status=COMPLETED`)
 *       - Also on `siteVisit.isSiteVisitDone` + `siteVisit.completedAt`
 *       - `isSiteVisit` / `siteVisit.isSiteVisit` = this job is a site-visit job (may still be pending)
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Full my-job detail payload (includes isSiteVisitDone)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Job details retrieved successfully. }
 *                 data: { $ref: '#/components/schemas/TraderMyJobDetail' }
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
 *     description: |
 *       Completed job history screen. Includes `previousPayments` — full installment
 *       list with the same item shape as GET .../part-payment-history (no server-side truncate).
 *       FE can show first N on screen; full list is already in `previousPayments`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: |
 *           Completed job outcome (review, photos, paymentSummary, invoice,
 *           previousPayments full list).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     previousPayments:
 *                       type: array
 *                       description: All part-payment history items (same shape as part-payment-history)
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, example: TXN-A1B2C3 }
 *                           title: { type: string, example: Initial Deposit }
 *                           amount: { type: number, example: 481.5 }
 *                           amountLabel: { type: string, example: '€ 481.50' }
 *                           currencyCode: { type: string, example: EUR }
 *                           currencySymbol: { type: string, example: € }
 *                           paymentDate: { type: string, format: date-time }
 *                           formattedPaymentDate: { type: string, example: 'Jul 10, 2026 • 2:30 PM' }
 *                           status: { type: string, example: PAID }
 *                           statusLabel: { type: string, example: 'Paid • Jul 10, 2026' }
 *                           transactionId: { type: string, example: TXN-A1B2C3 }
 *                     previousPaymentsTotal: { type: integer, example: 5 }
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
 *     description: |
 *       Marks the work finished. If a balance is unpaid, the FULL_JOB payment request is sent to the
 *       customer automatically and job `status` becomes `PAYMENT_PENDING`; `COMPLETED` if already fully paid.
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
 *       - `false` → Mark as Finished: save proof + finish job. If a balance is unpaid, the FULL_JOB payment
 *         request is sent to the customer automatically (job `PAYMENT_PENDING`, customer gets `paymentRequestId`);
 *         `COMPLETED` only once fully paid. Calling `POST .../request-payment` afterwards is optional (idempotent).
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
 *     summary: Request job (marketplace), confirm customer-accepted quote, or confirm Direct Trader job
 *     tags: ['Trader / My Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       - **Customer already accepted this trader's quote:** same as
 *         `POST /traders/jobs/incoming/{id}/accept` (View & Accept) → job ACTIVE, returns My Job detail.
 *       - **Marketplace (PUBLISHED, unassigned), not accepted yet:** same as
 *         `POST /traders/jobs/discover/{id}/request` — waiting for customer; does NOT assign trader.
 *         Prefer the Discover request endpoint from Job Details.
 *       - **Already-assigned Direct Trader job:** ensures booking / ACCEPTED state.
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
 *         description: |
 *           Payment Request Sent payload. Finish already sends the FULL_JOB request, so this returns that
 *           request (same `paymentRequestId`); it only creates one for older finished jobs without a request.
 *       409:
 *         description: The full-job payment was already received
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
 *       Returns flat `data[]` with title, amount, amountLabel, statusLabel,
 *       formattedPaymentDate, transactionId (same item shape as completed.previousPayments).
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
