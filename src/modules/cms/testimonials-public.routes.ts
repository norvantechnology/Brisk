import { Router } from 'express';
import * as cmsController from './cms.controller';

/** FE primary path: GET /testimonials?type=customer */
const router = Router();

/**
 * @swagger
 * /testimonials:
 *   get:
 *     summary: List published testimonials (Customers / Traders page reviews)
 *     tags: ['Website / Content']
 *     description: |
 *       **Use on:** Reviews carousel on For Customers page or For Traders page.
 *
 *       **Auth:** Not required.
 *
 *       **Primary filter:** `type=customer` or `type=trader` — matches the page you are building.
 *
 *       **Alias:** Same handler as `GET /cms/testimonials` — prefer `/testimonials` in frontend.
 *
 *       **Response fields (snake_case):** `name`, `role`, `type`, `rating`, `review`, `avatar`, `is_verified`, `sort_order`
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [customer, trader, home] }
 *         description: |
 *           **Purpose:** Filter reviews for the page you are rendering.
 *           **customer** — For Customers page reviews section.
 *           **trader** — For Traders page reviews section.
 *           **home** — Homepage featured reviews.
 *           **Example:** `GET /testimonials?type=customer`
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *         description: |
 *           **Purpose:** Optional legacy audience filter (prefer `type` for page-specific reviews).
 *           **When to use:** Bootstrap or mixed layouts that need audience-scoped testimonials.
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *         description: |
 *           **Purpose:** Return only admin-marked featured testimonials.
 *           **When to use:** Homepage spotlight or "Featured reviews" widget.
 *           **Example:** `GET /testimonials?type=customer&featured=true`
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [published, draft] }
 *         description: |
 *           **Purpose:** Filter by publish status. Public site should use `published` (default behaviour returns published only).
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *         description: |
 *           **Purpose:** Cap number of testimonials returned (e.g. carousel showing top 5).
 *           **Example:** `GET /testimonials?type=trader&limit=5`
 *     responses:
 *       200:
 *         description: |
 *           `data.items[]` — testimonial cards ordered by `sort_order`.
 *           Empty array is valid when no testimonials seeded for that type.
 */
router.get('/', cmsController.getTestimonials);

export default router;
