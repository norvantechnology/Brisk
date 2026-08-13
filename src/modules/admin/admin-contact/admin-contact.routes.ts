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
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Name, email, phone, subject, or CNT-####
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [name, status, submittedAt, subject] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: dateFilter
 *         schema: { type: string, enum: [all, today, thisWeek, thisMonth] }
 *     responses:
 *       200:
 *         description: Paginated list in `data.submissions` with `data.meta`.
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
