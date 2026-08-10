import { Router } from 'express';
import * as surveyAdminController from './admin-surveys.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import {
  surveyFilterSchema,
  updateSurveyConsumerSchema,
  idParamSchema,
} from '../admin-cms/admin-cms.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/surveys/consumer/stats:
 *   get:
 *     summary: Survey consumer registration KPI cards
 *     tags: ['Admin / Surveys']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved (total, today, new, pending, reviewed, contacted, rejected).
 *       401:
 *         description: Missing or invalid Admin JWT token.
 */
router.get('/consumer/stats', surveyAdminController.getConsumerStats);

/**
 * @swagger
 * /admin/surveys/consumer/export:
 *   get:
 *     summary: Export survey consumer registrations as CSV
 *     tags: ['Admin / Surveys']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name, email, or phone.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED] }
 *       - in: query
 *         name: county
 *         schema: { type: string }
 *       - in: query
 *         name: ageRange
 *         schema: { type: string }
 *       - in: query
 *         name: consentLaunchUpdates
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: consentMarketing
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: consentPartnerComm
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, oldest] }
 *     responses:
 *       200:
 *         description: CSV file download.
 *       401:
 *         description: Missing or invalid Admin JWT token.
 */
router.get('/consumer/export', validate(surveyFilterSchema), surveyAdminController.exportConsumers);

/**
 * @swagger
 * /admin/surveys/consumer:
 *   get:
 *     summary: List survey consumer registrations
 *     tags: ['Admin / Surveys']
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
 *         description: Search by name, email, or phone.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED] }
 *       - in: query
 *         name: county
 *         schema: { type: string }
 *       - in: query
 *         name: ageRange
 *         schema: { type: string }
 *       - in: query
 *         name: consentLaunchUpdates
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: consentMarketing
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: consentPartnerComm
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, oldest] }
 *     responses:
 *       200:
 *         description: Paginated consumer registrations.
 *       401:
 *         description: Missing or invalid Admin JWT token.
 */
router.get('/consumer', validate(surveyFilterSchema), surveyAdminController.listConsumers);

/**
 * @swagger
 * /admin/surveys/consumer/{id}:
 *   get:
 *     summary: Get survey consumer registration by ID
 *     tags: ['Admin / Surveys']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Registration detail retrieved.
 *       404:
 *         description: Registration not found.
 */
router.get('/consumer/:id', validate(idParamSchema), surveyAdminController.getConsumer);

/**
 * @swagger
 * /admin/surveys/consumer/{id}:
 *   patch:
 *     summary: Update survey consumer status and CRM notes
 *     tags: ['Admin / Surveys']
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
 *               status: { type: string, enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED] }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Registration updated.
 *       404:
 *         description: Registration not found.
 */
router.patch('/consumer/:id', validate(updateSurveyConsumerSchema), surveyAdminController.updateConsumer);

export default router;
