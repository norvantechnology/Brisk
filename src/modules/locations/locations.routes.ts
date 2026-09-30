import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './locations.controller';
import { publicCountiesQuerySchema, publicCountriesQuerySchema } from './locations.validation';

const router = Router();

/**
 * @swagger
 * /locations/countries:
 *   get:
 *     summary: Country dropdown — enabled countries (each with its enabled counties)
 *     tags: [Locations]
 *     description: |
 *       Public (no auth). Only countries/counties enabled by admin are returned, sorted by admin order then name.
 *       For a dependent County dropdown call `GET /locations/counties?countryId=` (or `countryCode=`) after a country is picked,
 *       or use the nested `counties` here. Store the country / county `name` in forms as today.
 *       `flag` = emoji string built from the ISO code (e.g. 🇮🇪) — render as text.
 *     parameters:
 *       - in: query
 *         name: countryCode
 *         schema: { type: string, example: IE }
 *         description: Optional — return one country only (ISO code, e.g. IE, GB)
 *     responses:
 *       200:
 *         description: Enabled countries.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Countries retrieved.
 *               data:
 *                 items:
 *                   - id: '3f1c9a52-8a3e-4d0b-9b6f-2c1e5d7a9b10'
 *                     code: IE
 *                     name: Ireland
 *                     flag: 🇮🇪
 *                     counties:
 *                       - { id: '9a8b7c6d-1111-4e2f-8a3b-4c5d6e7f8a9b', code: CW, name: Carlow }
 *                       - { id: '9a8b7c6d-2222-4e2f-8a3b-4c5d6e7f8a9b', code: DB, name: Dublin }
 *                   - id: '7d2e4b61-5c3f-4a8e-9d1b-6f0a2c4e8b20'
 *                     code: GB
 *                     name: United Kingdom
 *                     flag: 🇬🇧
 *                     counties:
 *                       - { id: '1b2c3d4e-3333-4f5a-9b6c-7d8e9f0a1b2c', code: AN, name: Antrim }
 *                 total: 2
 */
router.get('/countries', validate(publicCountriesQuerySchema), controller.listActiveCountries);

/**
 * @swagger
 * /locations/counties:
 *   get:
 *     summary: County dropdown — enabled counties for the selected country
 *     tags: [Locations]
 *     description: |
 *       Public (no auth). Send **one** of `countryId` (from `GET /locations/countries`) or `countryCode` (IE, GB).
 *       Returns only enabled counties, sorted by admin order then name.
 *     parameters:
 *       - in: query
 *         name: countryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: countryCode
 *         schema: { type: string, example: IE }
 *     responses:
 *       200:
 *         description: Counties of the country.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Counties retrieved.
 *               data:
 *                 country: { id: '3f1c9a52-8a3e-4d0b-9b6f-2c1e5d7a9b10', code: IE, name: Ireland, flag: 🇮🇪 }
 *                 items:
 *                   - { id: '9a8b7c6d-1111-4e2f-8a3b-4c5d6e7f8a9b', code: CW, name: Carlow }
 *                   - { id: '9a8b7c6d-2222-4e2f-8a3b-4c5d6e7f8a9b', code: DB, name: Dublin }
 *                 total: 26
 *       400:
 *         description: Neither countryId nor countryCode sent.
 *       404:
 *         description: Country not found or disabled by admin.
 */
router.get('/counties', validate(publicCountiesQuerySchema), controller.listActiveCounties);

export default router;
