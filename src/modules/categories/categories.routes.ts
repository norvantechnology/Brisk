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
 *     summary: List active service categories (Customer / Trader app)
 *     tags: ['Mobile / Categories']
 *     description: |
 *       **Who uses this:** Customer app & Trader app (home / post-job category picker).
 *
 *       **Login needed?** No — only active categories are returned.
 *
 *       Pass `includeSubcategories=true` to also get each category's active sub-categories
 *       with `siteVisitEnabled`, `priceEnabled`, `priceEnteredBy`, and `qaFormSchema`.
 *     parameters:
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: includeSubcategories
 *         schema: { type: string, enum: [true, false] }
 *         description: If true, nest active sub-categories (with Q&A form + flags) under each category
 *     responses:
 *       200:
 *         description: Active categories list.
 */
categoriesRouter.get('/', validate(appCategoryListSchema), categoriesController.listCategories);

/**
 * @swagger
 * /categories/slug/{slug}:
 *   get:
 *     summary: Get active category by URL slug (with sub-categories + flags)
 *     tags: ['Mobile / Categories']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category with nested active sub-categories (flags + qaFormSchema).
 *       404:
 *         description: Category not found or inactive.
 */
categoriesRouter.get('/slug/:slug', validate(slugParamSchema), categoriesController.getCategoryBySlug);

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Get active category by ID (with sub-categories + flags)
 *     tags: ['Mobile / Categories']
 *     description: |
 *       Returns category plus active sub-categories. Each sub-category includes:
 *       - siteVisitEnabled
 *       - priceEnabled
 *       - priceEnteredBy (CUSTOMER | TRADER)
 *       - qaFormSchema (form fields for job post)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category detail with sub-categories.
 *       404:
 *         description: Category not found or inactive.
 */
categoriesRouter.get('/:id', validate(idParamSchema), categoriesController.getCategory);

/**
 * @swagger
 * /sub-categories:
 *   get:
 *     summary: List active sub-categories (site visit, price flags, Q&A form)
 *     tags: ['Mobile / Categories']
 *     description: |
 *       **App job-post flow:**
 *       1. User picks a category
 *       2. App calls this with `categoryId`
 *       3. User picks a sub-category
 *       4. App reads `siteVisitEnabled`, `priceEnabled`, `priceEnteredBy`, `qaFormSchema`
 *       5. App shows site-visit UI / price field / dynamic Q&A form as configured by admin
 *
 *       Later when Jobs API ships, answers are saved as `qaFormAnswers` on the job.
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: Filter by parent category
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *     responses:
 *       200:
 *         description: Active sub-categories with flags and qaFormSchema.
 */
subcategoriesRouter.get('/', validate(appSubcategoryListSchema), categoriesController.listSubcategories);

/**
 * @swagger
 * /sub-categories/{id}:
 *   get:
 *     summary: Get one active sub-category (flags + full Q&A form JSON)
 *     tags: ['Mobile / Categories']
 *     description: |
 *       Use this when the user selects a sub-category — response drives:
 *       - Site visit step (if siteVisitEnabled=true)
 *       - Price input (if priceEnabled=true; who fills it = priceEnteredBy)
 *       - Dynamic Q&A form from qaFormSchema
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sub-category detail.
 *       404:
 *         description: Sub-category not found or inactive.
 */
subcategoriesRouter.get('/:id', validate(idParamSchema), categoriesController.getSubcategory);
