import { Router } from 'express';
import * as cmsController from './cms.controller';

/** @deprecated Prefer GET /cms/testimonials?audience=CUSTOMER|TRADER|BOTH&limit=N */
const router = Router();

/**
 * @swagger
 * /testimonials:
 *   get:
 *     deprecated: true
 *     summary: "[Deprecated] List testimonials — use GET /cms/testimonials"
 *     tags: ['Website / Content']
 *     description: |
 *       **Deprecated.** Use the standard endpoint:
 *       `GET /cms/testimonials?audience=CUSTOMER|TRADER|BOTH&limit=N`
 *
 *       This path remains as a temporary alias (same handler / same response).
 *     parameters:
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *         description: Same as `/cms/testimonials` — CUSTOMER→customer+BOTH, TRADER→trader+BOTH, BOTH→BOTH only.
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [customer, trader, home] }
 *         description: Legacy alias for audience (`home` → BOTH). Prefer `audience`.
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [published, draft] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         description: data.items[] testimonial cards.
 */
router.get('/', cmsController.getTestimonials);

export default router;
