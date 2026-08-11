import { Router } from 'express';
import * as surveyAdminController from './admin-surveys.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import {
  surveyFilterSchema,
  updateSurveyConsumerSchema,
  updateSurveyTraderSchema,
  idParamSchema,
} from '../admin-cms/admin-cms.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/surveys/consumer/stats:
 *   get:
 *     summary: Consumer survey — dashboard numbers (KPI cards)
 *     tags: ['Admin / Surveys']
 *     description: |
 *       **Who uses this:** Admin Panel → Survey Management → Consumer tab (top KPI cards).
 *
 *       **What it returns:** Counts — total signups, today's signups, and how many are NEW / PENDING / REVIEWED / CONTACTED / REJECTED.
 *
 *       **Login needed?** Yes — Admin JWT token required.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KPI numbers for consumer survey registrations.
 *       401:
 *         description: Admin not logged in or token expired.
 */
router.get('/consumer/stats', surveyAdminController.getConsumerStats);

/**
 * @swagger
 * /admin/surveys/consumer/export:
 *   get:
 *     summary: Consumer survey — download all signups as CSV
 *     tags: ['Admin / Surveys']
 *     description: |
 *       **Who uses this:** Admin Panel → Consumer tab → **Export CSV** button.
 *
 *       **What it does:** Downloads a spreadsheet file with all matching consumer signups (name, email, phone, country, consents, status, etc.).
 *
 *       **Login needed?** Yes — Admin JWT token required.
 *
 *       Supports the same filters as the list endpoint (search, status, country, age range, consent flags).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name, email, phone, or registration code (CS-####)
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED] }
 *         description: Filter by CRM status
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *         description: Filter by country
 *       - in: query
 *         name: county
 *         schema: { type: string }
 *         description: Filter by county (legacy / optional field)
 *       - in: query
 *         name: ageRange
 *         schema: { type: string }
 *         description: Filter by age range e.g. 18-29
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
 *         description: Sort by submission date (default newest first)
 *     responses:
 *       200:
 *         description: CSV file download.
 *       401:
 *         description: Admin not logged in or token expired.
 */
router.get('/consumer/export', validate(surveyFilterSchema), surveyAdminController.exportConsumers);

/**
 * @swagger
 * /admin/surveys/consumer:
 *   get:
 *     summary: Consumer survey — list all signups (table view)
 *     tags: ['Admin / Surveys']
 *     description: |
 *       **Who uses this:** Admin Panel → Survey Management → Consumer tab (main table).
 *
 *       **What it does:** Shows paginated list of everyone who submitted the consumer survey on the website.
 *       Each row has code CS-####, name, email, phone, country, consents, status, and submission date.
 *
 *       **Login needed?** Yes — Admin JWT token required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Rows per page (max 100)
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name, email, phone, or CS-#### code
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED] }
 *       - in: query
 *         name: country
 *         schema: { type: string }
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
 *         description: Paginated list of consumer survey registrations.
 *       401:
 *         description: Admin not logged in or token expired.
 */
router.get('/consumer', validate(surveyFilterSchema), surveyAdminController.listConsumers);

/**
 * @swagger
 * /admin/surveys/consumer/{id}:
 *   get:
 *     summary: Consumer survey — view one signup (detail popup)
 *     tags: ['Admin / Surveys']
 *     description: |
 *       **Who uses this:** Admin Panel → Consumer tab → click **View** on a row.
 *
 *       **What it does:** Returns full details for one consumer signup by database ID (UUID).
 *
 *       **Login needed?** Yes — Admin JWT token required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Registration UUID from the list response
 *     responses:
 *       200:
 *         description: Full registration detail including admin notes and reviewer info.
 *       404:
 *         description: Registration not found.
 */
router.get('/consumer/:id', validate(idParamSchema), surveyAdminController.getConsumer);

/**
 * @swagger
 * /admin/surveys/consumer/{id}:
 *   patch:
 *     summary: Consumer survey — update status or add notes
 *     tags: ['Admin / Surveys']
 *     description: |
 *       **Who uses this:** Admin Panel → Consumer tab → **Edit** / status change on a row.
 *
 *       **What it does:** Lets admin staff mark a signup as REVIEWED, CONTACTED, REJECTED, etc. and add internal CRM notes.
 *
 *       **Login needed?** Yes — Admin JWT token required.
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
 *               status:
 *                 type: string
 *                 enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED]
 *                 description: CRM follow-up status
 *               notes:
 *                 type: string
 *                 description: Internal admin notes (not shown to the user)
 *     responses:
 *       200:
 *         description: Registration updated successfully.
 *       404:
 *         description: Registration not found.
 */
router.patch('/consumer/:id', validate(updateSurveyConsumerSchema), surveyAdminController.updateConsumer);

/**
 * @swagger
 * /admin/surveys/trader/stats:
 *   get:
 *     summary: Trader survey — dashboard numbers (KPI cards)
 *     tags: ['Admin / Surveys']
 *     description: |
 *       **Who uses this:** Admin Panel → Survey Management → Trader tab (top KPI cards).
 *
 *       **What it returns:** Counts — total trader signups, today's signups, and status breakdown (NEW / PENDING / REVIEWED / CONTACTED / REJECTED).
 *
 *       **Login needed?** Yes — Admin JWT token required.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KPI numbers for trader survey registrations.
 *       401:
 *         description: Admin not logged in or token expired.
 */
router.get('/trader/stats', surveyAdminController.getTraderStats);

/**
 * @swagger
 * /admin/surveys/trader/export:
 *   get:
 *     summary: Trader survey — download all signups as CSV
 *     tags: ['Admin / Surveys']
 *     description: |
 *       **Who uses this:** Admin Panel → Trader tab → **Export CSV** button.
 *
 *       **What it does:** Downloads a spreadsheet with all matching trader signups (name, company, email, phone, country, website, consents, status).
 *
 *       **Login needed?** Yes — Admin JWT token required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name, company, email, phone, or TS-#### code
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED] }
 *       - in: query
 *         name: country
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
 *         description: Admin not logged in or token expired.
 */
router.get('/trader/export', validate(surveyFilterSchema), surveyAdminController.exportTraders);

/**
 * @swagger
 * /admin/surveys/trader:
 *   get:
 *     summary: Trader survey — list all signups (table view)
 *     tags: ['Admin / Surveys']
 *     description: |
 *       **Who uses this:** Admin Panel → Survey Management → Trader tab (main table).
 *
 *       **What it does:** Shows paginated list of tradespersons who submitted the trader survey on the website.
 *       Each row has code TS-####, name, company, email, phone, country, consents, status.
 *
 *       **Login needed?** Yes — Admin JWT token required.
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
 *         description: Search by name, company, email, phone, or TS-#### code
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED] }
 *       - in: query
 *         name: country
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
 *         description: Paginated list of trader survey registrations.
 *       401:
 *         description: Admin not logged in or token expired.
 */
router.get('/trader', validate(surveyFilterSchema), surveyAdminController.listTraders);

/**
 * @swagger
 * /admin/surveys/trader/{id}:
 *   get:
 *     summary: Trader survey — view one signup (detail popup)
 *     tags: ['Admin / Surveys']
 *     description: |
 *       **Who uses this:** Admin Panel → Trader tab → click **View** on a row.
 *
 *       **What it does:** Returns full details for one trader signup by database ID (UUID).
 *
 *       **Login needed?** Yes — Admin JWT token required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Full registration detail including company info and admin notes.
 *       404:
 *         description: Registration not found.
 */
router.get('/trader/:id', validate(idParamSchema), surveyAdminController.getTrader);

/**
 * @swagger
 * /admin/surveys/trader/{id}:
 *   patch:
 *     summary: Trader survey — update status or add notes
 *     tags: ['Admin / Surveys']
 *     description: |
 *       **Who uses this:** Admin Panel → Trader tab → **Edit** / status change on a row.
 *
 *       **What it does:** Lets admin mark a trader signup as REVIEWED, CONTACTED, REJECTED, etc. and add internal notes.
 *
 *       **Login needed?** Yes — Admin JWT token required.
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
 *               status:
 *                 type: string
 *                 enum: [NEW, PENDING, REVIEWED, CONTACTED, REJECTED]
 *               notes:
 *                 type: string
 *                 description: Internal admin notes
 *     responses:
 *       200:
 *         description: Registration updated successfully.
 *       404:
 *         description: Registration not found.
 */
router.patch('/trader/:id', validate(updateSurveyTraderSchema), surveyAdminController.updateTrader);

export default router;
