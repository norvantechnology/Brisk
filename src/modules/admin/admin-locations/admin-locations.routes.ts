import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import * as controller from '../../locations/locations.controller';
import {
  adminCountriesQuerySchema,
  createCountrySchema,
  createCountySchema,
  updateCountrySchema,
  updateCountySchema,
} from '../../locations/locations.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/locations/countries:
 *   get:
 *     summary: All countries with all counties (enabled + disabled)
 *     tags: ['Admin / Locations']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: |
 *           `data.items[] = { id, code, name, isActive, sortOrder, updatedAt, countiesTotal, countiesActive,
 *           counties: [{ id, code, name, isActive, sortOrder }] }`
 *   post:
 *     summary: Add a country
 *     tags: ['Admin / Locations']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name]
 *             properties:
 *               code: { type: string, example: FR, description: 'ISO 3166-1 alpha-2' }
 *               name: { type: string, example: France }
 *               isActive: { type: boolean, default: true }
 *               sortOrder: { type: integer, default: 0 }
 *     responses:
 *       201: { description: Created. }
 *       409: { description: 'LOCATION_EXISTS' }
 */
router.get('/locations/countries', validate(adminCountriesQuerySchema), controller.adminListCountries);
router.post('/locations/countries', validate(createCountrySchema), controller.adminCreateCountry);

/**
 * @swagger
 * /admin/locations/countries/{countryId}:
 *   patch:
 *     summary: Enable / disable (or rename, reorder) a country
 *     tags: ['Admin / Locations']
 *     security:
 *       - bearerAuth: []
 *     description: A disabled country (and all its counties) is hidden from GET /locations/countries.
 *     parameters:
 *       - in: path
 *         name: countryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive: { type: boolean, example: false }
 *               name: { type: string }
 *               sortOrder: { type: integer }
 *     responses:
 *       200: { description: Updated. }
 *       404: { description: Not found. }
 */
router.patch(
  '/locations/countries/:countryId',
  validate(updateCountrySchema),
  controller.adminUpdateCountry
);

/**
 * @swagger
 * /admin/locations/countries/{countryId}/counties:
 *   post:
 *     summary: Add a county to a country
 *     tags: ['Admin / Locations']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: countryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Dublin }
 *               code: { type: string, example: DB }
 *               isActive: { type: boolean, default: true }
 *               sortOrder: { type: integer, default: 0 }
 *     responses:
 *       201: { description: Created. }
 *       409: { description: 'LOCATION_EXISTS' }
 */
router.post(
  '/locations/countries/:countryId/counties',
  validate(createCountySchema),
  controller.adminCreateCounty
);

/**
 * @swagger
 * /admin/locations/counties/{countyId}:
 *   patch:
 *     summary: Enable / disable (or rename, reorder) a county
 *     tags: ['Admin / Locations']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: countyId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive: { type: boolean, example: false }
 *               name: { type: string }
 *               code: { type: string, nullable: true }
 *               sortOrder: { type: integer }
 *     responses:
 *       200: { description: Updated. }
 *       404: { description: Not found. }
 */
router.patch('/locations/counties/:countyId', validate(updateCountySchema), controller.adminUpdateCounty);

export default router;
