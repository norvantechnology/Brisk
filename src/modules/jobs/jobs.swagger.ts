/**
 * @swagger
 * components:
 *   schemas:
 *     JobStatus:
 *       type: string
 *       enum: [DRAFT, PUBLISHED, QUOTED, ACCEPTED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, PAYMENT_PENDING]
 *     JobOfferBanner:
 *       type: object
 *       nullable: true
 *       description: Offer Applied banner on Post a New Job / job detail.
 *       properties:
 *         id: { type: string, format: uuid }
 *         offerCode: { type: string }
 *         title: { type: string }
 *         discountType: { type: string, enum: [FLAT, PERCENTAGE, FREE_SERVICE] }
 *         discountValue: { type: number, example: 5 }
 *         discountLabel: { type: string, example: "5%" }
 *         currencyCode: { type: string, example: EUR }
 *         offerType: { type: string, enum: [TRADER, PLATFORM] }
 *         traderId: { type: string, format: uuid, nullable: true }
 *         bannerImageUrl: { type: string, format: uri, nullable: true }
 *         bannerTitle: { type: string, description: Primary banner text (offer title) }
 *         bannerSubtitle: { type: string, nullable: true, description: Discount chip text }
 *     JobTrader:
 *       type: object
 *       nullable: true
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessName: { type: string, nullable: true }
 *         fullName: { type: string, nullable: true }
 *         displayName: { type: string, nullable: true }
 *         traderType: { type: string, enum: [SOLO, COMPANY] }
 *         avgRating: { type: number, example: 4.8 }
 *         topRated: { type: boolean }
 *         yearsExperience: { type: integer, example: 10 }
 *         experienceLabel: { type: string, nullable: true, example: "10+ Yrs" }
 *         city: { type: string, nullable: true }
 *         country: { type: string, nullable: true }
 *         location: { type: string, nullable: true, example: "Dublin, Ireland" }
 *         profilePhotoUrl: { type: string, format: uri, nullable: true }
 *     JobAddress:
 *       type: object
 *       nullable: true
 *       properties:
 *         id: { type: string, format: uuid }
 *         label: { type: string }
 *         addressType: { type: string }
 *         houseNumber: { type: string, nullable: true }
 *         addressLine1: { type: string }
 *         addressLine2: { type: string, nullable: true }
 *         city: { type: string }
 *         county: { type: string, nullable: true }
 *         eircode: { type: string, nullable: true }
 *         country: { type: string }
 *         latitude: { type: number, nullable: true }
 *         longitude: { type: number, nullable: true }
 *         isDefault: { type: boolean }
 *     JobNextSteps:
 *       type: object
 *       properties:
 *         needsLocation: { type: boolean, description: "True until PUT /jobs/{id}/location is called" }
 *         canPublish: { type: boolean, description: "True when draft has addressId" }
 *         canPay: { type: boolean, description: "True after publish creates an invoice" }
 *         invoiceId: { type: string, format: uuid, nullable: true }
 *         bookingId: { type: string, format: uuid, nullable: true }
 *     Job:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         jobRef: { type: string, example: JOB-A1B2 }
 *         customerId: { type: string, format: uuid }
 *         categoryId: { type: string, format: uuid }
 *         subcategoryId: { type: string, format: uuid, nullable: true }
 *         offerId: { type: string, format: uuid, nullable: true }
 *         appliedTraderOfferId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: Alias of offerId for Direct Trader flow (from claim nextJobPrefill).
 *         claimId: { type: string, format: uuid, nullable: true }
 *         traderId: { type: string, format: uuid, nullable: true }
 *         title: { type: string }
 *         description: { type: string }
 *         addressId: { type: string, format: uuid, nullable: true }
 *         addressLine: { type: string, nullable: true }
 *         city: { type: string, nullable: true }
 *         postcode: { type: string, nullable: true }
 *         latitude: { type: number, nullable: true }
 *         longitude: { type: number, nullable: true }
 *         timeSlot: { type: string, nullable: true, example: Morning }
 *         durationLabel: { type: string, nullable: true, example: "1 Hour" }
 *         phoneNumber: { type: string, nullable: true }
 *         serviceCharge: { type: number, nullable: true, example: 125 }
 *         status: { $ref: '#/components/schemas/JobStatus' }
 *         scheduledDate: { type: string, format: date-time, nullable: true }
 *         qaFormAnswers: { type: object, nullable: true }
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
 *         coverPhotoUrl: { type: string, format: uri, nullable: true }
 *         category:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             name: { type: string }
 *         subcategory:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             name: { type: string }
 *         offerApplied: { type: boolean, description: Show Offer Applied chip when true }
 *         offer: { $ref: '#/components/schemas/JobOfferBanner' }
 *         address: { $ref: '#/components/schemas/JobAddress' }
 *         trader: { $ref: '#/components/schemas/JobTrader' }
 *         claim:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             status: { type: string, enum: [CLAIMED, USED, CANCELLED] }
 *             claimedAt: { type: string, format: date-time }
 *         bookingId: { type: string, format: uuid, nullable: true }
 *         invoiceId: { type: string, format: uuid, nullable: true }
 *         booking:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             bookingRef: { type: string }
 *             status: { type: string }
 *             scheduledDate: { type: string, format: date-time }
 *             invoice:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 invoiceNumber: { type: string }
 *                 status: { type: string }
 *                 totalAmount: { type: number }
 *         nextSteps: { $ref: '#/components/schemas/JobNextSteps' }
 *     CreateJobRequest:
 *       type: object
 *       required: [categoryId, description]
 *       properties:
 *         categoryId:
 *           type: string
 *           format: uuid
 *           description: Required. From GET /categories or claim nextJobPrefill.categoryId.
 *         subcategoryId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: Optional. From GET /sub-categories?categoryId=... or nextJobPrefill.subcategoryId.
 *         title:
 *           type: string
 *           description: Optional. Defaults to offer title or category name.
 *         description:
 *           type: string
 *           description: Required. Specific requirements / job details text.
 *         scheduledDate:
 *           type: string
 *           format: date-time
 *           description: Preferred service date/time (ISO-8601).
 *         timeSlot:
 *           type: string
 *           example: Morning
 *           description: UI time chip (Morning / Afternoon / Evening / custom).
 *         durationLabel:
 *           type: string
 *           example: "1 Hour"
 *           description: Duration chip shown on job form.
 *         phoneNumber:
 *           type: string
 *           example: "+353871234567"
 *           description: Contact phone for the job.
 *         photoUrls:
 *           type: array
 *           items: { type: string, format: uri }
 *           description: Uploaded photo URLs from POST /uploads (purpose job_photo or similar).
 *         qaFormAnswers:
 *           type: object
 *           additionalProperties: true
 *           description: Answers matching category qaFormSchema when siteVisit/QA is enabled.
 *         offerId:
 *           type: string
 *           format: uuid
 *           description: Optional. Same as appliedTraderOfferId.
 *         appliedTraderOfferId:
 *           type: string
 *           format: uuid
 *           description: Preferred. From claim nextJobPrefill.appliedTraderOfferId (Direct Trader flow).
 *         claimId:
 *           type: string
 *           format: uuid
 *           description: From nextJobPrefill.claimId. Links claim → job; marked USED on publish.
 *         traderId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: From nextJobPrefill.traderId. Required path for Direct Trader invoice on publish.
 *         serviceCharge:
 *           type: number
 *           minimum: 0
 *           example: 125
 *           description: Base service amount. Required before/at publish for Direct Trader jobs.
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
 *     SetJobLocationRequest:
 *       type: object
 *       required: [addressId]
 *       properties:
 *         addressId:
 *           type: string
 *           format: uuid
 *           description: Saved address id from POST /addresses or GET /addresses.
 *     PublishJobRequest:
 *       type: object
 *       properties:
 *         addressId:
 *           type: string
 *           format: uuid
 *           description: "Optional if already set via PUT /jobs/{id}/location. Required overall to publish."
 *         serviceCharge:
 *           type: number
 *           minimum: 0
 *           example: 125
 *           description: Required for Direct Trader (traderId set) if not already on the draft.
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
