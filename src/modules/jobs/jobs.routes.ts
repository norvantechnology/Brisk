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
  publishJobSchema,
  setJobLocationSchema,
  updateJobSchema,
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
 *       Creates status **DRAFT**. Same body shape for every entry point — use
 *       `GET /jobs/form-config` (or Accept `jobFormConfig`) for show/hide.
 *
 *       **Offer path:** send `offerId` (or `appliedTraderOfferId`) + usually `traderId`
 *       from Accept `nextJobPrefill`. Do **not** require a prior claim API.
 *
 *       **Site Visit:** `quoteType=ONSITE` snapshots `siteVisitFee` on the job
 *       from subcategory (0 if admin left fee unset). Next after form: Choose Location.
 *
 *       **Images:** `POST /uploads` with `purpose=job_photo`, then put returned URLs in `photoUrls`.
 *
 *       **Next:** `PUT /jobs/{id}/location` → `POST /jobs/{id}/publish`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateJobRequest'
 *           examples:
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
 *     summary: Select Location — attach saved address to draft job
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile screen:** Select Location (saved Home / Work / Other cards).
 *
 *       **Auth:** Customer Bearer; job + address must belong to the same customer.
 *
 *       **Flow:**
 *       1. `GET /addresses` — list cards (`label`, `formattedAddress`, `icon`)
 *       2. Optional `POST /addresses` — Choose Location / search → create then select
 *       3. This `PUT` — set selected `addressId` on the draft job
 *       4. User taps **Publish Job Post** → `POST /jobs/{id}/publish`
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
 *           example:
 *             addressId: e60ca842-e86a-4825-abcf-2e79a9ff8e4d
 *     responses:
 *       200:
 *         description: Job with address fields set; `nextSteps` updated.
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
 *     summary: Publish Job Post → invoice when pay needed (offer claimed only after payment)
 *     tags: ['Customer / Jobs']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Mobile CTA:** **Publish Job Post** on Select Location.
 *
 *       **Auth:** Customer Bearer; job must be DRAFT and owned by caller.
 *
 *       **Requirements:**
 *       - Address already set (`PUT …/location`) **or** pass `addressId` in body
 *       - Site Visit (`quoteType=ONSITE`): **traderId required**; charges `siteVisitFee`
 *         from job snapshot / subcategory only (0 if admin unset — no default amount)
 *       - Direct Trader SERVICE path: `serviceCharge` or `maxBudget` if not site visit
 *
 *       **Offer claim:** Publish does **not** claim. Pass `offerId` on the job only.
 *       Offer becomes **USED** on `POST /payments/{id}/confirm` (Payment Successful).
 *       If publish creates no invoice (waiting for quotes), claim → USED when job goes live.
 *
 *       **Site Visit side effects:** Quote ACCEPTED + Booking SCHEDULED + Invoice UNPAID
 *       with `purpose=SITE_VISIT_FEE`.
 *
 *       **Next screen:** open invoice → `POST /payments/intent` → confirm/fail.
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
 *             siteVisit:
 *               summary: Publish site visit (address already on job)
 *               value: {}
 *             withAddress:
 *               summary: Publish and set address in one call
 *               value:
 *                 addressId: e60ca842-e86a-4825-abcf-2e79a9ff8e4d
 *     responses:
 *       200:
 *         description: |
 *           `data.job`, `data.booking`, `data.invoice` (full Pay Fee payload when trader+fee).
 *           Navigate to Site Visit & Pay Fee using `data.invoice.id`.
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

export default router;
