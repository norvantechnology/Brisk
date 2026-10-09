import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './jobs.controller';
import {
  createJobSchema,
  jobFormConfigSchema,
  jobIdParamSchema,
  listJobsSchema,
  myJobsTabQuerySchema,
  publishJobSchema,
  setJobLocationSchema,
  updateJobSchema,
  acceptJobQuoteSchema,
  siteVisitProposalParamSchema,
  cancelJobSchema,
  createJobDisputeSchema,
  jobQuoteDetailSchema,
  jobReviewSchema,
  rescheduleJobSchema,
} from './jobs.validation';

const router = Router();
const customerOnly = [authMiddleware, roleMiddleware(['CUSTOMER'] as const)];

/**
 * @swagger
 * /jobs/form-config:
 *   get:
 *     summary: Post a New Job — unified form show/hide config (all entry points)
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **When to call:** Opening **Post a New Job** from home category, subcategory,
 *       Accept Offer, trader profile, or deep link. Same response shape everywhere.
 *
 *       **Auth:** Customer Bearer token required.
 *
 *       **What mobile uses from `data.formConfig`:**
 *       - `offerBanner.discountLabel` — dynamic offer chip value (title/message empty; app owns copy)
 *       - `quoteTypeOptions[]` — REMOTE + ONSITE cards; fee amounts from subcategory only (no default)
 *       - `visibilityByQuoteType.REMOTE|ONSITE` — **bind budget/fee UI to selected quote type** (same for every entry point)
 *       - `showMinBudget` / `showMaxBudget` — default paint (REMOTE); re-read visibility when user switches card
 *       - `siteVisitFee.amount` — from admin subcategory (0 if unset); mobile owns badge/CTA copy
 *       - `nextAfterLocation` — navigation key only: `SITE_VISIT_PAY_FEE` or `WAITING_FOR_QUOTES`
 *       - `flowSteps[]` — step **keys** only (labels/CTAs empty — app owns copy)
 *
 *       **Dynamic only:** Figma is visual reference. API does not invent fees or marketing text.
 *
 *       **Response contract:** `data.prefill` + `data.formConfig` + nested objects always include all keys
 *       (`""` / `0` / `[]` / `false` — not null) for complete mobile models.
 *
 *       **Claim timing:** This endpoint never claims an offer. Accept = optional prefill;
 *       publish does not claim; payment confirm marks USED.
 *
 *       Pass any combination of query params you already know; omit unknown ones.
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         required: false
 *         schema: { type: string, format: uuid }
 *         description: |
 *           Service category UUID from home category tap or Accept Offer `nextJobPrefill.categoryId`.
 *           Used to resolve subcategory parent and prefill dropdowns.
 *           Example: e076d231-b0da-46cb-b60d-8aa9fbb8ce26
 *       - in: query
 *         name: subcategoryId
 *         required: false
 *         schema: { type: string, format: uuid }
 *         description: |
 *           Sub-category UUID. Controls Site Visit card visibility (`siteVisitEnabled`),
 *           fee amount (`siteVisitFee`), budget show/hide (`priceEnabled` + `priceEnteredBy`),
 *           and `qaFormSchema`. Prefer always sending when known.
 *       - in: query
 *         name: offerId
 *         required: false
 *         schema: { type: string, format: uuid }
 *         description: |
 *           Trader/Brisk offer UUID when entering from Accept Offer.
 *           Prefills category/subcategory/trader, sets `offerApplied=true`, builds offer banner.
 *           Does **not** claim the offer. 409 if offer already USED by this customer.
 *       - in: query
 *         name: entryPoint
 *         required: false
 *         schema:
 *           type: string
 *           enum: [OFFER, HOME_CATEGORY, HOME_SUBCATEGORY, DIRECT, TRADER_PROFILE]
 *         description: |
 *           Analytics / UI hint for how the user opened Post Job.
 *           If omitted, inferred: offerId→OFFER, subcategoryId→HOME_SUBCATEGORY,
 *           categoryId→HOME_CATEGORY, else DIRECT.
 *     responses:
 *       200:
 *         description: |
 *           `data.formConfig`, `data.prefill`, `data.offer`, `data.navigation`.
 *           Use `prefill` to set dropdowns / offerId / traderId without hardcoding.
 *       401:
 *         description: Missing or invalid Bearer token.
 *       403:
 *         description: Not CUSTOMER role.
 *       404:
 *         description: categoryId, subcategoryId, or offerId not found.
 *       409:
 *         description: Offer already USED by this customer.
 */
router.get(
  '/form-config',
  ...customerOnly,
  validate(jobFormConfigSchema),
  controller.getJobFormConfig
);

/**
 * @swagger
 * /jobs:
 *   post:
 *     summary: Create a job draft (Post a New Job — all entry points)
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Post a New Job (after Accept Offer or home category).
 *
 *       **Auth:** Customer Bearer.
 *
 *       Creates status **DRAFT** (wizard in progress — not live). Same body for every entry point — use
 *       `GET /jobs/form-config` (or Accept `jobFormConfig`) for show/hide.
 *
 *       **Offer / Trader path:** send `offerId` (or `appliedTraderOfferId`) + usually `traderId`
 *       from Accept `nextJobPrefill`. Do **not** require a prior claim API.
 *
 *       **Sub-category / Home path:** `offerId`, `appliedTraderOfferId`, `claimId`, and `traderId`
 *       are **optional** — send `null` or omit them. Job still creates as DRAFT.
 *
 *       **Site Visit:** `quoteType=ONSITE` snapshots `siteVisitFee` on the job
 *       from subcategory (0 if admin left fee unset). Next after form: Choose Location.
 *
 *       **Images:** `POST /uploads` with `purpose=job_photo`, then put returned URLs in `photoUrls`.
 *
 *       **Next:** `PUT /jobs/{id}/location` → `POST /jobs/{id}/publish` (creates unpaid invoice,
 *       job → `PAYMENT_PENDING` — not live until pay) → Payment Details.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateJobRequest'
 *           examples:
 *             fromSubCategoryNoOffer:
 *               summary: Sub-category flow — no offer/trader (nulls allowed)
 *               value:
 *                 categoryId: e076d231-b0da-46cb-b60d-8aa9fbb8ce26
 *                 subcategoryId: a1111111-1111-1111-1111-111111111111
 *                 title: Fix leaking kitchen sink
 *                 description: Kitchen sink leak under cabinet.
 *                 quoteType: REMOTE
 *                 offerId: null
 *                 traderId: null
 *             fromHomeCategory:
 *               summary: Home category → Remote Quote with budget
 *               value:
 *                 categoryId: e076d231-b0da-46cb-b60d-8aa9fbb8ce26
 *                 subcategoryId: a1111111-1111-1111-1111-111111111111
 *                 title: Fix leaking kitchen sink
 *                 description: Kitchen sink leak under cabinet.
 *                 scheduledDate: "2026-10-24T00:00:00.000Z"
 *                 timeSlot: Afternoon
 *                 durationLabel: "1 Hours"
 *                 quoteType: REMOTE
 *                 minBudget: 50
 *                 maxBudget: 120
 *                 photoUrls: []
 *             fromOfferSiteVisit:
 *               summary: Accept Offer → Site Visit
 *               value:
 *                 categoryId: e076d231-b0da-46cb-b60d-8aa9fbb8ce26
 *                 subcategoryId: a1111111-1111-1111-1111-111111111111
 *                 title: Solar inspection
 *                 description: Access via side gate. Parking available.
 *                 scheduledDate: "2026-10-24T00:00:00.000Z"
 *                 timeSlot: Afternoon
 *                 durationLabel: "1 Hours"
 *                 phoneNumber: "+353871234567"
 *                 offerId: b7692de1-4d8c-40db-98e6-079ce14e8d68
 *                 traderId: 2a0d6b4d-889c-4e48-8270-11a20d00d169
 *                 quoteType: ONSITE
 *                 photoUrls:
 *                   - "https://brisk-aclm.onrender.com/uploads/files/job_photo/uuid/photo.png"
 *     responses:
 *       201:
 *         description: |
 *           Draft created. `data` is Job with `formConfig`, `offerApplied`, `offer.bannerMessage`,
 *           `siteVisitFee`, `nextSteps` (usually nextScreen=CHOOSE_LOCATION).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/Job' }
 *       400:
 *         description: Validation error (missing description/category, maxBudget < minBudget, inactive offer).
 *       401:
 *         description: Missing or invalid Bearer token.
 *       403:
 *         description: Not a CUSTOMER role.
 *       404:
 *         description: Offer, category, subcategory, or trader not found.
 *       409:
 *         description: Offer already USED (prior successful pay).
 *   get:
 *     summary: List my jobs
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Auth:** Customer Bearer.
 *       Returns `data.jobs` newest first. Use `status=DRAFT` for in-progress wizard jobs.
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           $ref: '#/components/schemas/JobStatus'
 *         description: |
 *           Optional filter.
 *           - DRAFT — Post Job wizard not finished
 *           - PUBLISHED / SCHEDULED — after publish (site visit path often SCHEDULED)
 *           - COMPLETED / CANCELLED — history
 *     responses:
 *       200:
 *         description: Wrapped job list (`data.jobs[]`).
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
 * /jobs/mine:
 *   get:
 *     summary: My Jobs screen — ACTIVE / COMPLETED / OTHER tabs (card rows)
 *     tags: ['Customer / My Job', 'Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Tabs**
 *       - `ACTIVE` — posted jobs not finished: awaiting/quoted, accepted, scheduled, in progress,
 *         payment pending (site-visit reschedule stays here). Drafts excluded (use `GET /jobs?status=DRAFT`).
 *       - `COMPLETED` — status COMPLETED.
 *       - `OTHER` — cancelled only.
 *
 *       **Card fields**
 *       - `id` (uuid string), `jobRef`, `title`, `statusLabel`
 *       - `status` — job status as display text, underscores replaced by spaces (e.g. `IN PROGRESS`, `PAYMENT PENDING`, `PUBLISHED`)
 *       - `date` — "October 24, 2026" (ACTIVE: scheduled/posted day · COMPLETED: finished day · OTHER: cancelled day); `dateAt` ISO
 *       - `provider` — assigned trader name (null until assigned)
 *       - `amount` (number or null) + `amountType`:
 *         `Estimated` (accepted quote / service charge / budget) · `Amount Due` (payment request sent) ·
 *         `Charges` (paid total) · `Refunded` (completed refunds)
 *       - `currencyCode`, `currencySymbol`
 *       - `isPartPayment` — true when the trader billed in installments (open Installment Payments screen)
 *       - **Pay routing** (status `PAYMENT PENDING`, only one of `invoiceId` / `paymentRequestId` is set):
 *         `invoiceId` set → `GET /invoices/{invoiceId}` + `POST /payments/intent` + `POST /payments/{paymentId}/confirm`.
 *         Upfront invoice, or the trader's final payment request (sent automatically when the trader finishes) —
 *         that invoice carries the request's totals and `paymentRequestId`; paying it marks the request PAID and the job COMPLETED.
 *         Only `paymentRequestId` set (installment, or booking already has an upfront invoice) →
 *         `GET /payment-requests/{paymentRequestId}` + `POST /payment-requests/{paymentRequestId}/payment-intent`. Both null = nothing to pay.
 *       - `downloadUrl` — invoice PDF path once the trader finished the job, else null
 *     parameters:
 *       - in: query
 *         name: tab
 *         schema: { type: string, enum: [ACTIVE, COMPLETED, OTHER], default: ACTIVE }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Card rows for the tab.
 *         content:
 *           application/json:
 *             examples:
 *               active:
 *                 summary: tab=ACTIVE
 *                 value:
 *                   success: true
 *                   message: My jobs retrieved successfully.
 *                   data:
 *                       - id: 3f1c2b9e-1d2a-4c3b-9e8f-0a1b2c3d4e5f
 *                         jobRef: JOB-411A
 *                         title: Boiler Repair
 *                         status: SCHEDULED
 *                         statusLabel: Active
 *                         date: October 24, 2026
 *                         dateAt: '2026-10-24T00:00:00.000Z'
 *                         provider: "Liam O'Connor Plumbing"
 *                         amount: 140
 *                         amountType: Estimated
 *                         currencyCode: EUR
 *                         currencySymbol: €
 *                         isPartPayment: false
 *                         invoiceId: null
 *                         paymentRequestId: null
 *                         downloadUrl: null
 *                   meta: { total: 1, page: 1, limit: 20, totalPages: 1 }
 *               completed:
 *                 summary: tab=COMPLETED
 *                 value:
 *                   success: true
 *                   message: My jobs retrieved successfully.
 *                   data:
 *                       - id: 7a2d4c6e-2b3c-4d5e-8f90-1a2b3c4d5e6f
 *                         jobRef: JOB-2B7C
 *                         title: Leakage & Sink Repair
 *                         status: COMPLETED
 *                         statusLabel: Completed
 *                         date: October 2, 2026
 *                         dateAt: '2026-10-02T15:15:00.000Z'
 *                         provider: Mark Wilson
 *                         amount: 144
 *                         amountType: Charges
 *                         currencyCode: EUR
 *                         currencySymbol: €
 *                         downloadUrl: /jobs/7a2d4c6e-2b3c-4d5e-8f90-1a2b3c4d5e6f/invoice/download
 *                   meta: { total: 1, page: 1, limit: 20, totalPages: 1 }
 *               other:
 *                 summary: tab=OTHER (cancelled)
 *                 value:
 *                   success: true
 *                   message: My jobs retrieved successfully.
 *                   data:
 *                       - id: 9c4e6a8b-3c4d-4e5f-9a01-2b3c4d5e6f70
 *                         jobRef: JOB-9D1E
 *                         title: Rewiring
 *                         status: CANCELLED
 *                         statusLabel: Cancelled
 *                         date: September 28, 2026
 *                         dateAt: '2026-09-28T11:02:00.000Z'
 *                         provider: null
 *                         amount: 50
 *                         amountType: Refunded
 *                         currencyCode: EUR
 *                         currencySymbol: €
 *                         downloadUrl: null
 *                   meta: { total: 1, page: 1, limit: 20, totalPages: 1 }
 */
router.get('/mine', ...customerOnly, validate(myJobsTabQuerySchema), controller.listMyJobsByTab);

/**
 * @swagger
 * /jobs/{id}/invoice/download:
 *   get:
 *     summary: Download job invoice PDF (My Jobs downloadUrl)
 *     tags: ['Customer / My Job', 'Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: Returns `application/pdf` once the trader has finished the job. Same invoice as the trader copy.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: PDF file.
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       400:
 *         description: Job not finished yet.
 *       404:
 *         description: Job not found.
 */
router.get('/:id/invoice/download', ...customerOnly, validate(jobIdParamSchema), controller.downloadJobInvoice);

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

/**
 * @swagger
 * /jobs/{id}/details:
 *   get:
 *     summary: Job Details screen (compact — any status)
 *     description: |
 *       Small payload for the customer **Job Details** screen. Works for any status (active, completed, cancelled).
 *       `GET /jobs/{id}` stays the full job object (create / edit / publish flows); `/completed` and `/cancelled`
 *       stay the full history screens.
 *       - `status` UPPERCASE without `_` (e.g. `COMPLETED`, `IN PROGRESS`), `statusLabel` display badge.
 *       - `date` / `dateAt` — booked appointment (`dateAt` + `timeSlot` text).
 *       - `provider` — booked trader (null until a trader is confirmed); `role` = job service (subcategory / category).
 *       - `paymentDetails.discount` is negative (offer / promo); `paymentMethod` = latest card used (null if none).
 *       - `downloadUrl` — invoice PDF once the trader finished the job; `receiptUrl` — card receipt.
 *     tags: ['Customer / My Job']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job details.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job details fetched successfully.
 *               data:
 *                 jobId: 89d85512-3ff7-4fc7-a44a-2e594130d71c
 *                 jobRef: '#JOB-1EA2'
 *                 title: Fixing loose kitchen cabinet hinges
 *                 description: Fixing loose kitchen cabinet hinges and repairing a squeaky bedroom door frame.
 *                 status: COMPLETED
 *                 statusLabel: Completed
 *                 date: 'Oct 24, 2:00 PM - 4:00 PM'
 *                 dateAt: '2026-10-24T00:00:00.000Z'
 *                 estimatedDuration: 2-3 hours
 *                 category: Handyman / Carpentry
 *                 mediaUrls: ['https://api.brisk.ie/uploads/files/job_photo/99a96a2f-bd59-4dbd-ba1a-e5f04412946d/hinge.jpg']
 *                 provider:
 *                   id: adabc55c-6d7d-4b12-8597-6d26366c26bf
 *                   name: Alex Carpentry
 *                   role: Carpentry
 *                   profilePhotoUrl: https://api.brisk.ie/uploads/files/profile_photo/alex.jpg
 *                   rating: 4.9
 *                   reviewsCount: 124
 *                   isVerified: true
 *                 serviceAddress:
 *                   address: 14 Oak Street, Dublin
 *                   lat: 53.3498
 *                   lng: -6.2603
 *                   mapImageUrl: null
 *                 paymentDetails:
 *                   serviceFee: 120
 *                   processingFee: 5
 *                   discount: -5
 *                   vatAmount: 0
 *                   totalPaid: 120
 *                   amountDue: 0
 *                   currencyCode: EUR
 *                   currencySymbol: €
 *                   paymentStatus: PAID
 *                   paymentMethod: Visa ending in •••• 4242
 *                 downloadUrl: /jobs/89d85512-3ff7-4fc7-a44a-2e594130d71c/invoice/download
 *                 receiptUrl: /payments/7c3d4e5f-0000-4000-8000-000000000004/receipt
 *                 canReview: true
 *       404:
 *         description: Job not found.
 */
router.get('/:id/details', ...customerOnly, validate(jobIdParamSchema), controller.getJobDetailsSummary);

/**
 * @swagger
 * /jobs/{id}/completed:
 *   get:
 *     summary: Completed Job Details — completion, work photos, address, payment breakdown
 *     tags: ['Customer / My Job', 'Customer / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       For a job the trader has finished (`COMPLETED`, or `PAYMENT PENDING` while the final payment is due).
 *
 *       - `completedAt` / `formattedCompletedDate` = when the trader finished; `startedAt` = arrival;
 *         `durationMinutes` = real time on site; `estimatedDuration` = customer estimate from Post Job.
 *       - `completionPhotos` = work-proof photos uploaded by the trader.
 *       - `paymentSummary` comes from the real invoice + trader payment requests:
 *         `serviceFee`, `processingFee`, `discount`, `vatPercentage`, `vatAmount`, `totalPaid`, `amountDue`,
 *         `paymentStatus` (`UNPAID` | `PENDING` | `PAID` | `REFUNDED` | `CANCELLED`), `currencyCode`, `currencySymbol`,
 *         `cardBrand`, `cardLast4` (latest card used).
 *         `baseRate` / `platformFee` / `offerApplied` / `netPayout` are legacy keys kept for older builds.
 *       - Invoice PDF: `downloadUrl` (= `GET /jobs/{id}/invoice/download`). Receipt JSON: `receiptUrl`
 *         (= `GET /payments/{paymentId}/receipt`, null until a card payment exists).
 *       - `canReview` = show the Rate & Review button (`POST /jobs/{id}/review`).
 *       - `canConfirmCompletion` / `completionConfirmedAt` = Confirm Completion button (`POST /jobs/{id}/confirm-completion`).
 *       - `review` = `{ rating, comment, createdAt }` once the customer rated the trader, else null.
 *       Status values never contain underscores.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Completed job details fetched successfully.
 *               data:
 *                 id: 89d85512-3ff7-4fc7-a44a-2e594130d71c
 *                 jobRef: '#JOB-1EA2'
 *                 title: Blocked kitchen drain
 *                 description: Kitchen sink drain is fully blocked and water is backing up.
 *                 category: DRAINAGE & SEWER UNBLOCKING
 *                 photos: ['https://api.brisk.ie/uploads/files/job_photo/99a96a2f-bd59-4dbd-ba1a-e5f04412946d/sink.jpg']
 *                 status: PAYMENT PENDING
 *                 statusBadge: Payment Pending
 *                 completedAt: '2026-10-05T13:30:23.583Z'
 *                 cancelledAt: null
 *                 cancellationReason: null
 *                 formattedCompletedDate: 'Finished on Oct 5, 2026 • 1:30 PM'
 *                 startedAt: '2026-10-05T12:45:10.517Z'
 *                 durationMinutes: 45
 *                 estimatedDuration: 1-2 hours
 *                 scheduledDate: '2026-10-24T00:00:00.000Z'
 *                 timeSlot: '2:00 PM - 4:00 PM'
 *                 address: { fullAddress: "1 O'Connell Street", city: Dublin, eircode: D01 F5P2, latitude: 53.3498, longitude: -6.2603, mapImageUrl: null }
 *                 trader: { id: adabc55c-6d7d-4b12-8597-6d26366c26bf, name: Brisk Trader, location: 'Dublin, Ireland', avatar: 'https://api.brisk.ie/uploads/files/profile_photo/2380d295-fef3-4365-bb81-1ecfb9b3ec8c/1789385663121-r131zvpo.jpg', rating: 4.9, reviewsCount: 124, isVerified: true, conversationId: 89d85512-3ff7-4fc7-a44a-2e594130d71c }
 *                 review: null
 *                 completionPhotos: ['https://api.brisk.ie/uploads/files/job_photo/99a96a2f-bd59-4dbd-ba1a-e5f04412946d/1788858205135-jv3bvmnx.jpg']
 *                 paymentSummary: { serviceFee: 150, processingFee: 10, discount: 0, vatPercentage: 20, vatAmount: 32, totalPaid: 0, amountDue: 192, paymentStatus: PENDING, currencyCode: EUR, currencySymbol: €, cardBrand: null, cardLast4: null, baseRate: 150, platformFee: 10, offerApplied: 0, netPayout: 192 }
 *                 invoiceId: null
 *                 invoiceNumber: null
 *                 downloadUrl: /jobs/89d85512-3ff7-4fc7-a44a-2e594130d71c/invoice/download
 *                 invoiceUrl: /jobs/89d85512-3ff7-4fc7-a44a-2e594130d71c/invoice/download
 *                 receiptUrl: null
 *                 canReview: true
 *                 completionConfirmedAt: null
 *                 canConfirmCompletion: true
 *       400: { description: Job is not completed. }
 *       404: { description: Job not found }
 */
router.get(
  '/:id/completed',
  ...customerOnly,
  validate(jobIdParamSchema),
  controller.getCompletedJobDetail
);

/**
 * @swagger
 * /jobs/{id}/cancelled:
 *   get:
 *     summary: Cancelled job detail (with cancellation reason)
 *     tags: ['Customer / My Job', 'Customer / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Same shape as `GET /jobs/{id}/completed`. `cancelledAt` and `cancellationReason` come from
 *       `POST /jobs/{id}/cancel` (`reason`). `paymentSummary` shows anything paid / refunded before cancelling.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Cancelled job details fetched successfully.
 *               data:
 *                 id: 3db751e8-7170-45f2-984a-cebbd9204549
 *                 jobRef: '#JOB-7C21'
 *                 title: Boiler not heating
 *                 category: BOILER & HEATING REPAIR
 *                 status: CANCELLED
 *                 statusBadge: Cancelled
 *                 completedAt: null
 *                 cancelledAt: '2026-10-05T13:30:24.410Z'
 *                 cancellationReason: Found another trader
 *                 formattedCompletedDate: 'Cancelled on Oct 5, 2026 • 1:30 PM'
 *                 startedAt: null
 *                 durationMinutes: null
 *                 estimatedDuration: null
 *                 address: { fullAddress: "1 O'Connell Street", city: Dublin, eircode: D01 F5P2, latitude: 53.3498, longitude: -6.2603 }
 *                 trader: null
 *                 review: null
 *                 completionPhotos: []
 *                 paymentSummary: { serviceFee: 0, processingFee: 0, discount: 0, vatPercentage: 0, vatAmount: 0, totalPaid: 0, amountDue: 0, paymentStatus: UNPAID, cardBrand: null, cardLast4: null, baseRate: 0, platformFee: 0, offerApplied: 0, netPayout: 0 }
 *                 invoiceId: null
 *                 invoiceNumber: null
 *                 downloadUrl: null
 *                 invoiceUrl: null
 *                 receiptUrl: null
 *                 canReview: false
 *                 completionConfirmedAt: null
 *                 canConfirmCompletion: false
 *       400: { description: Job is not cancelled. }
 *       404: { description: Job not found }
 */
router.get(
  '/:id/cancelled',
  ...customerOnly,
  validate(jobIdParamSchema),
  controller.getCancelledJobDetail
);
router.patch('/:id', ...customerOnly, validate(updateJobSchema), controller.updateJob);

/**
 * @swagger
 * /jobs/{id}/location:
 *   put:
 *     summary: Select Location — attach saved address OR inline map-search place
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Select Location (saved Home / Work / Other **or** map search).
 *
 *       **Auth:** Customer Bearer; job must belong to the customer.
 *
 *       **Request body — pick one:**
 *       1. `{ "addressId": "<uuid>" }` — from `GET /addresses`
 *       2. `{ "location": { addressLine1, city, lat, lng, ... } }` — map search (no saved id yet);
 *          backend **creates** Address then attaches to job
 *       3. `{ "address": { ... } }` — same as `location` (alias)
 *
 *       **Note:** You can skip this call and pass the same fields on `POST /jobs/{id}/publish` instead.
 *
 *       Copies address line, city, eircode, lat/lng onto the job.
 *       After success, `nextSteps.canPublish=true` when status is DRAFT.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Job UUID from `POST /jobs` response (`data.id`).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SetJobLocationRequest'
 *           examples:
 *             savedAddress:
 *               summary: Existing saved addressId
 *               value:
 *                 addressId: e60ca842-e86a-4825-abcf-2e79a9ff8e4d
 *             mapSearch:
 *               summary: Map search — no addressId (backend creates address)
 *               value:
 *                 location:
 *                   label: Grafton Street
 *                   addressLine1: 12 Grafton Street
 *                   city: Dublin
 *                   county: Dublin
 *                   eircode: D02 XY45
 *                   country: Ireland
 *                   latitude: 53.342
 *                   longitude: -6.259
 *     responses:
 *       200:
 *         description: Job with address fields set; `nextSteps` updated. Response includes new `addressId` when created from location.
 *       400:
 *         description: Missing addressId/location, or job not editable.
 *       404:
 *         description: Job or address not found (addressId must belong to the customer).
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
 *     summary: Publish Job Post → invoice when pay needed (offer claimed only after payment)
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile CTA:** Select address → **Next** calls this once.
 *       Separate `PUT /jobs/{id}/location` is **optional** (not required).
 *       Name is “publish” but job is **not live** until payment succeeds.
 *
 *       **Auth:** Customer Bearer; job must be DRAFT or unpaid `PAYMENT_PENDING`.
 *
 *       **Body options (pick one):**
 *       1. `{ "addressId": "<uuid>" }` — saved address from GET /addresses
 *       2. `{ "address": { addressLine1, city, latitude, longitude, ... } }` — map search (no addressId yet);
 *          backend **creates** the address, attaches it to the job, then publishes
 *       3. `{ "location": { ... } }` — same as `address` (alias)
 *       4. `{}` — only if job already has addressId
 *
 *       **Requirements:**
 *       - One of the address options above
 *       - Site Visit (`quoteType=ONSITE`): **traderId required**; charges `siteVisitFee`
 *       - Direct Trader SERVICE path: `serviceCharge` or `maxBudget` if not site visit
 *
 *       **Status:** pay path → `PAYMENT_PENDING` + unpaid invoice. Job → `SCHEDULED`
 *       only on payment confirm. No-pay path → `PUBLISHED`.
 *
 *       **Back + change address:** call publish again with new `addressId` **or** new
 *       `address`/`location` while unpaid — address updates, **same** `invoiceId` returned.
 *
 *       **Invoice id for Payment Details:** use `data.invoiceId` or `data.invoice.id`
 *       (also on `data.job.invoiceId` / `data.job.nextSteps.invoiceId`).
 *
 *       **Next:** `GET /invoices/{invoiceId}` optional reload → pay intent → confirm.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Draft job UUID to publish.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PublishJobRequest'
 *           examples:
 *             savedAddressId:
 *               summary: "1) Saved addressId"
 *               value:
 *                 addressId: e60ca842-e86a-4825-abcf-2e79a9ff8e4d
 *             mapSearchLocation:
 *               summary: "2) Map search — location object (no addressId)"
 *               value:
 *                 location:
 *                   label: Grafton Street
 *                   addressLine1: 12 Grafton Street
 *                   city: Dublin
 *                   county: Dublin
 *                   eircode: D02 XY45
 *                   country: Ireland
 *                   latitude: 53.342
 *                   longitude: -6.259
 *             mapSearchAddress:
 *               summary: "2b) Map search — address object (alias of location)"
 *               value:
 *                 address:
 *                   label: Grafton Street
 *                   addressLine1: 12 Grafton Street
 *                   city: Dublin
 *                   county: Dublin
 *                   eircode: D02 XY45
 *                   country: Ireland
 *                   latitude: 53.342
 *                   longitude: -6.259
 *             changeAddressWhileUnpaid:
 *               summary: "3) Unpaid — change address, same invoiceId"
 *               value:
 *                 addressId: 6bfdd798-371f-4342-a4cd-c874a7392730
 *             alreadyHasAddress:
 *               summary: "4) Job already has addressId"
 *               value: {}
 *     responses:
 *       200:
 *         description: |
 *           `data.invoiceId` + `data.invoice` (Payment Details). Job status `PAYMENT_PENDING` when pay needed.
 *           Navigate with `data.invoiceId`.
 *       400:
 *         description: Not DRAFT, missing address, missing trader for site visit, or missing fee/charge.
 *       404:
 *         description: Job or address not found.
 *       409:
 *         description: Offer already USED.
 */
router.post(
  '/:id/publish',
  ...customerOnly,
  validate(publishJobSchema),
  controller.publishJob
);

/**
 * @swagger
 * /jobs/{id}/quotes:
 *   get:
 *     summary: Quotations received for my job (compare traders)
 *     tags: ['Customer / My Job', 'Customer / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       All trader quotations for the job, newest request first. Accept one with
 *       `POST /jobs/{id}/quotes/{quoteId}/accept` when `canAccept=true`.
 *
 *       `selectionStatus`: `PENDING` | `AWAITING TRADER CONFIRMATION` (you accepted, trader has not
 *       confirmed yet) | `CONFIRMED` (trader assigned) | `REJECTED` | `EXPIRED`.
 *       Status values never contain underscores (`jobStatus` e.g. `IN PROGRESS`).
 *
 *       `job` = summary for the screen header: id, jobRef, title, description, status, category, subcategory.
 *       Open one quote (trader profile + reviews) with `GET /jobs/{id}/quotes/{quoteId}`.
 *
 *       Realtime (customer room): `quote:received` when a trader quotes, `job:declined` when the
 *       selected trader declines, `job:status_changed` when the trader confirms.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: |
 *           `jobId`, `jobStatus`, `assignedTraderId`, `awaitingTraderConfirmation`, `job{}`, `quotes[]`
 *           (id/quoteId, amount, currencyCode, currencySymbol, notes (= trader message), estimatedDays, status,
 *           selectionStatus, canAccept, requestedAt, createdAt, trader{id, displayName, fullName, profilePhotoUrl,
 *           avgRating, reviewsCount, topRated, isVerified, yearsExperience, city}).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Quotations fetched successfully.
 *               data:
 *                 jobId: 89d85512-3ff7-4fc7-a44a-2e594130d71c
 *                 jobStatus: PUBLISHED
 *                 assignedTraderId: null
 *                 awaitingTraderConfirmation: false
 *                 job:
 *                   id: 89d85512-3ff7-4fc7-a44a-2e594130d71c
 *                   jobRef: JOB-1EA2
 *                   title: Blocked kitchen drain
 *                   description: Kitchen sink drain is fully blocked.
 *                   status: PUBLISHED
 *                   category: { id: 3f0f23dd-dfa2-4606-9eed-acdc22534f0f, name: Plumbing Services }
 *                   subcategory: { id: ef44f8c8-bed2-43e7-b12b-f3d1357f5926, name: Drainage & Sewer Unblocking }
 *                 quotes:
 *                   - id: c631f7cc-c964-4cfa-8617-3f3d5b660055
 *                     quoteId: c631f7cc-c964-4cfa-8617-3f3d5b660055
 *                     jobId: 89d85512-3ff7-4fc7-a44a-2e594130d71c
 *                     amount: 150
 *                     currencyCode: EUR
 *                     currencySymbol: €
 *                     notes: Can unblock the drain tomorrow morning.
 *                     estimatedDays: null
 *                     status: PENDING
 *                     selectionStatus: PENDING
 *                     canAccept: true
 *                     requestedAt: null
 *                     createdAt: '2026-10-05T13:30:23.247Z'
 *                     trader:
 *                       id: adabc55c-6d7d-4b12-8597-6d26366c26bf
 *                       displayName: Brisk Trader
 *                       fullName: Brisk Trader
 *                       profilePhotoUrl: 'https://api.brisk.ie/uploads/files/profile_photo/2380d295-fef3-4365-bb81-1ecfb9b3ec8c/1789385663121-r131zvpo.jpg'
 *                       avgRating: 4.75
 *                       reviewsCount: 4
 *                       topRated: false
 *                       isVerified: true
 *                       yearsExperience: 1
 *                       city: Dublin
 *       404:
 *         description: Job not found
 */
router.get('/:id/quotes', ...customerOnly, validate(jobIdParamSchema), controller.listJobQuotes);

/**
 * @swagger
 * /jobs/{id}/quotes/{quoteId}/accept:
 *   post:
 *     summary: Accept trader quotation (customer) — trader must then confirm
 *     tags: ['Customer / My Job', 'Customer / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Marks the quote ACCEPTED and sends `job:accept` to that trader (bottom sheet with
 *       View & Accept / Decline). The job stays open (`status` PUBLISHED, not assigned) until the
 *       trader taps View & Accept → then trader is assigned, booking created, other quotes
 *       rejected, job ACCEPTED/SCHEDULED (`job:status_changed`).
 *
 *       Accepting a different quote before the trader confirms moves the selection to that
 *       trader (previous trader receives `job:accept_cancelled`). If the trader declines, the
 *       customer gets `job:declined` and can accept another quote.
 *
 *       **Realtime / inbox**
 *       | Who | Socket event | Inbox type |
 *       |---|---|---|
 *       | Selected trader | `job:accept` (sheet payload) | `QUOTE_ACCEPTED` |
 *       | Previously selected trader | `job:accept_cancelled` | `QUOTE_SELECTION_CANCELLED` |
 *       | Customer (trader confirms) | `job:status_changed` | `JOB_STATUS_CHANGED` |
 *       | Customer (trader declines) | `job:declined` | `JOB_DECLINED` |
 *
 *       Trader endpoints: `POST /traders/jobs/incoming/{jobId}/accept` · `/decline`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: quoteId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quotation accepted — waiting for the trader to confirm.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Quotation accepted. Waiting for the trader to confirm.
 *               data:
 *                 jobId: 0100839a-7364-4d00-9323-a2b6e44d81bc
 *                 traderId: d920daf6-0a24-4afc-a698-7df83602387a
 *                 quoteId: 6c6f92ce-1da9-401b-8722-95ccac9f8dd2
 *                 status: PUBLISHED
 *                 assignmentStatus: AWAITING TRADER CONFIRMATION
 *                 amount: 120
 *       400:
 *         description: Job is not open (e.g. cancelled / completed).
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: Job is not open for trader confirmation.
 *       404:
 *         description: Job not found, or quote not found / rejected (trader declined) / expired.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: Quote not found or no longer available.
 *       409:
 *         description: A trader already confirmed this job.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: A trader is already confirmed for this job.
 */
router.post(
  '/:id/quotes/:quoteId/accept',
  ...customerOnly,
  validate(acceptJobQuoteSchema),
  controller.acceptJobQuote
);

/**
 * @swagger
 * /jobs/{id}/cancel:
 *   post:
 *     summary: Cancel a job (customer)
 *     tags: ['Customer / My Job', 'Customer / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Sets `status=CANCELLED` (and booking if present), saves the optional `reason`, and cancels
 *       any unpaid trader payment requests. Response includes `statusBadge: "Cancelled"`.
 *       Not allowed once the trader finished the work, or after any successful payment (contact support).
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
 *               reason: { type: string, maxLength: 1000, example: Found another provider }
 *     responses:
 *       200:
 *         description: Job cancelled — `data` is the job detail (same as `GET /jobs/{id}`). Details screen → `GET /jobs/{id}/cancelled`.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job cancelled successfully.
 *               data: { id: 3db751e8-7170-45f2-984a-cebbd9204549, jobRef: JOB-7C21, title: Boiler not heating, status: CANCELLED, statusBadge: Cancelled }
 *       400:
 *         description: |
 *           `Finished jobs cannot be cancelled. Use Report an Issue instead.` ·
 *           `Paid jobs cannot be cancelled here. Contact support for refunds.` ·
 *           `Jobs with a completed payment cannot be cancelled here. Contact support for refunds.`
 *       409:
 *         description: Job is already cancelled.
 */
router.post('/:id/cancel', ...customerOnly, validate(cancelJobSchema), controller.cancelJob);

/**
 * @swagger
 * /jobs/{id}/quotes/{quoteId}:
 *   get:
 *     summary: Quotation detail + trader profile & recent reviews (Trader Profile & Quote screen)
 *     tags: ['Customer / My Job']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Accept with `POST /jobs/{id}/quotes/{quoteId}/accept` when `canAccept=true`.
 *       Accepting does **not** create the booking yet — the trader confirms first (`selectionStatus`
 *       becomes `AWAITING TRADER CONFIRMATION`, then `CONFIRMED`). Then use `GET /jobs/{id}/progress`.
 *       `trader.jobsCompleted` / `avgRating` / `reviewsCount` come from real bookings and reviews.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: quoteId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: reviewsLimit, schema: { type: integer, default: 10, maximum: 50 }, description: Latest reviews to include }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Quotation retrieved successfully.
 *               data:
 *                 quoteId: 3142870e-5caa-43fd-86d7-5d617b3eabb4
 *                 jobId: b8499d07-e1c9-4009-b774-82d6690e015b
 *                 jobRef: JOB-FC79
 *                 jobTitle: Kitchen tap leaking
 *                 jobStatus: PUBLISHED
 *                 amount: 120
 *                 currencyCode: EUR
 *                 currencySymbol: €
 *                 notes: Can replace the cartridge or fit a new mixer tap.
 *                 estimatedDays: null
 *                 status: PENDING
 *                 selectionStatus: PENDING
 *                 canAccept: true
 *                 requestedAt: null
 *                 createdAt: '2026-10-05T12:20:11.000Z'
 *                 trader:
 *                   id: adabc55c-6d7d-4b12-8597-6d26366c26bf
 *                   displayName: Brisk Trader
 *                   fullName: Brisk Trader
 *                   businessName: Brisk Trader
 *                   traderType: SOLO
 *                   profilePhotoUrl: null
 *                   coverImageUrl: null
 *                   bio: Licensed plumber with 10 years experience.
 *                   location: Palanpur, Gujarat, India
 *                   yearsExperience: 10
 *                   avgRating: 4.5
 *                   reviewsCount: 2
 *                   jobsCompleted: 8
 *                   isTopRated: false
 *                   isVerified: true
 *                   badges: [VERIFIED]
 *                   categories: [{ id: 3f0f23dd-dfa2-4606-9eed-acdc22534f0f, name: Plumbing Services }]
 *                   memberSince: '2026-09-12T09:30:00.000Z'
 *                 reviews:
 *                   - { id: 0b1c2d3e-0000-4000-8000-000000000001, rating: 5, review: Great work, createdAt: '2026-10-02T10:15:00.000Z', date: 'October 2, 2026', customerName: Sarah C., customerPhotoUrl: null }
 *       404: { description: Job or quotation not found }
 */
router.get('/:id/quotes/:quoteId', ...customerOnly, validate(jobQuoteDetailSchema), controller.getJobQuoteDetail);

/**
 * @swagger
 * /jobs/{id}/progress:
 *   get:
 *     summary: Booking Confirmed & Details — job progress tracking with milestones
 *     tags: ['Customer / My Job']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Use the `id` from My Jobs (`GET /jobs/mine`). Works before and after the booking exists
 *       (`bookingId` null until the trader confirms).
 *
 *       `status` = job status without underscores: `PUBLISHED`, `QUOTED`, `ACCEPTED`, `SCHEDULED`,
 *       `IN PROGRESS` (trader arrived), `PAYMENT PENDING`, `COMPLETED`, `CANCELLED`.
 *
 *       `milestones[]` (in order, real timestamps): `QUOTE ACCEPTED` → `BOOKING CONFIRMED` → `TRADER ARRIVED`
 *       → `WORK COMPLETED` → `COMPLETION CONFIRMED` (customer `POST /jobs/{id}/confirm-completion`) → `PAYMENT COMPLETED`. Each has `title`, `subtitle` (date/time or empty),
 *       `status` = `COMPLETED` | `CURRENT` | `PENDING` | `CANCELLED`. `PAYMENT COMPLETED` is COMPLETED only when money was actually received.
 *
 *       `isPartPayment` = true when the trader sent any installment (PARTIAL) payment request — route Pay
 *       to the Installment Payments screen (`GET /jobs/{id}/payment-requests`); false → normal payment flow.
 *       `trader.phone` is shared only once a booking exists. `actions` tell which buttons to show
 *       (cancel, reschedule, review, report issue).
 *
 *       `review` = `{ rating, review, createdAt }` after the customer rated the trader, else null.
 *       `downloadUrl` (invoice PDF) is set once the trader finished the work.
 *
 *       **One API for every state** (active, completed, cancelled) — same shape; drive the banner from
 *       `status` / `statusLabel`. When cancelled, `milestones` gets one `JOB CANCELLED` step (status
 *       `CANCELLED`, `at` = cancelledAt) right after the last completed step; remaining steps are `PENDING`.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job progress retrieved successfully.
 *               data:
 *                 jobId: b8499d07-e1c9-4009-b774-82d6690e015b
 *                 jobRef: JOB-FC79
 *                 bookingId: 5a6b7c8d-0000-4000-8000-000000000002
 *                 bookingRef: BKG-1A2B
 *                 title: Kitchen tap leaking
 *                 description: Mixer tap in the kitchen keeps dripping.
 *                 status: SCHEDULED
 *                 statusLabel: Active
 *                 category: { id: 3f0f23dd-dfa2-4606-9eed-acdc22534f0f, name: Plumbing Services }
 *                 subcategory: { id: ef44f8c8-bed2-43e7-b12b-f3d1357f5926, name: Drainage & Sewer Unblocking }
 *                 scheduledDate: '2026-10-06T00:00:00.000Z'
 *                 date: October 6, 2026
 *                 timeSlot: MORNING
 *                 address: { fullAddress: 'Palanpur, Gujarat', city: Palanpur, eircode: null, latitude: 24.17, longitude: 72.43 }
 *                 trader: { id: adabc55c-6d7d-4b12-8597-6d26366c26bf, name: Brisk Trader, profilePhotoUrl: null, phone: '+353861234567', avgRating: 4.5, reviewsCount: 2, isTopRated: false }
 *                 milestones:
 *                   - { key: QUOTE ACCEPTED, title: Quote Accepted, subtitle: 'October 5, 2026 at 12:20 PM', status: COMPLETED, at: '2026-10-05T12:20:00.000Z' }
 *                   - { key: BOOKING CONFIRMED, title: Booking Confirmed, subtitle: 'October 5, 2026 at 12:21 PM', status: COMPLETED, at: '2026-10-05T12:21:00.000Z' }
 *                   - { key: TRADER ARRIVED, title: Trader Arrived, subtitle: '', status: CURRENT, at: null }
 *                   - { key: WORK COMPLETED, title: Work Completed, subtitle: '', status: PENDING, at: null }
 *                   - { key: COMPLETION CONFIRMED, title: Completion Confirmed, subtitle: '', status: PENDING, at: null }
 *                   - { key: PAYMENT COMPLETED, title: Payment Completed, subtitle: '', status: PENDING, at: null }
 *                 isPartPayment: false
 *                 pricing: { amount: 120, amountType: Estimated, amountDue: 0, totalPaid: 0, refunded: 0, invoiceId: null, paymentRequestId: null, currencyCode: EUR, currencySymbol: € }
 *                 review: null
 *                 completionConfirmedAt: null
 *                 cancellationReason: null
 *                 cancelledAt: null
 *                 downloadUrl: null
 *                 actions: { canConfirmCompletion: false, canCancel: true, canReschedule: true, canReview: false, canReportIssue: true, hasActiveDispute: false }
 *       404: { description: Job not found }
 */
router.get('/:id/progress', ...customerOnly, validate(jobIdParamSchema), controller.getJobProgress);

/**
 * @swagger
 * /jobs/{id}/reschedule:
 *   post:
 *     summary: Reschedule job to a new date / time slot
 *     tags: ['Customer / My Job']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Allowed while the job is PUBLISHED / QUOTED / ACCEPTED / SCHEDULED and the trader has not arrived.
 *       Updates the job and booking date and notifies the assigned trader (`JOB_RESCHEDULED`).
 *       `serviceCategoryId` / `serviceSubcategoryId` can change only before any quotation is received.
 *       Returns the same payload as `GET /jobs/{id}/progress`.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, timeSlot]
 *             properties:
 *               date: { type: string, example: '2026-10-08', description: YYYY-MM-DD (today or later) }
 *               timeSlot: { type: string, example: MORNING, description: 'MORNING | AFTERNOON | EVENING or a time like 14:30' }
 *               serviceCategoryId: { type: string, format: uuid }
 *               serviceSubcategoryId: { type: string, format: uuid, nullable: true }
 *     responses:
 *       200:
 *         description: Rescheduled — `data` is the full `GET /jobs/{id}/progress` payload (new `date`, `timeSlot`, `scheduledDate`).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job rescheduled successfully.
 *               data: { jobId: 89d85512-3ff7-4fc7-a44a-2e594130d71c, jobRef: JOB-1EA2, bookingId: 5a6b7c8d-0000-4000-8000-000000000002, status: SCHEDULED, scheduledDate: '2026-10-10T00:00:00.000Z', date: 'October 10, 2026', timeSlot: AFTERNOON, milestones: [], actions: { canCancel: true, canReschedule: true, canReview: false, canReportIssue: true, hasActiveDispute: false } }
 *       400:
 *         description: |
 *           `Please choose today or a future date.` ·
 *           `The trader has already started this job, so it can no longer be rescheduled.` ·
 *           `Cancelled jobs cannot be rescheduled.` ·
 *           `The service cannot be changed after quotations are received. Only the date and time can be rescheduled.`
 *       404: { description: Job not found }
 */
router.post('/:id/reschedule', ...customerOnly, validate(rescheduleJobSchema), controller.rescheduleJob);

/**
 * @swagger
 * /jobs/{id}/review:
 *   post:
 *     summary: Rate & review the trader for a finished job
 *     tags: ['Customer / My Job']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       One review per job, after the trader marked the work finished. Updates the trader's `avgRating`
 *       and notifies the trader (`NEW_REVIEW`). `traderId` in the body is optional/ignored — the job's booked trader is used.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5, example: 5 }
 *               review: { type: string, example: Quick and tidy work, highly recommended. }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Thank you! Your review has been submitted.
 *               data: { reviewId: 0b1c2d3e-0000-4000-8000-000000000001, jobId: b8499d07-e1c9-4009-b774-82d6690e015b, rating: 5, review: Quick and tidy work, createdAt: '2026-10-05T13:30:23.842Z', trader: { id: adabc55c-6d7d-4b12-8597-6d26366c26bf, avgRating: 4.67, reviewsCount: 3 } }
 *       400: { description: Job not finished, cancelled, or no booked trader }
 *       409: { description: Already reviewed }
 */
router.post('/:id/review', ...customerOnly, validate(jobReviewSchema), controller.submitJobReview);

/**
 * @swagger
 * /jobs/{id}/confirm-completion:
 *   post:
 *     summary: Confirm Completion — customer confirms the trader's finished work
 *     tags: ['Customer / My Job']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Allowed once the trader marked the work finished (`actions.canConfirmCompletion` on
 *       `GET /jobs/{id}/progress`, `canConfirmCompletion` on `GET /jobs/{id}/completed`).
 *       Saves `completionConfirmedAt`, marks the `COMPLETION CONFIRMED` milestone, notifies the trader
 *       (`JOB_COMPLETION_CONFIRMED`) and BRISK admin (payout can be released from escrow).
 *       Blocked while an issue (`OPEN` / `IN REVIEW` dispute) is open. Returns the `GET /jobs/{id}/progress` payload.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job completion confirmed. Thank you!
 *               data: { jobId: 89d85512-3ff7-4fc7-a44a-2e594130d71c, jobRef: JOB-1EA2, status: COMPLETED, completionConfirmedAt: '2026-10-06T09:12:00.000Z', milestones: [], actions: { canConfirmCompletion: false, canCancel: false, canReschedule: false, canReview: true, canReportIssue: true, hasActiveDispute: false } }
 *       400: { description: 'Work not finished yet, cancelled job, or no booked trader.' }
 *       404: { description: Job not found }
 *       409: { description: 'Already confirmed, or an issue is still open on this job.' }
 */
router.post('/:id/confirm-completion', ...customerOnly, validate(jobIdParamSchema), controller.confirmJobCompletion);

/**
 * @swagger
 * /jobs/{id}/disputes:
 *   post:
 *     summary: Report an issue / dispute for a job
 *     tags: ['Customer / My Job']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Allowed once a trader is assigned. One open issue per job (409 while `OPEN` / `IN REVIEW`).
 *       `reason` must be one of `reasons[].value` from `GET /jobs/{id}/disputes`.
 *       Upload evidence first with `POST /uploads` (purpose `job_photo`) and send up to 5 URLs. BRISK admins are notified.
 *       Dispute `status`: `OPEN` → `IN REVIEW` → `RESOLVED` | `REJECTED` (customer gets `DISPUTE_UPDATE`).
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason, description]
 *             properties:
 *               reason: { type: string, enum: [Poor Quality of Work, Incomplete Job, Overcharging, No-show / Delay, Other] }
 *               description: { type: string, example: The tap is still leaking after the repair. }
 *               evidenceUrls: { type: array, maxItems: 5, items: { type: string, format: uri } }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Dispute submitted successfully.
 *               data: { id: 6c7d8e9f-0000-4000-8000-000000000003, disputeId: 6c7d8e9f-0000-4000-8000-000000000003, disputeRef: DSP-4F2A1C, jobId: b8499d07-e1c9-4009-b774-82d6690e015b, jobRef: JOB-FC79, jobTitle: Kitchen tap leaking, reason: Incomplete Job, description: The tap is still leaking after the repair., evidenceUrls: [], status: OPEN, adminNote: null, resolvedAt: null, createdAt: '2026-10-05T13:30:23.884Z', updatedAt: '2026-10-05T13:30:23.884Z' }
 *       400: { description: No trader assigned yet }
 *       409: { description: An open issue already exists for this job }
 *   get:
 *     summary: Report an Issue screen — reasons dropdown + submitted issue (read-only state)
 *     tags: ['Customer / My Job']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Call when opening the Report an Issue / Dispute screen.
 *
 *       - `reasons[]` — dropdown options (send `value` as `reason` in POST).
 *       - `maxEvidencePhotos` — photo limit for Evidence Upload.
 *       - `isEditable: true` → nothing submitted yet: show the empty form (edits stay in the app until Submit).
 *       - `isSubmitted: true` → show `dispute` read-only with admin `status`
 *         (`OPEN` | `IN REVIEW` | `RESOLVED` | `REJECTED`), `adminNote`, `resolvedAt`.
 *       - `canSubmit` — POST allowed now (trader assigned and no `OPEN` / `IN REVIEW` issue).
 *       - `dispute` = latest issue (null when none); `disputes` = full history, newest first.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job disputes retrieved successfully.
 *               data:
 *                 reasons:
 *                   - { value: Poor Quality of Work, label: Poor Quality of Work }
 *                   - { value: Incomplete Job, label: Incomplete Job }
 *                   - { value: Overcharging, label: Overcharging }
 *                   - { value: No-show / Delay, label: No-show / Delay }
 *                   - { value: Other, label: Other }
 *                 maxEvidencePhotos: 5
 *                 isSubmitted: true
 *                 isEditable: false
 *                 canSubmit: false
 *                 dispute: { id: 5019a717-e351-41aa-ae7a-1bc539d05f69, disputeId: 5019a717-e351-41aa-ae7a-1bc539d05f69, disputeRef: DSP-E005ED, jobId: 89d85512-3ff7-4fc7-a44a-2e594130d71c, jobRef: JOB-1EA2, jobTitle: Blocked kitchen drain, reason: Poor Quality of Work, description: Drain blocked again next day., evidenceUrls: [], status: IN REVIEW, adminNote: Checking with trader., resolvedAt: null, createdAt: '2026-10-05T13:30:23.884Z', updatedAt: '2026-10-05T13:31:02.120Z' }
 *                 disputes:
 *                   - { id: 5019a717-e351-41aa-ae7a-1bc539d05f69, disputeId: 5019a717-e351-41aa-ae7a-1bc539d05f69, disputeRef: DSP-E005ED, jobId: 89d85512-3ff7-4fc7-a44a-2e594130d71c, jobRef: JOB-1EA2, jobTitle: Blocked kitchen drain, reason: Poor Quality of Work, description: Drain blocked again next day., evidenceUrls: [], status: IN REVIEW, adminNote: Checking with trader., resolvedAt: null, createdAt: '2026-10-05T13:30:23.884Z', updatedAt: '2026-10-05T13:31:02.120Z' }
 *       404: { description: Job not found }
 */
router.post('/:id/disputes', ...customerOnly, validate(createJobDisputeSchema), controller.createJobDispute);
router.get('/:id/disputes', ...customerOnly, validate(jobIdParamSchema), controller.listJobDisputes);

/**
 * @swagger
 * /jobs/{id}/site-visits/{requestId}/confirm:
 *   post:
 *     summary: Confirm a trader site-visit proposal (customer)
 *     tags: ['Customer / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       PENDING → CONFIRMED. Keeps `visitDate` / `timeSlot` as the confirmed schedule.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Site visit confirmed
 *       400:
 *         description: Not pending / missing date
 *       404:
 *         description: Proposal not found
 *       409:
 *         description: Already confirmed or completed
 */
router.post(
  '/:id/site-visits/:requestId/confirm',
  ...customerOnly,
  validate(siteVisitProposalParamSchema),
  controller.confirmSiteVisitProposal
);

/**
 * @swagger
 * /jobs/{id}/site-visits/{requestId}/reject:
 *   post:
 *     summary: Reject a trader site-visit proposal (customer)
 *     tags: ['Customer / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       PENDING → RESCHEDULE_REQUIRED.
 *       **Keeps** `visitDate` / `timeSlot` so trader Discover shows the rejected date
 *       as the current reschedule context before the trader picks a new date.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rejected — trader must propose a new date; rejected date preserved
 *       400:
 *         description: Not pending / confirmed cannot reject here
 *       404:
 *         description: Proposal not found
 *       409:
 *         description: Already requires reschedule or completed
 */
router.post(
  '/:id/site-visits/:requestId/reject',
  ...customerOnly,
  validate(siteVisitProposalParamSchema),
  controller.rejectSiteVisitProposal
);

export default router;
