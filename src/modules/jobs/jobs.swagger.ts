/**
 * @swagger
 * components:
 *   schemas:
 *     JobStatus:
 *       type: string
 *       enum: [DRAFT, PUBLISHED, QUOTED, ACCEPTED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, PAYMENT_PENDING]
 *     JobQuoteType:
 *       type: string
 *       enum: [REMOTE, ONSITE, FIXED, BUDGET_RANGE, OPEN_QUOTE]
 *       description: |
 *         Figma Quote Type cards (primary):
 *         REMOTE = Remote Quote Based on photos & details.
 *         ONSITE = On-site quote (when subcategory.siteVisitEnabled).
 *         FIXED / BUDGET_RANGE / OPEN_QUOTE = legacy (still accepted).
 *     JobFormConfig:
 *       type: object
 *       description: |
 *         Show/hide rules for Post a New Job — same shape for every entry point
 *         (OFFER / HOME_CATEGORY / HOME_SUBCATEGORY / DIRECT / TRADER_PROFILE).
 *         Sources: GET /jobs/form-config, Accept Offer (data.jobFormConfig), Job (data.formConfig).
 *         Contract: all keys always present; prefer "" / 0 / [] / false over null.
 *         Bind Min/Max Budget + fee badge to selected quoteType via visibilityByQuoteType.
 *       properties:
 *         entryPoint:
 *           type: string
 *           enum: [OFFER, HOME_CATEGORY, HOME_SUBCATEGORY, DIRECT, TRADER_PROFILE]
 *         offerApplied: { type: boolean }
 *         showOfferBanner: { type: boolean }
 *         offerBanner:
 *           type: object
 *           properties:
 *             title: { type: string }
 *             message: { type: string }
 *             discountLabel: { type: string }
 *         showQuoteType: { type: boolean, description: Always true — REMOTE/ONSITE cards }
 *         quoteTypeOptions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               key: { $ref: '#/components/schemas/JobQuoteType' }
 *               label: { type: string }
 *               description: { type: string }
 *               icon: { type: string, enum: [remote, onsite] }
 *               available: { type: boolean }
 *               feeAmount: { type: number }
 *               feeFormatted: { type: string, description: Formatted from amount+currency when amount > 0; else empty }
 *               feeCurrency: { type: string }
 *               showMinBudget: { type: boolean }
 *               showMaxBudget: { type: boolean }
 *               showSiteVisitFee: { type: boolean }
 *         defaultQuoteType: { $ref: '#/components/schemas/JobQuoteType' }
 *         quoteTypeLocked: { type: string, description: Empty string when not locked }
 *         showBudgetRange: { type: boolean, description: Default paint for REMOTE }
 *         showMinBudget: { type: boolean }
 *         showMaxBudget: { type: boolean }
 *         budgetRequired: { type: boolean }
 *         budgetCurrencyCode: { type: string }
 *         budgetCurrencySymbol: { type: string }
 *         budgetVisibleForQuoteTypes:
 *           type: array
 *           items: { $ref: '#/components/schemas/JobQuoteType' }
 *         visibilityByQuoteType:
 *           type: object
 *           description: Mobile MUST use this when user switches REMOTE ↔ ONSITE
 *           properties:
 *             REMOTE:
 *               type: object
 *               properties:
 *                 showMinBudget: { type: boolean }
 *                 showMaxBudget: { type: boolean }
 *                 showBudgetRange: { type: boolean }
 *                 showSiteVisitFee: { type: boolean }
 *                 nextAfterLocation: { type: string }
 *             ONSITE:
 *               type: object
 *               properties:
 *                 showMinBudget: { type: boolean }
 *                 showMaxBudget: { type: boolean }
 *                 showBudgetRange: { type: boolean }
 *                 showSiteVisitFee: { type: boolean }
 *                 nextAfterLocation: { type: string }
 *         showSiteVisitFee: { type: boolean }
 *         siteVisitFee:
 *           type: object
 *           properties:
 *             amount: { type: number, description: From subcategory.siteVisitFee only; 0 if unset }
 *             currencyCode: { type: string }
 *             formatted: { type: string }
 *             label: { type: string, description: Empty — mobile owns copy }
 *             note: { type: string, description: Empty — mobile owns copy }
 *             enabled: { type: boolean }
 *         showServiceCharge: { type: boolean }
 *         serviceChargeRequired: { type: boolean }
 *         showSiteVisit: { type: boolean }
 *         siteVisitEnabled: { type: boolean }
 *         showQaForm: { type: boolean }
 *         qaFormSchema: { type: array, items: { type: object } }
 *         showImageUpload: { type: boolean, example: true }
 *         imageUploadPurpose: { type: string, example: job_photo }
 *         maxImages: { type: integer, example: 10 }
 *         timeSlotOptions: { type: array, items: { type: object } }
 *         durationOptions: { type: array, items: { type: object } }
 *         priceEnabled: { type: boolean }
 *         priceEnteredBy: { type: string, enum: [CUSTOMER, TRADER] }
 *         flowSteps: { type: array, items: { type: object } }
 *         nextAfterJobForm: { type: string, example: CHOOSE_LOCATION }
 *         nextAfterLocation:
 *           type: string
 *           enum: [SITE_VISIT_PAY_FEE, WAITING_FOR_QUOTES]
 *         publishCtaLabel: { type: string }
 *         chooseLocationCtaLabel: { type: string }
 *         addressesPath: { type: string }
 *         createAddressPath: { type: string }
 *         payScreen: { type: object }
 *         rulesNote: { type: string }
 *     JobOfferBanner:
 *       type: object
 *       description: Offer Applied banner on Post a New Job / job detail. Empty strings when no offer.
 *       properties:
 *         id: { type: string, format: uuid }
 *         offerCode: { type: string }
 *         title: { type: string }
 *         discountType: { type: string, enum: [FLAT, PERCENTAGE, FREE_SERVICE] }
 *         discountValue: { type: number, example: 5 }
 *         discountLabel: { type: string, example: "5%" }
 *         currencyCode: { type: string, example: EUR }
 *         offerType: { type: string, enum: [TRADER, PLATFORM] }
 *         traderId: { type: string }
 *         bannerImageUrl: { type: string }
 *         bannerTitle: { type: string, description: Primary banner text (offer title) }
 *         bannerSubtitle: { type: string, description: Discount chip text }
 *         bannerMessage: { type: string }
 *         offerBanner:
 *           type: object
 *           properties:
 *             title: { type: string }
 *             message: { type: string }
 *             discountLabel: { type: string }
 *     JobTrader:
 *       type: object
 *       description: Empty-string / 0 defaults when job has no trader yet.
 *       properties:
 *         id: { type: string }
 *         businessName: { type: string }
 *         fullName: { type: string }
 *         displayName: { type: string }
 *         traderType: { type: string, enum: [SOLO, COMPANY] }
 *         avgRating: { type: number, example: 4.8 }
 *         topRated: { type: boolean }
 *         yearsExperience: { type: integer, example: 10 }
 *         experienceLabel: { type: string, example: "10+ Yrs" }
 *         city: { type: string }
 *         country: { type: string }
 *         location: { type: string, example: "Dublin, Ireland" }
 *         profilePhotoUrl: { type: string }
 *     JobAddress:
 *       type: object
 *       description: Empty-string / 0 defaults when location not set.
 *       properties:
 *         id: { type: string }
 *         label: { type: string }
 *         addressType: { type: string }
 *         houseNumber: { type: string }
 *         addressLine1: { type: string }
 *         addressLine2: { type: string }
 *         city: { type: string }
 *         county: { type: string }
 *         eircode: { type: string }
 *         country: { type: string }
 *         latitude: { type: number }
 *         longitude: { type: number }
 *         isDefault: { type: boolean }
 *     JobNextSteps:
 *       type: object
 *       properties:
 *         needsLocation: { type: boolean, description: "True until PUT /jobs/{id}/location is called" }
 *         canPublish: { type: boolean, description: "True when draft has addressId" }
 *         canPay: { type: boolean, description: "True after publish creates an invoice" }
 *         invoiceId: { type: string, description: Empty string when no invoice yet }
 *         bookingId: { type: string, description: Empty string when no booking yet }
 *         publishCtaLabel: { type: string }
 *         chooseLocationCtaLabel: { type: string }
 *         nextAfterLocation: { type: string }
 *         paymentScreen: { type: string }
 *         nextScreen: { type: string }
 *     Job:
 *       type: object
 *       description: Nested objects always present (empty string / 0 / [] when unused — no null holes for mobile models).
 *       properties:
 *         id: { type: string, format: uuid }
 *         jobRef: { type: string, example: JOB-A1B2 }
 *         customerId: { type: string, format: uuid }
 *         categoryId: { type: string, format: uuid }
 *         subcategoryId: { type: string }
 *         offerId: { type: string }
 *         appliedTraderOfferId:
 *           type: string
 *           description: Alias of offerId for Direct Trader flow (from claim nextJobPrefill).
 *         claimId: { type: string }
 *         traderId: { type: string }
 *         title: { type: string }
 *         description: { type: string }
 *         addressId: { type: string }
 *         addressLine: { type: string }
 *         city: { type: string }
 *         postcode: { type: string }
 *         latitude: { type: number }
 *         longitude: { type: number }
 *         timeSlot: { type: string, example: Morning }
 *         durationLabel: { type: string, example: "1 Hours" }
 *         phoneNumber: { type: string }
 *         serviceCharge: { type: number, example: 125 }
 *         quoteType: { $ref: '#/components/schemas/JobQuoteType' }
 *         minBudget: { type: number }
 *         maxBudget: { type: number }
 *         siteVisitRequested: { type: boolean }
 *         siteVisitFee: { type: number }
 *         status: { $ref: '#/components/schemas/JobStatus' }
 *         scheduledDate: { type: string, format: date-time, description: Empty string when unset }
 *         qaFormAnswers: { type: object }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         photos:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               photoUrl: { type: string, format: uri }
 *               createdAt: { type: string, format: date-time }
 *         coverPhotoUrl: { type: string }
 *         category:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             name: { type: string }
 *         subcategory:
 *           type: object
 *           properties:
 *             id: { type: string }
 *             name: { type: string }
 *             siteVisitEnabled: { type: boolean }
 *             siteVisitFee: { type: number }
 *             priceEnabled: { type: boolean }
 *             priceEnteredBy: { type: string, enum: [CUSTOMER, TRADER] }
 *             qaFormSchema: { type: array, items: { type: object } }
 *         offerApplied: { type: boolean, description: Show Offer Applied chip when true }
 *         formConfig: { $ref: '#/components/schemas/JobFormConfig' }
 *         offer: { $ref: '#/components/schemas/JobOfferBanner' }
 *         address: { $ref: '#/components/schemas/JobAddress' }
 *         trader: { $ref: '#/components/schemas/JobTrader' }
 *         claim:
 *           type: object
 *           properties:
 *             id: { type: string }
 *             status: { type: string }
 *             claimedAt: { type: string }
 *         bookingId: { type: string }
 *         invoiceId: { type: string }
 *         booking:
 *           type: object
 *           properties:
 *             id: { type: string }
 *             bookingRef: { type: string }
 *             status: { type: string }
 *             scheduledDate: { type: string }
 *             invoice:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 invoiceNumber: { type: string }
 *                 status: { type: string }
 *                 totalAmount: { type: number }
 *         nextSteps: { $ref: '#/components/schemas/JobNextSteps' }
 *     CreateJobRequest:
 *       type: object
 *       required: [categoryId, description]
 *       description: |
 *         Body for Post a New Job. Same schema for home category and Accept Offer paths.
 *         Show/hide fields using jobFormConfig — do not assume every field is always visible.
 *       properties:
 *         categoryId:
 *           type: string
 *           format: uuid
 *           description: |
 *             **Required.** Service category UUID.
 *             Sources: GET /categories, home tap, or Accept `nextJobPrefill.categoryId`.
 *         subcategoryId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: |
 *             Sub-category UUID (Solar, Appliance Repair, …).
 *             Sources: GET /sub-categories?categoryId=… or Accept `nextJobPrefill.subcategoryId`.
 *             Drives Site Visit fee + budget + QA form via subcategory flags.
 *         title:
 *           type: string
 *           description: |
 *             Job title (placeholder e.g. "Fix Leaking Kitchen sink").
 *             Optional — defaults to offer title or category name if omitted.
 *         description:
 *           type: string
 *           description: |
 *             **Required.** Specific requirements text area
 *             (parking, access, model numbers, etc.).
 *         scheduledDate:
 *           type: string
 *           format: date-time
 *           description: |
 *             Selected date chip as ISO-8601 (use local date at midnight UTC or with offset).
 *             Example for OCT 24: "2026-10-24T00:00:00.000Z".
 *         timeSlot:
 *           type: string
 *           example: Afternoon
 *           description: |
 *             Exact key from `formConfig.timeSlotOptions[].key`:
 *             `Morning` | `Afternoon` | `Evening` | `Any time`.
 *             Ranges: 08:00-12:00 / 12:00-17:00 / 17:00-21:00 / 08:00-21:00.
 *         durationLabel:
 *           type: string
 *           example: "1 Hours"
 *           description: |
 *             Job Duration / Size dropdown. Prefer values from `formConfig.durationOptions`
 *             (e.g. "1 Hours", "2 Hours", "Half Day").
 *         phoneNumber:
 *           type: string
 *           example: "+353871234567"
 *           description: Additional contact phone (E.164 preferred).
 *         photoUrls:
 *           type: array
 *           items: { type: string, format: uri }
 *           description: |
 *             Media URLs from `POST /uploads` with purpose=`job_photo` (or formConfig.imageUploadPurpose).
 *             Max count: formConfig.maxImages (default 10). Empty array allowed.
 *         qaFormAnswers:
 *           type: object
 *           additionalProperties: true
 *           description: |
 *             Answers keyed by fieldId from subcategory `qaFormSchema` when formConfig.showQaForm.
 *         offerId:
 *           type: string
 *           format: uuid
 *           description: |
 *             Soft-link trader/platform offer. Alias of appliedTraderOfferId.
 *             From Accept `nextJobPrefill.offerId`. Does not claim/lock.
 *         appliedTraderOfferId:
 *           type: string
 *           format: uuid
 *           description: Same as offerId (Accept prefill name). Either field is enough.
 *         claimId:
 *           type: string
 *           format: uuid
 *           description: |
 *             Optional legacy. Prefer offerId only. Soft CLAIMED rows may be reused;
 *             USED claims are rejected.
 *         traderId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: |
 *             From Accept `nextJobPrefill.traderId`. **Required to publish Site Visit**
 *             (Pay Fee needs a trader). Usually auto-filled from offer.traderId.
 *         serviceCharge:
 *           type: number
 *           minimum: 0
 *           example: 125
 *           description: |
 *             Optional SERVICE path amount. Site Visit uses subcategory siteVisitFee instead
 *             (do not send serviceCharge for ONSITE unless overriding).
 *         quoteType:
 *           type: string
 *           enum: [REMOTE, ONSITE, FIXED, BUDGET_RANGE, OPEN_QUOTE]
 *           description: |
 *             Figma Quote Type card selection.
 *             - REMOTE — Remote Quote (photos & details); may show min/max budget
 *             - ONSITE — Site Visit (fee badge); hides budget; pay siteVisitFee after publish
 *             FIXED/BUDGET_RANGE/OPEN_QUOTE = legacy compatibility.
 *         minBudget:
 *           type: number
 *           description: |
 *             Min Budget (€) when formConfig.showMinBudget and quoteType is REMOTE.
 *             Must be ≤ maxBudget when both set.
 *         maxBudget:
 *           type: number
 *           description: |
 *             Max Budget (€) when formConfig.showMaxBudget.
 *             Also used as SERVICE publish fallback if serviceCharge omitted.
 *         siteVisitRequested:
 *           type: boolean
 *           description: |
 *             Optional. Defaults true when quoteType=ONSITE.
 *             Keep in sync with Site Visit card selection.
 *     UpdateJobRequest:
 *       type: object
 *       properties:
 *         categoryId: { type: string, format: uuid }
 *         subcategoryId: { type: string, format: uuid, nullable: true }
 *         title: { type: string }
 *         description: { type: string }
 *         scheduledDate: { type: string, format: date-time, nullable: true }
 *         timeSlot: { type: string, nullable: true }
 *         durationLabel: { type: string, nullable: true }
 *         phoneNumber: { type: string, nullable: true }
 *         photoUrls: { type: array, items: { type: string, format: uri } }
 *         qaFormAnswers: { type: object, nullable: true }
 *         serviceCharge: { type: number, minimum: 0, nullable: true }
 *         traderId: { type: string, format: uuid, nullable: true }
 *         quoteType: { type: string, enum: [REMOTE, ONSITE, FIXED, BUDGET_RANGE, OPEN_QUOTE], description: Same as CreateJobRequest.quoteType }
 *         minBudget: { type: number, nullable: true, description: Update min budget when budget fields are shown }
 *         maxBudget: { type: number, nullable: true, description: Update max budget }
 *         siteVisitRequested: { type: boolean, description: Keep true when Site Visit card selected }
 *     SetJobLocationRequest:
 *       type: object
 *       required: [addressId]
 *       properties:
 *         addressId:
 *           type: string
 *           format: uuid
 *           description: |
 *             Saved address UUID from GET /addresses or POST /addresses.
 *             Must belong to the authenticated customer. Used for Home/Work/Other selection.
 *     PublishJobRequest:
 *       type: object
 *       description: Body optional if address already set via PUT /jobs/{id}/location.
 *       properties:
 *         addressId:
 *           type: string
 *           format: uuid
 *           description: |
 *             Optional if already set via PUT /jobs/{id}/location.
 *             If omitted, job.addressId must already exist or publish returns 400.
 *         serviceCharge:
 *           type: number
 *           minimum: 0
 *           example: 125
 *           description: |
 *             Optional SERVICE-path override. Ignored for Site Visit (uses siteVisitFee).
 *             For non-ONSITE Direct Trader, required if job has no serviceCharge/maxBudget.
 *     PublishJobResponse:
 *       type: object
 *       properties:
 *         job: { $ref: '#/components/schemas/Job' }
 *         booking:
 *           type: object
 *           nullable: true
 *           description: Created only for Direct Trader publish (traderId + serviceCharge).
 *           properties:
 *             id: { type: string, format: uuid }
 *             bookingRef: { type: string }
 *             status: { type: string, example: SCHEDULED }
 *             scheduledDate: { type: string, format: date-time }
 *             traderId: { type: string, format: uuid }
 *             jobId: { type: string, format: uuid }
 *         invoice:
 *           allOf:
 *             - $ref: '#/components/schemas/Invoice'
 *           nullable: true
 *           description: Full invoice (lineItems, payNowLabel, serviceSummary) when Direct Trader.
 *     JobListResponse:
 *       type: object
 *       properties:
 *         jobs:
 *           type: array
 *           items: { $ref: '#/components/schemas/Job' }
 */
