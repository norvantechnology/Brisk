import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-jobs.controller';
import {
  adminDisputeIdParamSchema,
  adminDisputesListQuerySchema,
  adminUpdateDisputeSchema,
  adminJobChatQuerySchema,
  adminJobIdParamSchema,
  adminJobsListQuerySchema,
  adminJobsStatsQuerySchema,
  adminArchiveJobSchema,
  adminCancelJobSchema,
  adminRescheduleJobSchema,
} from './admin-jobs.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * tags:
 *   - name: 'Admin / Jobs'
 *     description: Global Jobs & Services screen — KPI cards, status tabs, filters, table, job drawer.
 *
 * components:
 *   parameters:
 *     AdminJobsSearch:
 *       in: query
 *       name: search
 *       description: Job ref, title, address/city/eircode, category, customer name/email/phone/code, trader name/business/code.
 *       schema: { type: string }
 *     AdminJobsStatus:
 *       in: query
 *       name: status
 *       description: |
 *         Multi-select — comma separated (`SCHEDULED,IN_PROGRESS`) or repeated. Labels:
 *         DRAFT Draft · PUBLISHED Awaiting Trader · QUOTED Quote Received · ACCEPTED Customer Accepted ·
 *         SCHEDULED Scheduled · IN_PROGRESS In Progress · COMPLETED Completed · CANCELLED Cancelled ·
 *         PAYMENT_PENDING Payment Pending.
 *       schema: { type: string, example: 'SCHEDULED,IN_PROGRESS' }
 *     AdminJobsCustomerId:
 *       in: query
 *       name: customerId
 *       schema: { type: string, format: uuid }
 *     AdminJobsTraderId:
 *       in: query
 *       name: traderId
 *       schema: { type: string, format: uuid }
 *     AdminJobsCategoryId:
 *       in: query
 *       name: categoryId
 *       schema: { type: string, format: uuid }
 *     AdminJobsPaymentStatus:
 *       in: query
 *       name: paymentStatus
 *       description: From the job invoice. `NOT_INVOICED` = no booking/invoice yet.
 *       schema: { type: string, enum: [NOT_INVOICED, UNPAID, PAID, REFUNDED] }
 *     AdminJobsOffer:
 *       in: query
 *       name: offer
 *       description: Offer / coupon applied — omit for All.
 *       schema: { type: string, enum: [APPLIED, NONE] }
 *     AdminJobsMinAmount:
 *       in: query
 *       name: minAmount
 *       description: Price range on `amount` (invoice total, else agreed service charge).
 *       schema: { type: number, example: 100 }
 *     AdminJobsMaxAmount:
 *       in: query
 *       name: maxAmount
 *       schema: { type: number, example: 500 }
 *     AdminJobsFrom:
 *       in: query
 *       name: from
 *       description: Job created from — `YYYY-MM-DD` (start of day UTC) or ISO datetime. Presets (Today, Last 7 Days…) = send from/to.
 *       schema: { type: string, example: '2026-09-01' }
 *     AdminJobsTo:
 *       in: query
 *       name: to
 *       description: Job created to — `YYYY-MM-DD` (end of day UTC) or ISO datetime.
 *       schema: { type: string, example: '2026-09-30' }
 *     AdminJobsArchived:
 *       in: query
 *       name: archived
 *       description: |
 *         List: omit/`false` = hide archived jobs (default) · `true` = archived only · `all` = both.
 *         Stats: omit = count all jobs (archived included) · `false` / `true` = filter.
 *       schema: { type: string, enum: ['false', 'true', all] }
 */

/**
 * @swagger
 * /admin/jobs/stats:
 *   get:
 *     summary: Jobs KPI cards + status tab counts
 *     description: |
 *       Accepts the same filters as `GET /admin/jobs` **except `status`**, so tab counts stay visible
 *       while a tab is selected.
 *
 *       Cards: `activeJobs` = ACCEPTED + SCHEDULED + IN_PROGRESS · `pendingJobs` = PUBLISHED + QUOTED.
 *       Tabs: render from `byStatus` (label + count per status).
 *     tags: ['Admin / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/AdminJobsSearch'
 *       - $ref: '#/components/parameters/AdminJobsCustomerId'
 *       - $ref: '#/components/parameters/AdminJobsTraderId'
 *       - $ref: '#/components/parameters/AdminJobsCategoryId'
 *       - $ref: '#/components/parameters/AdminJobsPaymentStatus'
 *       - $ref: '#/components/parameters/AdminJobsOffer'
 *       - $ref: '#/components/parameters/AdminJobsMinAmount'
 *       - $ref: '#/components/parameters/AdminJobsMaxAmount'
 *       - $ref: '#/components/parameters/AdminJobsFrom'
 *       - $ref: '#/components/parameters/AdminJobsTo'
 *       - $ref: '#/components/parameters/AdminJobsArchived'
 *     responses:
 *       200:
 *         description: Stats.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Jobs stats retrieved successfully.
 *               data:
 *                 totalJobs: 9
 *                 activeJobs: 1
 *                 pendingJobs: 1
 *                 completedJobs: 5
 *                 cancelledJobs: 2
 *                 paymentPendingJobs: 1
 *                 draftJobs: 0
 *                 byStatus:
 *                   - { status: PUBLISHED, label: Awaiting Trader, count: 1 }
 *                   - { status: COMPLETED, label: Completed, count: 5 }
 */
router.get('/jobs/stats', validate(adminJobsStatsQuerySchema), controller.getStats);

/**
 * @swagger
 * /admin/jobs:
 *   get:
 *     summary: List all jobs (Jobs & Services table) with filters
 *     description: |
 *       Row fields: `jobRef`, `title`, `category`, `offerApplied` (Offer badge), `customer` (name/phone),
 *       `trader` (+ `traderType` SOLO = Solo Professional, COMPANY = Company Partner), `city` / `postcode`,
 *       `scheduledDate` / `createdAt`, `amount` (invoice total, else agreed service charge),
 *       `estimatedAmount` (agreed service charge, "Est."), `paymentStatus`, `status` / `statusLabel`.
 *
 *       Row actions: details `GET /admin/jobs/{id}` · customer `GET /admin/customers/{customer.id}` ·
 *       trader `GET /admin/traders/{trader.id}` · chat `GET /admin/jobs/{id}/chat`.
 *     tags: ['Admin / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *       - $ref: '#/components/parameters/AdminJobsSearch'
 *       - $ref: '#/components/parameters/AdminJobsStatus'
 *       - $ref: '#/components/parameters/AdminJobsCustomerId'
 *       - $ref: '#/components/parameters/AdminJobsTraderId'
 *       - $ref: '#/components/parameters/AdminJobsCategoryId'
 *       - $ref: '#/components/parameters/AdminJobsPaymentStatus'
 *       - $ref: '#/components/parameters/AdminJobsOffer'
 *       - $ref: '#/components/parameters/AdminJobsMinAmount'
 *       - $ref: '#/components/parameters/AdminJobsMaxAmount'
 *       - $ref: '#/components/parameters/AdminJobsFrom'
 *       - $ref: '#/components/parameters/AdminJobsTo'
 *       - $ref: '#/components/parameters/AdminJobsArchived'
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, scheduledDate, status, title, amount], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated jobs (`meta.total`, `page`, `limit`, `totalPages`).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Jobs retrieved successfully.
 *               data:
 *                 - id: 1f2e3d4c-5b6a-4789-8abc-def012345678
 *                   jobRef: JOB-1042
 *                   title: Leakage & Sink Repair
 *                   status: COMPLETED
 *                   statusLabel: Completed
 *                   category: { id: 7c9e6679-7425-40de-944b-e07fc1f90ae7, name: Residential Plumbing }
 *                   subcategory: null
 *                   customer: { id: 99a96a2f-bd59-4dbd-ba1a-e5f04412946d, customerCode: CUS-1001, fullName: Sarah Connor, mobileNumber: '+353879123456', email: sarah@example.com, profilePhotoUrl: null }
 *                   trader: { id: 3033aa30-0000-4000-8000-000000000001, traderCode: TRD-1001, businessName: "Liam O'Connor Plumbing", traderType: COMPANY, fullName: "Liam O'Connor", profilePhotoUrl: null }
 *                   addressLine: 12 Main Street
 *                   city: Dublin
 *                   postcode: D02 X234
 *                   scheduledDate: '2026-07-29T00:00:00.000Z'
 *                   createdAt: '2026-07-20T10:00:00.000Z'
 *                   amount: 144
 *                   estimatedAmount: 140
 *                   currencyCode: EUR
 *                   paymentStatus: PAID
 *                   offerApplied: true
 *                   offer: { id: 5a1b2c3d-0000-4000-8000-000000000002, title: Summer Plumbing Offer, offerCode: OFF-10 }
 *                   quotesCount: 3
 *                   coverPhotoUrl: null
 *                   booking: { id: 6b2c3d4e-0000-4000-8000-000000000003, bookingRef: BK-1042, status: COMPLETED, invoiceId: 7c3d4e5f-0000-4000-8000-000000000004 }
 *               meta: { total: 9, page: 1, limit: 10, totalPages: 1 }
 *       400:
 *         description: Invalid filter (bad status, uuid, date, or minAmount > maxAmount).
 */
router.get('/jobs', validate(adminJobsListQuerySchema), controller.listJobs);

/**
 * @swagger
 * /admin/jobs/{id}:
 *   get:
 *     summary: Job detail (View Full Details drawer)
 *     description: |
 *       Same payload as `GET /admin/customers/{id}/jobs/{jobId}` plus `customer` and `statusLabel`:
 *       description, address, photos, offer, assigned trader, all quotes, booking, invoice breakdown, payments, rating.
 *
 *       Lifecycle: `cancellationReason`, `cancelledAt`, `archivedAt`; `booking.arrivedAt` (trader on site),
 *       `booking.finishedAt` (trader submitted work), `booking.customerConfirmedAt` (customer confirmed completion).
 *       `paymentRequests[]` — trader payment requests (`type` FULL JOB / SITE VISIT FEE / PARTIAL,
 *       `status` PENDING / SENT / PAID / CANCELLED, amounts, `paidAt`). `disputes[]` — customer reported issues
 *       (`status` OPEN / IN REVIEW / RESOLVED / REJECTED); manage via `PATCH /admin/disputes/{id}`.
 *     tags: ['Admin / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job detail.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Job detail retrieved successfully. }
 *                 data: { $ref: '#/components/schemas/AdminJobDetail' }
 *       404: { description: Job not found. }
 */
router.get('/jobs/:id', validate(adminJobIdParamSchema), controller.getJob);

/**
 * @swagger
 * /admin/jobs/{id}/cancel:
 *   post:
 *     summary: Cancel a job (admin)
 *     description: |
 *       Same rules as customer cancel (`POST /jobs/{id}/cancel`): not allowed when already cancelled,
 *       finished, or paid (refunds are handled separately). Pending payment requests are cancelled.
 *       Customer **and** trader get a "cancelled by BRISK support" notification. Written to audit log.
 *       Returns the updated job detail (same shape as `GET /admin/jobs/{id}`).
 *     tags: ['Admin / Jobs']
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
 *             required: [reason]
 *             properties:
 *               reason: { type: string, maxLength: 1000, example: Customer requested cancellation by phone. }
 *     responses:
 *       200: { description: 'Job cancelled — updated job detail (status CANCELLED, cancellationReason, cancelledAt).' }
 *       400: { description: Finished or paid job cannot be cancelled. }
 *       404: { description: Job not found. }
 *       409: { description: Job is already cancelled. }
 */
router.post('/jobs/:id/cancel', validate(adminCancelJobSchema), controller.cancelJob);

/**
 * @swagger
 * /admin/jobs/{id}/reschedule:
 *   post:
 *     summary: Reschedule a job (admin)
 *     description: |
 *       Same rules as customer reschedule (`POST /jobs/{id}/reschedule`): job must have a booked trader,
 *       not started/finished/cancelled, date not in the past. Customer **and** trader are notified
 *       ("BRISK support moved …"). Written to audit log. Returns the updated job detail.
 *     tags: ['Admin / Jobs']
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
 *             required: [date, timeSlot]
 *             properties:
 *               date: { type: string, example: '2026-10-12' }
 *               timeSlot: { type: string, example: '10:00 AM - 12:00 PM' }
 *     responses:
 *       200: { description: Job rescheduled — updated job detail. }
 *       400: { description: Job cannot be rescheduled (not booked, started, finished, or past date). }
 *       404: { description: Job not found. }
 */
router.post('/jobs/:id/reschedule', validate(adminRescheduleJobSchema), controller.rescheduleJob);

/**
 * @swagger
 * /admin/jobs/{id}/archive:
 *   patch:
 *     summary: Archive / unarchive a job (admin)
 *     description: |
 *       Only COMPLETED or CANCELLED jobs can be archived. Archived jobs are hidden from
 *       `GET /admin/jobs` and `/admin/jobs/stats` unless `archived=true` or `archived=all`.
 *       Customer/trader apps are not affected. Written to audit log. Returns the updated job detail (`archivedAt`).
 *     tags: ['Admin / Jobs']
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
 *             required: [archived]
 *             properties:
 *               archived: { type: boolean, example: true }
 *     responses:
 *       200: { description: Job archived / unarchived — updated job detail. }
 *       400: { description: Job is not completed or cancelled. }
 *       404: { description: Job not found. }
 */
router.patch('/jobs/:id/archive', validate(adminArchiveJobSchema), controller.setJobArchived);

/**
 * @swagger
 * /admin/jobs/{id}/chat:
 *   get:
 *     summary: Job chat / conversation history (Job Details page)
 *     description: |
 *       All messages on the job from the customer and every trader who chatted (assigned or not), oldest first (read-only for admin).
 *       Same shape as `GET /admin/customers/{id}/chats/{jobId}`. `isFromCustomer` = message sent by the job's customer.
 *       `traders` = every trader who sent a message on this job (latest first); match `messages[].sender.id` to `traders[].userId`.
 *       `job.trader` = currently assigned trader only (null until assigned).
 *     tags: ['Admin / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *     responses:
 *       200:
 *         description: Chat history.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job chat history retrieved successfully.
 *               data:
 *                 job:
 *                   id: 1f2e3d4c-5b6a-4789-8abc-def012345678
 *                   jobRef: JOB-411A
 *                   title: Boiler Repair
 *                   customer: { id: 99a96a2f-bd59-4dbd-ba1a-e5f04412946d, fullName: Sarah Connor, profilePhotoUrl: null }
 *                   trader: { id: 3033aa30-0000-4000-8000-000000000001, businessName: Wilson Electrics, userId: 4b1c2d3e-0000-4000-8000-000000000005, fullName: Mark Wilson, profilePhotoUrl: null }
 *                 traders:
 *                   - traderId: 3033aa30-0000-4000-8000-000000000001
 *                     userId: 4b1c2d3e-0000-4000-8000-000000000005
 *                     businessName: Wilson Electrics
 *                     fullName: Mark Wilson
 *                     profilePhotoUrl: null
 *                     isAssigned: true
 *                     messagesCount: 1
 *                     lastMessageAt: '2026-10-04T09:12:00.000Z'
 *                 meta: { total: 2, page: 1, limit: 10, totalPages: 1 }
 *                 messages:
 *                   - id: 5d6e7f80-0000-4000-8000-000000000006
 *                     message: Hi, I can come tomorrow at 10am.
 *                     sentAt: '2026-10-04T09:12:00.000Z'
 *                     sender: { id: 4b1c2d3e-0000-4000-8000-000000000005, fullName: Mark Wilson, role: TRADER, profilePhotoUrl: null }
 *                     isFromCustomer: false
 *                   - id: 6e7f8091-0000-4000-8000-000000000007
 *                     message: Perfect, see you then.
 *                     sentAt: '2026-10-04T09:15:00.000Z'
 *                     sender: { id: 99a96a2f-bd59-4dbd-ba1a-e5f04412946d, fullName: Sarah Connor, role: CUSTOMER, profilePhotoUrl: null }
 *                     isFromCustomer: true
 *       404: { description: Job not found. }
 */
router.get('/jobs/:id/chat', validate(adminJobChatQuerySchema), controller.getJobChat);

/**
 * @swagger
 * /admin/jobs/{id}/site-visits:
 *   get:
 *     summary: Traders who requested a site visit on this job
 *     description: Same item shape as `GET /admin/customers/{id}/jobs/{jobId}/site-visits`.
 *     tags: ['Admin / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Site visit requests for the job. }
 *       404: { description: Job not found. }
 */
router.get('/jobs/:id/site-visits', validate(adminJobIdParamSchema), controller.getJobSiteVisits);

/**
 * @swagger
 * /admin/disputes:
 *   get:
 *     summary: List customer-reported job disputes
 *     description: |
 *       Disputes created from the customer app (`POST /jobs/{id}/disputes`), newest first.
 *       `data.items[]` = disputes, `data.stats` = count per status (all four keys always present, ignores filters),
 *       `meta` = pagination. Status values have no underscores (`IN_REVIEW` in the query is accepted and treated as `IN REVIEW`).
 *     tags: ['Admin / Disputes']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string }, description: Dispute ref, job ref/title, customer or trader name }
 *       - { in: query, name: status, schema: { type: string, enum: [OPEN, IN REVIEW, RESOLVED, REJECTED] } }
 *       - { in: query, name: jobId, schema: { type: string, format: uuid } }
 *       - { in: query, name: customerId, schema: { type: string, format: uuid } }
 *       - { in: query, name: traderId, schema: { type: string, format: uuid } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Disputes retrieved successfully.
 *               data:
 *                 items:
 *                   - { id: 5019a717-e351-41aa-ae7a-1bc539d05f69, disputeRef: DSP-E005ED, reason: Poor Quality of Work, description: Drain blocked again next day., evidenceUrls: ['https://api.brisk.ie/uploads/files/job_photo/99a96a2f-bd59-4dbd-ba1a-e5f04412946d/1788858205135-jv3bvmnx.jpg'], status: OPEN, adminNote: null, resolvedAt: null, createdAt: '2026-10-05T13:30:23.884Z', updatedAt: '2026-10-05T13:30:23.884Z', job: { id: 89d85512-3ff7-4fc7-a44a-2e594130d71c, jobRef: JOB-1EA2, title: Blocked kitchen drain, status: PAYMENT PENDING, statusLabel: Payment Pending }, customer: { id: 99a96a2f-bd59-4dbd-ba1a-e5f04412946d, fullName: Brisk Customer, email: briskcustomer@gmail.com, mobileNumber: '+353871234567', profilePhotoUrl: null }, trader: { id: adabc55c-6d7d-4b12-8597-6d26366c26bf, traderCode: TRD-0001, businessName: Brisk Trader, fullName: Brisk Trader, profilePhotoUrl: null } }
 *                 stats: { OPEN: 1, IN REVIEW: 0, RESOLVED: 0, REJECTED: 0 }
 *               meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
 */
router.get('/disputes', validate(adminDisputesListQuerySchema), controller.listDisputes);

/**
 * @swagger
 * /admin/disputes/{id}:
 *   get:
 *     summary: Dispute detail
 *     description: One dispute with reason, description, evidence URLs, admin note, and the job / customer / trader it belongs to.
 *     tags: ['Admin / Disputes']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Dispute detail with job, customer and trader (same shape as a list item).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Dispute retrieved successfully.
 *               data: { id: 5019a717-e351-41aa-ae7a-1bc539d05f69, disputeRef: DSP-E005ED, reason: Poor Quality of Work, description: Drain blocked again next day., evidenceUrls: ['https://api.brisk.ie/uploads/files/job_photo/99a96a2f-bd59-4dbd-ba1a-e5f04412946d/1788858205135-jv3bvmnx.jpg'], status: OPEN, adminNote: null, resolvedAt: null, createdAt: '2026-10-05T13:30:23.884Z', updatedAt: '2026-10-05T13:30:23.884Z', job: { id: 89d85512-3ff7-4fc7-a44a-2e594130d71c, jobRef: JOB-1EA2, title: Blocked kitchen drain, status: PAYMENT PENDING, statusLabel: Payment Pending }, customer: { id: 99a96a2f-bd59-4dbd-ba1a-e5f04412946d, fullName: Brisk Customer, email: briskcustomer@gmail.com, mobileNumber: '+353871234567', profilePhotoUrl: null }, trader: { id: adabc55c-6d7d-4b12-8597-6d26366c26bf, traderCode: TRD-0001, businessName: Brisk Trader, fullName: Brisk Trader, profilePhotoUrl: null } }
 *       404: { description: Dispute not found. }
 *   patch:
 *     summary: Update dispute status / admin note
 *     description: |
 *       Send `status` and/or `adminNote` (at least one). A status change notifies the customer (`DISPUTE_UPDATE`,
 *       admin note used as the message). `RESOLVED` / `REJECTED` set `resolvedAt`; moving back to `OPEN` / `IN REVIEW` clears it.
 *     tags: ['Admin / Disputes']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [OPEN, IN REVIEW, RESOLVED, REJECTED], example: IN REVIEW }
 *               adminNote: { type: string, maxLength: 5000, nullable: true, example: Checking with the trader. }
 *     responses:
 *       200:
 *         description: Updated dispute (same shape as detail).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Dispute updated successfully.
 *               data: { id: 5019a717-e351-41aa-ae7a-1bc539d05f69, disputeRef: DSP-E005ED, reason: Poor Quality of Work, description: Drain blocked again next day., evidenceUrls: ['https://api.brisk.ie/uploads/files/job_photo/99a96a2f-bd59-4dbd-ba1a-e5f04412946d/1788858205135-jv3bvmnx.jpg'], status: IN REVIEW, adminNote: Checking with the trader., resolvedAt: null, createdAt: '2026-10-05T13:30:23.884Z', updatedAt: '2026-10-05T13:30:23.884Z', job: { id: 89d85512-3ff7-4fc7-a44a-2e594130d71c, jobRef: JOB-1EA2, title: Blocked kitchen drain, status: PAYMENT PENDING, statusLabel: Payment Pending }, customer: { id: 99a96a2f-bd59-4dbd-ba1a-e5f04412946d, fullName: Brisk Customer, email: briskcustomer@gmail.com, mobileNumber: '+353871234567', profilePhotoUrl: null }, trader: { id: adabc55c-6d7d-4b12-8597-6d26366c26bf, traderCode: TRD-0001, businessName: Brisk Trader, fullName: Brisk Trader, profilePhotoUrl: null } }
 *       400: { description: Invalid status, or neither status nor adminNote sent. }
 *       404: { description: Dispute not found. }
 */
router.get('/disputes/:id', validate(adminDisputeIdParamSchema), controller.getDispute);
router.patch('/disputes/:id', validate(adminUpdateDisputeSchema), controller.updateDispute);

export default router;
