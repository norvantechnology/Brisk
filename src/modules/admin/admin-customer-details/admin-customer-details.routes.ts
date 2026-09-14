import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-customer-details.controller';
import {
  customerActivityQuerySchema,
  customerAddressesQuerySchema,
  customerChatThreadParamSchema,
  customerChatsQuerySchema,
  customerDetailsIdParamSchema,
  customerJobIdParamSchema,
  customerJobsQuerySchema,
  customerNotificationsQuerySchema,
  customerOffersQuerySchema,
  customerPaymentsQuerySchema,
  customerReviewsQuerySchema,
} from './admin-customer-details.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * tags:
 *   - name: Admin / Customer Details
 *     description: |
 *       Nested APIs for Customer Details tabs (Overview KPIs, Addresses, Jobs, Payments,
 *       Offers, Reviews, Notifications, Activity, Chats). Profile CRUD stays on
 *       GET/PATCH /admin/customers/{id}. Auth: admin Bearer.
 */

/**
 * @swagger
 * /admin/customers/{id}/stats:
 *   get:
 *     summary: Customer details overview KPIs
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/stats',
  validate(customerDetailsIdParamSchema),
  controller.getStats
);

/**
 * @swagger
 * /admin/customers/{id}/verification:
 *   get:
 *     summary: Email/phone verification + deletion request summary
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/verification',
  validate(customerDetailsIdParamSchema),
  controller.getVerification
);

/**
 * @swagger
 * /admin/customers/{id}/addresses:
 *   get:
 *     summary: List saved addresses for a customer
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: addressType
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, city, addressType] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 */
router.get(
  '/customers/:id/addresses',
  validate(customerAddressesQuerySchema),
  controller.listAddresses
);

/**
 * @swagger
 * /admin/customers/{id}/jobs/stats:
 *   get:
 *     summary: Customer jobs status breakdown
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/jobs/stats',
  validate(customerDetailsIdParamSchema),
  controller.getJobsStats
);

/**
 * @swagger
 * /admin/customers/{id}/jobs:
 *   get:
 *     summary: List customer jobs / bookings
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, QUOTED, ACCEPTED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, PAYMENT_PENDING]
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, scheduledDate, status, title] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/jobs',
  validate(customerJobsQuerySchema),
  controller.listJobs
);

/**
 * @swagger
 * /admin/customers/{id}/jobs/{jobId}:
 *   get:
 *     summary: Customer job detail (drawer payload)
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/jobs/:jobId',
  validate(customerJobIdParamSchema),
  controller.getJob
);

/**
 * @swagger
 * /admin/customers/{id}/payments/stats:
 *   get:
 *     summary: Customer payments KPIs
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/payments/stats',
  validate(customerDetailsIdParamSchema),
  controller.getPaymentsStats
);

/**
 * @swagger
 * /admin/customers/{id}/payments:
 *   get:
 *     summary: List customer payments / transactions
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, COMPLETED, FAILED] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, amount, status, paidAt] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/payments',
  validate(customerPaymentsQuerySchema),
  controller.listPayments
);

/**
 * @swagger
 * /admin/customers/{id}/refunds:
 *   get:
 *     summary: List customer refunds
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, amount, status] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/refunds',
  validate(customerPaymentsQuerySchema),
  controller.listRefunds
);

/**
 * @swagger
 * /admin/customers/{id}/offers/stats:
 *   get:
 *     summary: Customer offer claims KPIs
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/offers/stats',
  validate(customerDetailsIdParamSchema),
  controller.getOffersStats
);

/**
 * @swagger
 * /admin/customers/{id}/offers:
 *   get:
 *     summary: List customer claimed / used offers
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string, enum: [ALL, CLAIMED, USED, EXPIRED, CANCELLED] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [CLAIMED, USED, EXPIRED, CANCELLED] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [claimedAt, usedAt, status] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/offers',
  validate(customerOffersQuerySchema),
  controller.listOffers
);

/**
 * @swagger
 * /admin/customers/{id}/reviews/stats:
 *   get:
 *     summary: Customer reviews average + star distribution
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/customers/:id/reviews/stats',
  validate(customerDetailsIdParamSchema),
  controller.getReviewsStats
);

/**
 * @swagger
 * /admin/customers/{id}/reviews:
 *   get:
 *     summary: List reviews given by customer
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: stars
 *         schema: { type: string, enum: ['1', '2', '3', '4', '5'] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, stars] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/reviews',
  validate(customerReviewsQuerySchema),
  controller.listReviews
);

/**
 * @swagger
 * /admin/customers/{id}/notifications:
 *   get:
 *     summary: List customer notifications
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: read
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/notifications',
  validate(customerNotificationsQuerySchema),
  controller.listNotifications
);

/**
 * @swagger
 * /admin/customers/{id}/notifications/read-all:
 *   patch:
 *     summary: Mark all customer notifications as read
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.patch(
  '/customers/:id/notifications/read-all',
  validate(customerDetailsIdParamSchema),
  controller.markNotificationsRead
);

/**
 * @swagger
 * /admin/customers/{id}/activity:
 *   get:
 *     summary: Customer activity timeline (audit logs)
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: eventType
 *         schema: { type: string }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/activity',
  validate(customerActivityQuerySchema),
  controller.listActivity
);

/**
 * @swagger
 * /admin/customers/{id}/chats:
 *   get:
 *     summary: List customer chat conversations (grouped by job)
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 */
router.get(
  '/customers/:id/chats',
  validate(customerChatsQuerySchema),
  controller.listChats
);

/**
 * @swagger
 * /admin/customers/{id}/chats/{jobId}:
 *   get:
 *     summary: Customer chat thread for a job
 *     tags: ['Admin / Customer Details']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 */
router.get(
  '/customers/:id/chats/:jobId',
  validate(customerChatThreadParamSchema),
  controller.getChatThread
);

export default router;
