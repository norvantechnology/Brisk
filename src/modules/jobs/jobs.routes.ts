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
 *     tags: ['Customer / Jobs']
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
 *       - `id` (uuid string), `jobRef`, `title`, `status`, `statusLabel`
 *       - `date` — "October 24, 2026" (ACTIVE: scheduled/posted day · COMPLETED: finished day · OTHER: cancelled day); `dateAt` ISO
 *       - `provider` — assigned trader name (null until assigned)
 *       - `amount` (number or null) + `amountType`:
 *         `Estimated` (accepted quote / service charge / budget) · `Amount Due` (payment request sent) ·
 *         `Charges` (paid total) · `Refunded` (completed refunds)
 *       - `currencyCode`, `currencySymbol`
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
 *                     tab: ACTIVE
 *                     items:
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
 *                         downloadUrl: null
 *                   meta: { total: 1, page: 1, limit: 20, totalPages: 1 }
 *               completed:
 *                 summary: tab=COMPLETED
 *                 value:
 *                   success: true
 *                   message: My jobs retrieved successfully.
 *                   data:
 *                     tab: COMPLETED
 *                     items:
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
 *                     tab: OTHER
 *                     items:
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
 *     tags: ['Customer / Jobs']
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
router.get(
  '/:id/completed',
  ...customerOnly,
  validate(jobIdParamSchema),
  controller.getCompletedJobDetail
);
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
 *     tags: ['Customer / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       All trader quotations for the job, newest request first. Accept one with
 *       `POST /jobs/{id}/quotes/{quoteId}/accept` when `canAccept=true`.
 *
 *       `selectionStatus`: `PENDING` | `AWAITING_TRADER_CONFIRMATION` (you accepted, trader has not
 *       confirmed yet) | `CONFIRMED` (trader assigned) | `REJECTED` | `EXPIRED`.
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
 *           `jobId`, `jobStatus`, `assignedTraderId`, `awaitingTraderConfirmation`, `quotes[]`
 *           (id, amount, currencyCode, currencySymbol, notes, estimatedDays, status, selectionStatus,
 *           canAccept, requestedAt, createdAt, trader{id, displayName, fullName, profilePhotoUrl,
 *           avgRating, reviewsCount, topRated, isVerified, yearsExperience, city}).
 *       404:
 *         description: Job not found
 */
router.get('/:id/quotes', ...customerOnly, validate(jobIdParamSchema), controller.listJobQuotes);

/**
 * @swagger
 * /jobs/{id}/quotes/{quoteId}/accept:
 *   post:
 *     summary: Accept trader quotation (customer) — trader must then confirm
 *     tags: ['Customer / Jobs']
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
 *                 assignmentStatus: AWAITING_TRADER_CONFIRMATION
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
 *     tags: ['Customer / Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Sets `status=CANCELLED` (and booking if present).
 *       Response includes `statusBadge: "Cancelled"`.
 *       Not allowed for COMPLETED, already CANCELLED, or PAID invoices.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job cancelled — `data.status=CANCELLED`, `data.statusBadge=Cancelled`
 *       400:
 *         description: Completed or paid job
 *       409:
 *         description: Already cancelled
 */
router.post('/:id/cancel', ...customerOnly, validate(jobIdParamSchema), controller.cancelJob);

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
