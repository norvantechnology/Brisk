import { Router } from 'express';
import * as categoriesController from './categories.controller';
import { validate } from '../../middlewares/validate.middleware';
import { optionalAuthMiddleware } from '../../middlewares/auth.middleware';
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
 *       **Use on:** Home screen category grid, post-job "pick a trade" step, trader profile / onboarding category picker.
 *
 *       **Auth:** Optional. Public without token. Send **trader Bearer** to get per-category document upload status
 *       (`documentsStatus`) for blue highlight when all required category documents are uploaded.
 *
 *       **Pagination:** None — full list is returned in `data`.
 *
 *       **Icons — how to load:**
 *       1. Prefer **`iconUrl`** — remote image URL (HTTP(S) in `iconName`, else `{CATEGORY_ICON_BASE_URL}/{urlSlug}.svg`).
 *       2. If `iconUrl` is null or fails to load, map **`iconName`** (e.g. `Wrench`, `Zap`) to a **local app asset**.
 *       3. Optional card image: **`bannerImageUrl`** (separate from icon).
 *
 *       **Document status (trader token only):**
 *       - `documentsStatus`: `ACTIVE` = all required category docs uploaded (show blue) |
 *         `PENDING` = missing required uploads | `N_A` = no required rules / guest / customer
 *       - `documentsComplete`: boolean shortcut (`true` when ACTIVE)
 *       - `requiredDocumentsCount` / `uploadedRequiredDocumentsCount`
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *         description: |
 *           **Purpose:** Show only featured categories on homepage or "Popular services" section.
 *           **Example:** `GET /categories?featured=true`
 *       - in: query
 *         name: includeSubcategories
 *         schema: { type: string, enum: [true, false, 1, 0] }
 *         description: |
 *           Nest sub-categories under each category (`siteVisitEnabled`, `priceEnabled`, `qaFormSchema`).
 *           **Example:** `GET /categories?includeSubcategories=true`
 *     responses:
 *       200:
 *         description: |
 *           `data` = array of category objects (camelCase).
 *           Example fields: `id`, `name`, `iconName`, `iconUrl`, `documentsStatus`, `documentsComplete`.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Categories retrieved successfully.
 *               data:
 *                 - id: 782f9eac-a393-4ab0-9377-d41d19b2fe7b
 *                   name: Solar
 *                   iconName: Zap
 *                   iconUrl: https://cdn.brisk.com/icons/categories/solar.svg
 *                   status: active
 *                   documentsStatus: ACTIVE
 *                   documentsComplete: true
 *                   requiredDocumentsCount: 2
 *                   uploadedRequiredDocumentsCount: 2
 */
categoriesRouter.get(
  '/',
  optionalAuthMiddleware,
  validate(appCategoryListSchema),
  categoriesController.listCategories
);

/**
 * @swagger
 * /categories/slug/{slug}:
 *   get:
 *     summary: Get one active category by URL slug (with nested sub-categories)
 *     tags: ['Mobile / Categories']
 *     description: |
 *       Optional trader Bearer enriches `documentsStatus` the same as list.
 *       Icons: use `iconUrl`, fallback local map of `iconName`.
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string, example: plumbing-services }
 *     responses:
 *       200:
 *         description: Single category object in `data` with nested `subcategories`.
 *       404:
 *         description: Category not found or inactive.
 */
categoriesRouter.get(
  '/slug/:slug',
  optionalAuthMiddleware,
  validate(slugParamSchema),
  categoriesController.getCategoryBySlug
);

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Get one active category by UUID (with nested sub-categories)
 *     tags: ['Mobile / Categories']
 *     description: |
 *       Optional trader Bearer enriches `documentsStatus` the same as list.
 *       Icons: use `iconUrl`, fallback local map of `iconName`.
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Single category object in `data` with nested `subcategories`.
 *       404:
 *         description: Category not found or inactive.
 */
categoriesRouter.get(
  '/:id',
  optionalAuthMiddleware,
  validate(idParamSchema),
  categoriesController.getCategory
);

/**
 * @swagger
 * /sub-categories:
 *   get:
 *     summary: List sub-categories (optionally filtered by main category)
 *     tags: ['Mobile / Categories']
 *     description: |
 *       Returns active sub-categories in `data` (no pagination, no `meta`).
 *
 *       **categoryId behaviour:**
 *       - Pass a main category UUID → only sub-categories for that category.
 *       - Omit `categoryId`, or send empty / `null` → all active sub-categories.
 *
 *       Each item includes `siteVisitEnabled`, `priceEnabled`, `priceEnteredBy`, `qaFormSchema`, and `categoryId`.
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: |
 *           Main category UUID. When provided, returns sub-categories for that category only.
 *           When omitted, empty, or `null`, returns all sub-categories.
 *           Example — filtered: `?categoryId=536b6e62-36a7-4356-94c0-935b1653aa57`
 *           Example — all: `GET /sub-categories` or `?categoryId=null`
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *         description: Optional. `true` = featured sub-categories only; omit for all.
 *     responses:
 *       200:
 *         description: Array of sub-category objects in `data`.
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
