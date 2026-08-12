import { Router } from 'express';
import * as pageSectionsController from './page-sections.controller';
import { validate } from '../../middlewares/validate.middleware';
import { pageSlugParamSchema, pageSlugSectionKeyParamsSchema } from './page-sections.validation';

/** FE primary paths: GET /pages/customers, GET /pages/traders */
const router = Router();

/**
 * @swagger
 * /pages/{pageSlug}:
 *   get:
 *     summary: Get full marketing page (Customers or Traders) — primary FE path
 *     tags: ['Website / Content']
 *     description: |
 *       **Use on:** For Customers page, For Traders page (website).
 *
 *       **Auth:** Not required.
 *
 *       **Preferred over:** `GET /cms/marketing-pages/{pageSlug}` — same data; use `/pages/...` in frontend.
 *
 *       **pageSlug values:**
 *       - `customers` — hero, why-customers, journey, peace-of-mind, app-download
 *       - `traders` — trader_hero, trader_benefits, trader_workflow, professional_potential, trader_cta
 *
 *       **Reviews:** Not in this response — use `GET /testimonials?type=customer` or `type=trader`.
 *
 *       **Header/footer:** Use `GET /cms/bootstrap?audience=customer` or `audience=trader`.
 *     parameters:
 *       - in: path
 *         name: pageSlug
 *         required: true
 *         schema: { type: string, enum: [customers, traders], example: customers }
 *         description: |
 *           **Purpose:** Select which marketing landing page to load.
 *           **customers** — For Customers website page.
 *           **traders** — For Traders website page.
 *           **Example:** `GET /pages/customers`
 *     responses:
 *       200:
 *         description: |
 *           `data.page` — slug, title, status.
 *           `data.sections[]` — ordered sections; each has `section_key`, `section_type`, buttons, `items[]` for cards/steps.
 *           Response uses snake_case field names.
 *       404:
 *         description: Page slug not found or not seeded.
 */
router.get(
  '/:pageSlug',
  validate(pageSlugParamSchema),
  pageSectionsController.getMarketingPage
);

/**
 * @swagger
 * /pages/{pageSlug}/sections/{sectionKey}:
 *   get:
 *     summary: Get one marketing page section (optional lazy-load)
 *     tags: ['Website / Content']
 *     description: |
 *       **Use on:** Lazy-load a single section instead of the full page (optional — full page via `GET /pages/{pageSlug}` is preferred).
 *
 *       **Auth:** Not required.
 *
 *       **Common sectionKey values (customers):** `hero`, `why-customers`, `journey`, `peace-of-mind`, `app-download`
 *       **Common sectionKey values (traders):** `trader_hero`, `trader_benefits`, `trader_workflow`, `professional_potential`, `trader_cta`
 *     parameters:
 *       - in: path
 *         name: pageSlug
 *         required: true
 *         schema: { type: string, enum: [customers, traders], example: customers }
 *         description: |
 *           **Purpose:** Parent page — must match the page that owns this section.
 *           **Example:** `customers` for hero section on Customers page.
 *       - in: path
 *         name: sectionKey
 *         required: true
 *         schema: { type: string, example: hero }
 *         description: |
 *           **Purpose:** Unique section identifier within the page (from `section_key` in full page response).
 *           **How to use:** Copy exact key from CMS — e.g. `hero`, `why-customers`, `trader_hero`.
 *           **Example:** `GET /pages/customers/sections/hero`
 *     responses:
 *       200:
 *         description: Single section object in `data` with `items[]` when applicable.
 *       404:
 *         description: Page or section not found / not published.
 */
router.get(
  '/:pageSlug/sections/:sectionKey',
  validate(pageSlugSectionKeyParamsSchema),
  pageSectionsController.getPageSection
);

export default router;
