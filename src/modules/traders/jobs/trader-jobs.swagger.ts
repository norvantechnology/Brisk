/**
 * @swagger
 * tags:
 *   - name: Trader / Discover Jobs
 *     description: |
 *       Trader Discover + Site Visit / Reschedule flow (Figma).
 *       Auth trader Bearer. Refresh list on socket job:published / job:created / job:updated.
 *
 *       Screen map:
 *       1. Discover feed → GET /traders/jobs/discover
 *       2. Job Details (NONE / RESCHEDULE_REQUIRED / CONFIRMED) → GET /traders/jobs/discover/{id}
 *       3. Select Date and Time bottom sheet → GET .../site-visit/slots
 *       4. Request For Site Visit → POST .../site-visit/request
 *       5. Request For Reschedule Site Visit → POST .../site-visit/reschedule
 *       6. Bookmark → POST/DELETE .../bookmark
 *
 *       Drive CTA from data.primaryAction:
 *       REQUEST_SITE_VISIT | REQUEST_RESCHEDULE | BACK_TO_JOB | SUBMIT_QUOTE
 *
 * components:
 *   schemas:
 *     TraderDiscoverJobCard:
 *       type: object
 *       required: [id, title, badge, distanceKm, areaName, priceLabel, createdAt, isBookmarked, isSiteVisit]
 *       properties:
 *         id: { type: string, format: uuid }
 *         title: { type: string, example: Solar Panel Installation }
 *         badge:
 *           type: string
 *           nullable: true
 *           enum: [Site Visit, Reschedule]
 *           description: null when neither site-visit nor reschedule
 *           example: Site Visit
 *         distanceKm: { type: number, example: 2.5 }
 *         areaName: { type: string, example: Dublin 2 }
 *         priceLabel: { type: string, nullable: true, example: "€30" }
 *         createdAt: { type: string, format: date-time, description: App formats relative Posted X ago }
 *         isBookmarked: { type: boolean }
 *         isSiteVisit: { type: boolean }
 *     TraderSiteVisitBlock:
 *       type: object
 *       description: Nested on Job Details. status NONE means no trader request yet.
 *       properties:
 *         status: { type: string, enum: [NONE, CONFIRMED, RESCHEDULE_REQUIRED] }
 *         visitDate: { type: string, nullable: true, example: '2026-10-24', description: YYYY-MM-DD }
 *         timeSlot: { type: string, nullable: true, enum: [MORNING, AFTERNOON, EVENING, ANYTIME] }
 *         timeSlotLabel: { type: string, nullable: true, example: Afternoon }
 *         startTime: { type: string, nullable: true, example: '12:00' }
 *         endTime: { type: string, nullable: true, example: '17:00' }
 *         displayLabel: { type: string, nullable: true, example: 'Oct 24, 2026 12:00 – 17:00' }
 *         statusBadge: { type: string, nullable: true, example: CONFIRMED, description: CONFIRMED or RESCHEDULE REQUIRED }
 *         sectionTitle: { type: string, nullable: true, example: SCHEDULED VISIT DATE & TIME }
 *         requestId: { type: string, format: uuid, nullable: true }
 *     TraderDiscoverJobDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/TraderDiscoverJobCard'
 *         - type: object
 *           properties:
 *             description: { type: string }
 *             photos: { type: array, items: { type: string, format: uri } }
 *             photoCount: { type: integer }
 *             photosSectionTitle: { type: string, example: 'Customer Photos (3)' }
 *             photosHint: { type: string, nullable: true, example: Swipe for more }
 *             siteVisitFeeTitle: { type: string, nullable: true, example: SITE VISIT FEE }
 *             siteVisitFee: { type: number, nullable: true, example: 30 }
 *             siteVisitFeeLabel: { type: string, nullable: true, example: "€30" }
 *             siteVisitFeeNote: { type: string, nullable: true }
 *             isReschedule: { type: boolean }
 *             canSelectDateTime: { type: boolean }
 *             canRequestSiteVisit: { type: boolean }
 *             canRequestReschedule: { type: boolean }
 *             canSubmitQuote: { type: boolean, description: true when non site-visit Job Details should show Submit Quote }
 *             selectDateTimeLabel: { type: string, nullable: true, example: Select Date & Time }
 *             primaryAction:
 *               type: string
 *               enum: [REQUEST_SITE_VISIT, REQUEST_RESCHEDULE, BACK_TO_JOB, SUBMIT_QUOTE]
 *             primaryActionLabel: { type: string, example: Request For Site Visit }
 *             siteVisit: { $ref: '#/components/schemas/TraderSiteVisitBlock' }
 *             serviceTermsNote: { type: string, example: By accepting, you agree to the Service Terms. }
 *             customer:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 fullName: { type: string, example: Sarah Jenkins }
 *                 profilePhotoUrl: { type: string, nullable: true }
 *                 isVerified: { type: boolean }
 *                 verifiedLabel: { type: string, example: Verified Customer }
 *             category:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 name: { type: string }
 *                 iconName: { type: string, nullable: true }
 *             subcategory:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 name: { type: string }
 *             categoryName: { type: string }
 *             subcategoryName: { type: string, nullable: true }
 *             tags:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   label: { type: string }
 *                   icon: { type: string, nullable: true, description: Same as iconUrl — fetchable image URL }
 *                   iconUrl: { type: string, nullable: true, description: Category/subcategory icon URL for mobile }
 *                   iconName: { type: string, nullable: true, description: Optional raw name key; prefer iconUrl }
 *             scheduledDate: { type: string, format: date-time, nullable: true }
 *             timeSlot: { type: string, nullable: true, description: Customer preferred slot text on job }
 *             durationLabel: { type: string, nullable: true }
 *             location:
 *               type: object
 *               properties:
 *                 areaName: { type: string }
 *                 distanceKm: { type: number }
 *                 distanceLabel: { type: string, example: Approx. 1.8 km away }
 *                 latitude: { type: number }
 *                 longitude: { type: number }
 *                 mapPreviewUrl: { type: string }
 *     TraderSiteVisitSlots:
 *       type: object
 *       properties:
 *         jobId: { type: string, format: uuid }
 *         title: { type: string, example: Site Visit Date & Time }
 *         dates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date: { type: string, example: '2026-10-24' }
 *               month: { type: string, example: OCT }
 *               day: { type: integer, example: 24 }
 *               weekday: { type: string, example: THU }
 *         timeSlots:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, enum: [MORNING, AFTERNOON, EVENING, ANYTIME] }
 *               label: { type: string, example: Morning }
 *               startTime: { type: string, example: '08:00' }
 *               endTime: { type: string, example: '12:00' }
 *               rangeLabel: { type: string, example: '08:00 - 12:00' }
 *               icon: { type: string, example: sun }
 *         selected:
 *           type: object
 *           nullable: true
 *           properties:
 *             date: { type: string }
 *             timeSlot: { type: string }
 *         proposedSlots:
 *           type: array
 *           description: SITE VISIT SLOTS list (app adds locally then submits all)
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string }
 *               date: { type: string }
 *               timeSlot: { type: string }
 *               displayLabel: { type: string, example: 'Jul 25, 08:00AM - 12:00PM' }
 *               startTime: { type: string }
 *               endTime: { type: string }
 *               isSelected: { type: boolean }
 *         slotsSectionTitle: { type: string, example: SITE VISIT SLOTS }
 *         addAnotherSlotLabel: { type: string, example: Add Another Slot }
 *         mode: { type: string, enum: [REQUEST, RESCHEDULE] }
 *         submitLabel: { type: string, example: Request For Site Visit }
 *     TraderSiteVisitRequestBody:
 *       type: object
 *       description: Prefer slots array for multi-slot flow. Legacy date+timeSlot still works.
 *       properties:
 *         slots:
 *           type: array
 *           minItems: 1
 *           items:
 *             type: object
 *             required: [date, timeSlot]
 *             properties:
 *               date: { type: string, example: '2026-10-24' }
 *               timeSlot: { type: string, enum: [MORNING, AFTERNOON, EVENING, ANYTIME] }
 *         date: { type: string, example: '2026-10-24', description: Legacy single-slot }
 *         timeSlot: { type: string, enum: [MORNING, AFTERNOON, EVENING, ANYTIME] }
 */
export {};
