/**
 * @swagger
 * components:
 *   schemas:
 *     SiteVisitItem:
 *       type: object
 *       description: |
 *         One trader's site-visit request on a job. Same shape on Admin (customer + trader details)
 *         and Trader Portal. `trader` and full customer contact are Admin-only; trader sees
 *         `customer.fullName` + `customer.profilePhotoUrl` only.
 *
 *         | status | statusLabel | group |
 *         |---|---|---|
 *         | PENDING | Waiting for Customer | REQUESTED |
 *         | CONFIRMED | Visit Confirmed | REQUESTED |
 *         | RESCHEDULE_REQUIRED | Reschedule Requested | REQUESTED |
 *         | COMPLETED | Site Visited | VISITED |
 *         | CANCELLED | Cancelled | CLOSED |
 *         | CLOSED | Closed | CLOSED |
 *
 *         `CLOSED` = request was still open but the job was cancelled, completed, or awarded to another
 *         trader (`closedReason`: JOB_CANCELLED / JOB_COMPLETED / ASSIGNED_TO_OTHER_TRADER).
 *         `requestStatus` is the raw stored status.
 *       properties:
 *         id: { type: string, format: uuid }
 *         requestId: { type: string, format: uuid }
 *         status: { type: string, enum: [PENDING, CONFIRMED, RESCHEDULE_REQUIRED, COMPLETED, CANCELLED, CLOSED] }
 *         statusLabel: { type: string }
 *         group: { type: string, enum: [REQUESTED, VISITED, CLOSED] }
 *         requestStatus: { type: string, enum: [PENDING, CONFIRMED, RESCHEDULE_REQUIRED, COMPLETED, CANCELLED] }
 *         closedReason: { type: string, nullable: true, enum: [JOB_CANCELLED, JOB_COMPLETED, ASSIGNED_TO_OTHER_TRADER] }
 *         visitDate: { type: string, nullable: true, example: '2026-10-04' }
 *         timeSlot: { type: string, nullable: true, enum: [MORNING, AFTERNOON, EVENING, ANYTIME] }
 *         startTime: { type: string, nullable: true, example: '08:00' }
 *         endTime: { type: string, nullable: true, example: '12:00' }
 *         slots:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               date: { type: string, example: '2026-10-04' }
 *               timeSlot: { type: string }
 *               startTime: { type: string }
 *               endTime: { type: string }
 *               isSelected: { type: boolean }
 *         slotCount: { type: integer }
 *         siteVisitFee: { type: number, nullable: true }
 *         arrivedAt: { type: string, format: date-time, nullable: true }
 *         completedAt: { type: string, format: date-time, nullable: true }
 *         durationMinutes: { type: integer, nullable: true }
 *         requestedAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         job:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             jobRef: { type: string, nullable: true }
 *             title: { type: string }
 *             status: { type: string }
 *             category: { type: object, properties: { id: { type: string }, name: { type: string } } }
 *             subcategory: { type: object, nullable: true, properties: { id: { type: string }, name: { type: string } } }
 *             city: { type: string, nullable: true }
 *             postcode: { type: string, nullable: true }
 *             scheduledDate: { type: string, format: date-time, nullable: true }
 *             assignedTraderId: { type: string, nullable: true, description: Admin only }
 *         customer:
 *           type: object
 *           properties:
 *             id: { type: string, description: Admin only }
 *             fullName: { type: string }
 *             email: { type: string, description: Admin only }
 *             mobileNumber: { type: string, description: Admin only }
 *             profilePhotoUrl: { type: string, nullable: true }
 *         trader:
 *           type: object
 *           description: Admin only
 *           properties:
 *             id: { type: string }
 *             traderCode: { type: string, nullable: true }
 *             name: { type: string }
 *             fullName: { type: string }
 *             businessName: { type: string, nullable: true }
 *             traderType: { type: string }
 *             avgRating: { type: number }
 *             email: { type: string }
 *             mobileNumber: { type: string }
 *             profilePhotoUrl: { type: string, nullable: true }
 *       example:
 *         id: 6b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e
 *         requestId: 6b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e
 *         status: PENDING
 *         statusLabel: Waiting for Customer
 *         group: REQUESTED
 *         requestStatus: PENDING
 *         closedReason: null
 *         visitDate: '2026-10-04'
 *         timeSlot: MORNING
 *         startTime: '08:00'
 *         endTime: '12:00'
 *         slots:
 *           - { id: 7c2e3d4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f, date: '2026-10-04', timeSlot: MORNING, startTime: '08:00', endTime: '12:00', isSelected: false }
 *         slotCount: 1
 *         siteVisitFee: 40
 *         arrivedAt: null
 *         completedAt: null
 *         durationMinutes: null
 *         requestedAt: '2026-10-01T09:30:00.000Z'
 *         updatedAt: '2026-10-01T09:30:00.000Z'
 *         job:
 *           id: 1f2e3d4c-5b6a-4789-8abc-def012345678
 *           jobRef: JOB-1042
 *           title: Boiler not heating
 *           status: PUBLISHED
 *           category: { id: 3a07ea99-4d74-45b9-86ba-6f95ca85b8a2, name: Plumbing Services }
 *           subcategory: { id: 15532727-16c1-4e72-b3c0-dfb59293bad7, name: Boiler & Heating Repair }
 *           city: Dublin
 *           postcode: D02 X285
 *           scheduledDate: null
 *           assignedTraderId: null
 *         customer: { id: 9e8d7c6b-5a4f-4e3d-2c1b-0a9f8e7d6c5b, fullName: Sarah Jenkins, email: sarah@example.com, mobileNumber: '+353871234567', profilePhotoUrl: null }
 *         trader: { id: 5c4b3a2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d, traderCode: TRD-1004, name: Murphy Plumbing, fullName: John Murphy, businessName: Murphy Plumbing, traderType: SOLO, avgRating: 4.8, email: john@example.com, mobileNumber: '+353861234567', profilePhotoUrl: null }
 *     SiteVisitSummary:
 *       type: object
 *       properties:
 *         total: { type: integer }
 *         requestedCount: { type: integer }
 *         visitedCount: { type: integer }
 *         closedCount: { type: integer }
 */
export {};
