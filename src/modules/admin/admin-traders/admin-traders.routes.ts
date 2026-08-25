import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-traders.controller';
import {
  createTraderSchema,
  traderFilterSchema,
  traderIdParamSchema,
  updateTraderSchema,
  updateTraderStatusSchema,
  updateTraderVerificationSchema,
} from './admin-traders.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * tags:
 *   - name: Admin / Traders
 *     description: |
 *       Admin **Traders Management** (All Traders screen).
 *       Auth: `POST /admin/auth/login` → Bearer token.
 *       Related: onboarding document review lives under **Admin / Trader Verification**.
 *
 * components:
 *   schemas:
 *     AdminTraderListItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid, example: 'f0f8b572-de03-48d2-a080-34b8966082a6' }
 *         traderCode: { type: string, nullable: true, example: 'TRD-1001' }
 *         businessName: { type: string, example: 'The Book Nook' }
 *         businessType: { type: string, enum: [Individual, Business], example: 'Individual' }
 *         traderType: { type: string, enum: [SOLO, COMPANY], example: 'SOLO' }
 *         contact:
 *           type: object
 *           properties:
 *             email: { type: string, example: 'clara.watts@thebooknook.com' }
 *             mobileNumber: { type: string, example: '+447867880123' }
 *             fullName: { type: string, example: 'Clara Watts' }
 *         listingsCount: { type: integer, example: 56, description: 'Count of trader offers (LISTINGS column)' }
 *         bookingsCount: { type: integer, example: 12 }
 *         jobsDoneCount: { type: integer, example: 40 }
 *         revenue: { type: number, example: 8920.5, description: 'Completed booking payments for this trader' }
 *         rating:
 *           type: object
 *           properties:
 *             average: { type: number, example: 4.3 }
 *             reviewsCount: { type: integer, example: 78 }
 *         status: { type: string, enum: [ACTIVE, INACTIVE, PENDING, SUSPENDED], example: 'ACTIVE' }
 *         verificationStatus: { type: string, enum: [PENDING, VERIFIED, REJECTED, SUSPENDED], example: 'VERIFIED' }
 *         onboardingStatus: { type: string, example: 'APPROVED' }
 *         country: { type: string, nullable: true, example: 'Ireland' }
 *         city: { type: string, nullable: true, example: 'Dublin' }
 *         categories:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               name: { type: string, example: 'Plumbing Services' }
 *               categoryCode: { type: string, example: 'CAT-PLUMB' }
 *         profilePhotoUrl: { type: string, nullable: true }
 *         joinedAt: { type: string, format: date-time, example: '2025-01-08T10:00:00.000Z' }
 *     AdminTraderDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/AdminTraderListItem'
 *         - type: object
 *           properties:
 *             profile:
 *               type: object
 *               properties:
 *                 fullLegalName: { type: string, nullable: true }
 *                 businessName: { type: string, nullable: true }
 *                 ppsNumber: { type: string, nullable: true }
 *                 croNumber: { type: string, nullable: true }
 *                 vatNumber: { type: string, nullable: true }
 *                 directorFullName: { type: string, nullable: true }
 *                 bio: { type: string, nullable: true }
 *                 yearsExperience: { type: integer, nullable: true }
 *                 addressLine1: { type: string, nullable: true }
 *                 addressLine2: { type: string, nullable: true }
 *                 city: { type: string, nullable: true }
 *                 postcode: { type: string, nullable: true }
 *                 country: { type: string, nullable: true }
 *                 serviceRadiusKm: { type: integer, nullable: true }
 *                 serviceCenterLabel: { type: string, nullable: true }
 *             bankDetails:
 *               type: object
 *               properties:
 *                 bankHolderName: { type: string, nullable: true }
 *                 bankName: { type: string, nullable: true }
 *                 accountNumber: { type: string, nullable: true }
 *                 ifscCode: { type: string, nullable: true }
 *                 bankDetailsSkipped: { type: boolean }
 *             user:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 fullName: { type: string }
 *                 email: { type: string }
 *                 mobileNumber: { type: string }
 *                 status: { type: string }
 *             documentsCount: { type: integer, example: 3 }
 *             rejectionReason: { type: string, nullable: true }
 *             onboardingSubmittedAt: { type: string, format: date-time, nullable: true }
 *     AdminTraderStats:
 *       type: object
 *       properties:
 *         totalTraders: { type: integer, example: 15 }
 *         activeTraders: { type: integer, example: 11 }
 *         suspendedTraders: { type: integer, example: 1 }
 *         pendingVerification: { type: integer, example: 1 }
 *         totalRevenue: { type: number, example: 1234266.3 }
 *         avgRating: { type: number, example: 4.61 }
 *     ApiSuccessEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string }
 *         data: { type: object }
 *     ApiErrorEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         message: { type: string, example: 'Validation Error' }
 *         error:
 *           oneOf:
 *             - type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   field: { type: string, example: 'body.email' }
 *                   message: { type: string, example: 'Invalid email.' }
 *             - type: string
 */

/**
 * @swagger
 * /admin/traders/stats:
 *   get:
 *     summary: Traders Management KPI cards
 *     description: |
 *       Powers the six top cards on **Admin → Traders Management**:
 *       Total Traders, Active Traders, Suspended, Pending Verification, Total Revenue, Avg. Rating.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     message: { example: 'Trader directory stats retrieved successfully.' }
 *                     data:
 *                       $ref: '#/components/schemas/AdminTraderStats'
 *             example:
 *               success: true
 *               message: Trader directory stats retrieved successfully.
 *               data:
 *                 totalTraders: 15
 *                 activeTraders: 11
 *                 suspendedTraders: 1
 *                 pendingVerification: 1
 *                 totalRevenue: 1234266.3
 *                 avgRating: 4.61
 *       401:
 *         description: Missing/invalid admin token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }
 */
router.get('/traders/stats', controller.getStats);

/**
 * @swagger
 * /admin/traders:
 *   get:
 *     summary: List traders (table + filters)
 *     description: |
 *       Powers the Traders Management table.
 *       Search matches name, business, email, mobile, or trader code.
 *       Filters map to UI dropdowns: Status, Category, Verification, Country.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, example: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string, example: 'Book Nook' }
 *         description: Search by name, business, email, mobile, or trader code.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, PENDING, SUSPENDED] }
 *         description: Account status filter (All Statuses dropdown).
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: Filter by trade category UUID (All Categories dropdown).
 *       - in: query
 *         name: verification
 *         schema: { type: string, enum: [PENDING, VERIFIED, REJECTED, SUSPENDED] }
 *         description: Verification badge filter (All Verifications dropdown).
 *       - in: query
 *         name: country
 *         schema: { type: string, example: 'Ireland' }
 *         description: Country filter (All Countries dropdown).
 *     responses:
 *       200:
 *         description: Paginated trader rows for the table.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Traders retrieved successfully.' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     meta:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 15 }
 *                         page: { type: integer, example: 1 }
 *                         limit: { type: integer, example: 10 }
 *                         totalPages: { type: integer, example: 2 }
 *                     traders:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/AdminTraderListItem' }
 *             example:
 *               success: true
 *               message: Traders retrieved successfully.
 *               data:
 *                 meta: { total: 15, page: 1, limit: 10, totalPages: 2 }
 *                 traders:
 *                   - id: f0f8b572-de03-48d2-a080-34b8966082a6
 *                     traderCode: TRD-1001
 *                     businessName: The Book Nook
 *                     businessType: Individual
 *                     traderType: SOLO
 *                     contact:
 *                       email: clara.watts@thebooknook.com
 *                       mobileNumber: '+447867880123'
 *                       fullName: Clara Watts
 *                     listingsCount: 56
 *                     bookingsCount: 12
 *                     jobsDoneCount: 40
 *                     revenue: 8920.5
 *                     rating: { average: 4.3, reviewsCount: 78 }
 *                     status: INACTIVE
 *                     verificationStatus: VERIFIED
 *                     onboardingStatus: APPROVED
 *                     country: Ireland
 *                     city: Dublin
 *                     categories: [{ id: '3f0f23dd-dfa2-4606-9eed-acdc22534f0f', name: 'Plumbing Services', categoryCode: 'CAT-PLUMB' }]
 *                     profilePhotoUrl: null
 *                     joinedAt: '2025-01-08T10:00:00.000Z'
 *       400:
 *         description: Validation error on query params.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }
 *       401:
 *         description: Unauthorized.
 */
router.get('/traders', validate(traderFilterSchema), controller.listTraders);

/**
 * @swagger
 * /admin/traders:
 *   post:
 *     summary: Create trader (admin)
 *     description: |
 *       Creates a TRADER user + trader profile.
 *       Default login password is `Password1!` (same pattern as admin customer create).
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, mobileNumber]
 *             properties:
 *               fullName: { type: string, example: 'Clara Watts' }
 *               email: { type: string, example: 'clara.watts@thebooknook.com' }
 *               mobileNumber: { type: string, example: '+447867880123' }
 *               traderType: { type: string, enum: [SOLO, COMPANY], example: 'SOLO' }
 *               businessName: { type: string, example: 'The Book Nook' }
 *               fullLegalName: { type: string, example: 'Clara Watts' }
 *               country: { type: string, example: 'Ireland' }
 *               city: { type: string, example: 'Dublin' }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, PENDING, SUSPENDED], example: 'ACTIVE' }
 *               verificationStatus: { type: string, enum: [PENDING, VERIFIED, REJECTED, SUSPENDED], example: 'PENDING' }
 *               categoryIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 example: ['3f0f23dd-dfa2-4606-9eed-acdc22534f0f']
 *               profilePhotoUrl: { type: string, example: 'https://cdn.brisk.com/traders/clara.jpg' }
 *               yearsExperience: { type: integer, example: 5 }
 *               bio: { type: string, example: 'Independent bookseller and home repair specialist.' }
 *           example:
 *             fullName: Clara Watts
 *             email: clara.watts@thebooknook.com
 *             mobileNumber: '+447867880123'
 *             traderType: SOLO
 *             businessName: The Book Nook
 *             country: Ireland
 *             city: Dublin
 *             status: ACTIVE
 *             verificationStatus: PENDING
 *             categoryIds: ['3f0f23dd-dfa2-4606-9eed-acdc22534f0f']
 *     responses:
 *       201:
 *         description: Trader created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Trader created successfully. Default password: Password1!' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     trader: { $ref: '#/components/schemas/AdminTraderDetail' }
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }
 *             example:
 *               success: false
 *               message: Validation Error
 *               error:
 *                 - field: body.mobileNumber
 *                   message: 'Mobile must be E.164 (e.g. +353871234567).'
 *       401:
 *         description: Unauthorized.
 *       409:
 *         description: Email or mobile already exists.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: Email already exists.
 */
router.post('/traders', validate(createTraderSchema), controller.createTrader);

/**
 * @swagger
 * /admin/traders/{id}:
 *   get:
 *     summary: Get trader detail (View action)
 *     description: Full trader profile for the eye/view drawer or detail page.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Trader detail.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Trader profile retrieved successfully.' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     trader: { $ref: '#/components/schemas/AdminTraderDetail' }
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: Trader not found.
 */
router.get('/traders/:id', validate(traderIdParamSchema), controller.getTrader);

/**
 * @swagger
 * /admin/traders/{id}:
 *   patch:
 *     summary: Update trader (Edit action)
 *     description: Partial update of trader + linked user fields. Pass only fields to change.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
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
 *               fullName: { type: string, example: 'Clara Watts' }
 *               email: { type: string, example: 'clara.watts@thebooknook.com' }
 *               mobileNumber: { type: string, example: '+447867880123' }
 *               traderType: { type: string, enum: [SOLO, COMPANY] }
 *               businessName: { type: string, nullable: true, example: 'The Book Nook' }
 *               fullLegalName: { type: string, nullable: true }
 *               country: { type: string, nullable: true, example: 'Ireland' }
 *               city: { type: string, nullable: true }
 *               addressLine1: { type: string, nullable: true }
 *               addressLine2: { type: string, nullable: true }
 *               postcode: { type: string, nullable: true }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, PENDING, SUSPENDED] }
 *               verificationStatus: { type: string, enum: [PENDING, VERIFIED, REJECTED, SUSPENDED] }
 *               categoryIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               profilePhotoUrl: { type: string, nullable: true }
 *               yearsExperience: { type: integer }
 *               bio: { type: string, nullable: true }
 *               serviceRadiusKm: { type: integer, nullable: true }
 *           example:
 *             businessName: The Book Nook
 *             status: ACTIVE
 *             country: Ireland
 *             categoryIds: ['3f0f23dd-dfa2-4606-9eed-acdc22534f0f']
 *     responses:
 *       200:
 *         description: Updated trader.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Trader updated successfully.' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     trader: { $ref: '#/components/schemas/AdminTraderDetail' }
 *       400:
 *         description: Validation error (empty body or invalid fields).
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 *       409:
 *         description: Email/mobile conflict.
 */
router.patch('/traders/:id', validate(updateTraderSchema), controller.updateTrader);

/**
 * @swagger
 * /admin/traders/{id}/status:
 *   patch:
 *     summary: Update account status only
 *     description: |
 *       Quick status change for Active / Inactive / Pending / Suspended badges.
 *       Updates both `traders.status` and linked `users.status`.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [ACTIVE, INACTIVE, PENDING, SUSPENDED], example: 'SUSPENDED' }
 *           example:
 *             status: SUSPENDED
 *     responses:
 *       200:
 *         description: Status updated.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader status updated successfully.
 *               data:
 *                 trader:
 *                   id: f0f8b572-de03-48d2-a080-34b8966082a6
 *                   status: SUSPENDED
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.patch(
  '/traders/:id/status',
  validate(updateTraderStatusSchema),
  controller.updateTraderStatus
);

/**
 * @swagger
 * /admin/traders/{id}/verification:
 *   patch:
 *     summary: Update verification badge (shield action)
 *     description: |
 *       Quick verification update from the Traders Management table shield icon.
 *       For full onboarding document review queue, use **Admin / Trader Verification**
 *       (`GET/PATCH /admin/trader-verification/...`).
 *
 *       When `verificationStatus=VERIFIED`, existing trader sessions are invalidated
 *       (`tokenVersion` bump) so the app refreshes `nextStep`.
 *       When `REJECTED`, `rejectionReason` is required.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
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
 *             required: [verificationStatus]
 *             properties:
 *               verificationStatus: { type: string, enum: [PENDING, VERIFIED, REJECTED, SUSPENDED], example: 'VERIFIED' }
 *               rejectionReason: { type: string, example: 'Missing trade certificate' }
 *           examples:
 *             approve:
 *               value: { verificationStatus: VERIFIED }
 *             reject:
 *               value:
 *                 verificationStatus: REJECTED
 *                 rejectionReason: Missing trade certificate
 *     responses:
 *       200:
 *         description: Verification updated.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader verification updated successfully.
 *               data:
 *                 trader:
 *                   id: f0f8b572-de03-48d2-a080-34b8966082a6
 *                   verificationStatus: VERIFIED
 *       400:
 *         description: Validation error (e.g. missing rejectionReason).
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.patch(
  '/traders/:id/verification',
  validate(updateTraderVerificationSchema),
  controller.updateTraderVerification
);

/**
 * @swagger
 * /admin/traders/{id}:
 *   delete:
 *     summary: Delete trader (trash action)
 *     description: |
 *       Permanently deletes the trader user account (cascade removes trader profile).
 *       Irreversible — confirm in UI before calling.
 *     tags: ['Admin / Traders']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deleted.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Trader deleted successfully.
 *               data: null
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Trader not found.
 */
router.delete('/traders/:id', validate(traderIdParamSchema), controller.deleteTrader);

export default router;
