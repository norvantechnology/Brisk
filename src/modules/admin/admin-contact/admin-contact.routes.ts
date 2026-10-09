import { Router } from 'express';
import * as adminContactController from './admin-contact.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import {
  contactFilterSchema,
  updateContactSubmissionSchema,
  contactIdParamSchema,
} from '../../contact/contact.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/cms/contact-submissions/stats:
 *   get:
 *     summary: Contact Us — dashboard KPI counts
 *     tags: ['Admin / Website / Contact']
 *     security:
 *       - bearerAuth: []
 *     description: Total submissions, today's count, and status breakdown (NEW, PENDING, REVIEWED, CONTACTED, REJECTED).
 *     responses:
 *       200:
 *         description: Flat stats in `data`.
 */
router.get('/contact-submissions/stats', adminContactController.getStats);

/**
 * @swagger
 * /admin/cms/contact-submissions/export:
 *   get:
 *     summary: Contact Us — export submissions as CSV
 *     tags: ['Admin / Website / Contact']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search name, email, phone, subject, or CNT-#### reference
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED] }
 *       - in: query
 *         name: dateFilter
 *         schema: { type: string, enum: [all, today, thisWeek, thisMonth] }
 *     responses:
 *       200:
 *         description: CSV file download.
 */
router.get(
  '/contact-submissions/export',
  validate(contactFilterSchema),
  adminContactController.exportSubmissions
);

/**
 * @swagger
 * /admin/cms/contact-submissions:
 *   get:
 *     summary: List Contact Us submissions (admin CRM table)
 *     tags: ['Admin / Website / Contact']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AdminPage'
 *       - $ref: '#/components/parameters/AdminLimit'
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Name, email, phone, subject, or CNT-####
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED] }
 *       - in: query
 *         name: dateFilter
 *         schema: { type: string, enum: [all, today, thisWeek, thisMonth] }
 *       - in: query
 *         name: submittedFrom
 *         schema: { type: string, example: '2026-09-01T00:00:00.000Z' }
 *       - in: query
 *         name: submittedTo
 *         schema: { type: string, example: '2026-09-30T23:59:59.999Z' }
 *       - in: query
 *         name: sortBy
 *         description: '`name` = full name, `reviewedBy` = admin full name. Default newest submitted first.'
 *         schema: { type: string, enum: [referenceCode, name, email, phone, subject, status, reviewedBy, submittedAt, updatedAt], default: submittedAt }
 *       - in: query
 *         name: sortOrder
 *         description: Default `desc` for dates, `asc` for text columns.
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, oldest] }
 *         description: Legacy submittedAt order — ignored when `sortBy` is sent.
 *     responses:
 *       200:
 *         description: Paginated list in `data.submissions` with `data.meta`.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Contact submissions retrieved successfully.
 *               data:
 *                 meta: { total: 18, page: 1, limit: 10, totalPages: 2 }
 *                 submissions:
 *                   - id: 92a3b4c5-0000-4000-8000-000000000090
 *                     referenceCode: CNT-0018
 *                     fullName: Aoife Kelly
 *                     email: aoife@example.com
 *                     phone: '+353861234567'
 *                     subject: Partnership enquiry
 *                     message: We would like to list our services on Brisk.
 *                     agreementAccepted: true
 *                     status: REVIEWED
 *                     notes: Called back on Monday.
 *                     submittedAt: '2026-09-28T10:00:00.000Z'
 *                     reviewedById: 0f1e2d3c-0000-4000-8000-000000000001
 *                     userEmailSent: true
 *                     adminEmailSent: true
 *                     createdAt: '2026-09-28T10:00:00.000Z'
 *                     updatedAt: '2026-09-29T08:00:00.000Z'
 *                     reviewedBy: { id: 0f1e2d3c-0000-4000-8000-000000000001, fullName: Snehal Patel, email: admin@brisk.ie }
 *       400: { $ref: '#/components/responses/AdminListValidationError' }
 *       401: { $ref: '#/components/responses/AdminUnauthorized' }
 */
router.get(
  '/contact-submissions',
  validate(contactFilterSchema),
  adminContactController.listSubmissions
);

/**
 * @swagger
 * /admin/cms/contact-submissions/{id}:
 *   get:
 *     summary: Get one Contact Us submission
 *     tags: ['Admin / Website / Contact']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Full submission in flat `data`.
 *       404:
 *         description: Not found.
 *   patch:
 *     summary: Update Contact Us submission status / admin notes
 *     tags: ['Admin / Website / Contact']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED] }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Updated submission in flat `data`.
 */
router.get(
  '/contact-submissions/:id',
  validate(contactIdParamSchema),
  adminContactController.getSubmission
);

router.patch(
  '/contact-submissions/:id',
  validate(updateContactSubmissionSchema),
  adminContactController.updateSubmission
);

export default router;
