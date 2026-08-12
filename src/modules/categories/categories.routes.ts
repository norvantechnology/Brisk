import { Router } from 'express';
import * as categoriesController from './categories.controller';
import { validate } from '../../middlewares/validate.middleware';
import {
  appCategoryListSchema,
  appSubcategoryListSchema,
  idParamSchema,
  slugParamSchema,
} from './categories.validation';

export const categoriesRouter = Router();
export const subcategoriesRouter = Router();

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: List all active service categories (Customer / Trader app)
 *     tags: ['Mobile / Categories']
 *     description: |
 *       **Use on:** Home screen category grid, post-job "pick a trade" step, trader profile category picker.
 *
 *       **Auth:** Not required.
 *
 *       **Pagination:** None — full list is returned in `data` (no `meta`, no `page`/`limit`).
 *
 *       **Response fields (each item in `data`):**
 *       - **iconName** — Text icon identifier set by admin (e.g. `Wrench`, `Zap`). Map this to a local app icon when `iconUrl` is null.
 *       - **iconUrl** — Full image URL when admin uploaded/pasted a URL in `iconName` or when `bannerImageUrl` is set; otherwise `null`.
 *       - **bannerImageUrl** — Optional banner/card image URL from admin.
 *       - **urlSlug** — SEO slug (e.g. `plumbing-services`); use with `GET /categories/slug/{slug}`.
 *       - **subcategories** — Only present when `includeSubcategories=true` (nested sub-category list with job-post flags).
 *     parameters:
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *         description: |
 *           **Purpose:** Show only featured categories on homepage or "Popular services" section.
 *           **How to use:** Pass `featured=true` to get admin-marked featured categories only; omit for all active categories.
 *           **Example:** `GET /categories?featured=true`
 *       - in: query
 *         name: includeSubcategories
 *         schema: { type: string, enum: [true, false, 1, 0] }
 *         description: |
 *           **Purpose:** Avoid a second API call by nesting sub-categories under each category.
 *           **When to use:** Post-job flow step 1 — load categories + sub-categories in one request.
 *           **When not to use:** Simple category picker that loads sub-categories separately via `GET /sub-categories?categoryId=`.
 *           **Nested fields:** Each sub-category includes `siteVisitEnabled`, `priceEnabled`, `priceEnteredBy`, `qaFormSchema`.
 *           **Example:** `GET /categories?includeSubcategories=true`
 *     responses:
 *       200:
 *         description: |
 *           `data` = array of category objects (snake_case not used; camelCase).
 *           No `meta` object.
 */
categoriesRouter.get('/', validate(appCategoryListSchema), categoriesController.listCategories);

/**
 * @swagger
 * /categories/slug/{slug}:
 *   get:
 *     summary: Get one active category by URL slug (with nested sub-categories)
 *     tags: ['Mobile / Categories']
 *     description: |
 *       **Use on:** Deep links, SEO URLs, or when you only have the slug from a previous screen.
 *
 *       **Auth:** Not required.
 *
 *       Same category object as list/detail, always includes nested active **subcategories** with job-post flags.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string, example: plumbing-services }
 *         description: |
 *           **Purpose:** Look up a category by its public URL slug (from `urlSlug` on the category object).
 *           **How to use:** Copy `urlSlug` from list response — e.g. `plumbing-services` → `GET /categories/slug/plumbing-services`.
 *           **Not the same as:** `categoryCode` (internal code like `CAT-PLUMB`) or UUID `id`.
 *     responses:
 *       200:
 *         description: Single category object in `data` with nested `subcategories`.
 *       404:
 *         description: Category not found or inactive.
 */
categoriesRouter.get('/slug/:slug', validate(slugParamSchema), categoriesController.getCategoryBySlug);

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Get one active category by UUID (with nested sub-categories)
 *     tags: ['Mobile / Categories']
 *     description: |
 *       **Use on:** After user taps a category card when you stored the category `id` from the list.
 *
 *       **Auth:** Not required.
 *
 *       Returns full category + all active sub-categories with **siteVisitEnabled**, **priceEnabled**, **priceEnteredBy**, **qaFormSchema**.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: |
 *           **Purpose:** Fetch one category when you have its UUID from `GET /categories` list.
 *           **How to use:** Pass the `id` field from the category object selected by the user.
 *           **Example:** `GET /categories/536b6e62-36a7-4356-94c0-935b1653aa57`
 *     responses:
 *       200:
 *         description: Single category object in `data` with nested `subcategories`.
 *       404:
 *         description: Category not found or inactive.
 */
categoriesRouter.get('/:id', validate(idParamSchema), categoriesController.getCategory);

/**
 * @swagger
 * /sub-categories:
 *   get:
 *     summary: List all active sub-categories (job-post flags + Q&A form)
 *     tags: ['Mobile / Categories']
 *     description: |
 *       **Use on:** Post-job step 2 — after user picks a category, show sub-services for that trade.
 *
 *       **Auth:** Not required.
 *
 *       **Pagination:** None — full matching list in `data` (no `meta`).
 *
 *       **Key response fields:**
 *       - **siteVisitEnabled** — If `true`, show site-visit scheduling UI on job post.
 *       - **priceEnabled** — If `true`, show price field on job post.
 *       - **priceEnteredBy** — `CUSTOMER` or `TRADER` — who fills the price when `priceEnabled=true`.
 *       - **qaFormSchema** — JSON array of dynamic form fields; render on job post screen.
 *       - **categoryId** — Parent category UUID; use to group or filter.
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: |
 *           **Purpose:** Return only sub-categories belonging to one parent category.
 *           **When to use:** User selected a category — pass its `id` here.
 *           **When omitted:** Returns sub-categories across all active categories (usually only for admin/debug; prefer filtering).
 *           **Example:** `GET /sub-categories?categoryId=3f0f23dd-dfa2-4606-9eed-acdc22534f0f`
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *         description: |
 *           **Purpose:** Show only featured sub-categories (admin-marked).
 *           **How to use:** `featured=true` for "Popular services" under a category; omit for full list.
 *           **Example:** `GET /sub-categories?categoryId={uuid}&featured=true`
 *     responses:
 *       200:
 *         description: Array of sub-category objects in `data`. No `meta`.
 */
subcategoriesRouter.get('/', validate(appSubcategoryListSchema), categoriesController.listSubcategories);

/**
 * @swagger
 * /sub-categories/{id}:
 *   get:
 *     summary: Get one sub-category by UUID (flags + full Q&A form)
 *     tags: ['Mobile / Categories']
 *     description: |
 *       **Use on:** Immediately after user selects a sub-category on the job-post screen.
 *
 *       **Auth:** Not required.
 *
 *       Call this to read **siteVisitEnabled**, **priceEnabled**, **priceEnteredBy**, and full **qaFormSchema** before rendering the job form.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: |
 *           **Purpose:** Load job-post configuration for the sub-category the user selected.
 *           **How to use:** Pass `id` from the sub-category row (from list or nested under category).
 *           **Drives UI:** Site visit step, price field visibility, dynamic Q&A fields.
 *     responses:
 *       200:
 *         description: Sub-category object in `data` with flags and `qaFormSchema`.
 *       404:
 *         description: Sub-category not found or inactive.
 */
subcategoriesRouter.get('/:id', validate(idParamSchema), categoriesController.getSubcategory);
