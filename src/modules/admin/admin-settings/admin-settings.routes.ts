import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-settings.controller';
import {
  listPlatformSettingsSchema,
  platformSettingKeyParamsSchema,
  updatePlatformSettingsSchema,
} from './admin-settings.validation';

const router = Router();
router.use(adminAuthMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     PlatformSettingItem:
 *       type: object
 *       properties:
 *         key: { type: string, example: site_visit.default_fee }
 *         group: { type: string, example: SITE_VISIT }
 *         label: { type: string, example: Default Site Visit Fee }
 *         description: { type: string }
 *         type: { type: string, enum: [number, integer, boolean, string], description: Render input by type. }
 *         unit: { type: string, nullable: true, enum: [CURRENCY, KM, DAYS], description: CURRENCY uses top-level currencyCode. }
 *         min: { type: number, nullable: true }
 *         max: { type: number, nullable: true }
 *         maxLength: { type: integer, nullable: true }
 *         defaultValue: { oneOf: [{ type: number }, { type: boolean }, { type: string }] }
 *         value: { description: Effective value (admin override or default), oneOf: [{ type: number }, { type: boolean }, { type: string }] }
 *         isDefault: { type: boolean, description: true when admin has not overridden this setting. }
 *         updatedAt: { type: string, format: date-time, nullable: true }
 *         updatedBy:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             fullName: { type: string }
 *     PlatformSettingsGrouped:
 *       type: object
 *       properties:
 *         currencyCode: { type: string, example: EUR }
 *         groups:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               key: { type: string, example: SITE_VISIT }
 *               label: { type: string, example: Site Visit }
 *               description: { type: string }
 *               settings:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/PlatformSettingItem' }
 */

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     summary: List platform settings (grouped)
 *     description: |
 *       All admin-manageable platform/business settings with current value, default, type and limits.
 *       Build the form dynamically from `groups[].settings[]` (new settings appear automatically).
 *     tags: ['Admin / Settings']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: group
 *         schema: { type: string, enum: [SITE_VISIT, JOBS] }
 *     responses:
 *       200:
 *         description: Settings retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/PlatformSettingsGrouped' }
 *   patch:
 *     summary: Update one or more platform settings
 *     description: |
 *       Send only changed keys. Value `null` resets that key to its default.
 *       All-or-nothing: if any key is unknown/invalid, nothing is saved and `data.errors[]` lists each problem.
 *       Returns the full grouped list after save.
 *     tags: ['Admin / Settings']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [settings]
 *             properties:
 *               settings:
 *                 type: object
 *                 additionalProperties:
 *                   nullable: true
 *                   oneOf: [{ type: number }, { type: boolean }, { type: string }]
 *           example:
 *             settings:
 *               site_visit.default_fee: 25
 *               site_visit.booking_window_days: 14
 *               jobs.default_discover_radius_km: 40
 *     responses:
 *       200:
 *         description: Settings updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/PlatformSettingsGrouped' }
 *       400:
 *         description: INVALID_SETTINGS — `data.errors[]` = `{ key, message }`.
 */
router.get('/settings', validate(listPlatformSettingsSchema), controller.listSettings);
router.patch('/settings', validate(updatePlatformSettingsSchema), controller.updateSettings);

/**
 * @swagger
 * /admin/settings/{key}:
 *   get:
 *     summary: Get a single platform setting
 *     tags: ['Admin / Settings']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string, example: site_visit.default_fee }
 *     responses:
 *       200:
 *         description: "data: { currencyCode, setting: PlatformSettingItem }"
 *       404:
 *         description: SETTING_NOT_FOUND
 *   delete:
 *     summary: Reset a platform setting to its default
 *     tags: ['Admin / Settings']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string, example: site_visit.default_fee }
 *     responses:
 *       200:
 *         description: "data: { currencyCode, setting: PlatformSettingItem }"
 *       404:
 *         description: SETTING_NOT_FOUND
 */
router.get('/settings/:key', validate(platformSettingKeyParamsSchema), controller.getSetting);
router.delete('/settings/:key', validate(platformSettingKeyParamsSchema), controller.resetSetting);

export default router;
