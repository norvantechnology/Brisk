import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './locations.controller';
import { publicCountriesQuerySchema } from './locations.validation';

const router = Router();

/**
 * @swagger
 * /locations/countries:
 *   get:
 *     summary: Enabled countries with enabled counties (for Country / County dropdowns)
 *     tags: [Locations]
 *     description: |
 *       Public. Only countries and counties enabled by admin are returned — use this instead of hardcoded lists.
 *       Store the county `name` (and country `name`) in forms as today.
 *     parameters:
 *       - in: query
 *         name: countryCode
 *         schema: { type: string, example: IE }
 *         description: Optional — return one country only (ISO code, e.g. IE, GB)
 *     responses:
 *       200:
 *         description: '`data.items[] = { id, code, name, counties: [{ id, code, name }] }` + `data.total`'
 */
router.get('/countries', validate(publicCountriesQuerySchema), controller.listActiveCountries);

export default router;
