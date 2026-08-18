import { Router } from 'express';
import * as categoryAdminController from './admin-categories.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import {
  createCategorySchema,
  updateCategorySchema,
  createSubcategorySchema,
  updateSubcategorySchema,
  categoryFilterSchema,
  subcategoryFilterSchema,
  idParamSchema,
} from './admin-categories.validation';

const router = Router();

// Apply Admin Auth Middleware across all Category/Sub-Category admin routes
router.use(adminAuthMiddleware);

// ==========================================
// CATEGORY MASTER ROUTES
// ==========================================

/**
 * @swagger
 * /admin/categories:
 *   get:
 *     summary: List Master Categories (Paginated, Search, Status & Featured Filters)
 *     tags: ['Admin / Categories']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Number of items per page.
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by category name, code, or URL slug.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *         description: Filter by status.
 *       - in: query
 *         name: featured
 *         schema: { type: boolean }
 *         description: Filter featured categories.
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [name, categoryCode, displayOrder, status, createdAt, updatedAt] }
 *         description: Column to sort by. Defaults to `createdAt`.
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *         description: Sort direction. Defaults to `desc` (newest first).
 *     responses:
 *       200:
 *         description: Master Categories retrieved successfully.
 *       401:
 *         description: Missing or invalid Admin JWT token.
 */
router.get('/categories', validate(categoryFilterSchema), categoryAdminController.listCategories);

/**
 * @swagger
 * /admin/categories/dropdown:
 *   get:
 *     summary: All categories for dropdown (no pagination, alphabetic order)
 *     tags: ['Admin / Categories']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns **all** categories (active + inactive) sorted A–Z by name. No `page`/`limit`.
 *       Use this to populate select/dropdown inputs in the admin UI (e.g. when creating a sub-category).
 *     responses:
 *       200:
 *         description: Flat array of `{ id, name, categoryCode, status }` objects.
 */
router.get('/categories/dropdown', categoryAdminController.listCategoriesDropdown);

/**
 * @swagger
 * /admin/categories:
 *   post:
 *     summary: Create new Master Category
 *     tags: ['Admin / Categories']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - categoryCode
 *               - urlSlug
 *             properties:
 *               name: { type: string, example: 'Plumbing Services' }
 *               categoryCode: { type: string, example: 'CAT-PLUMB' }
 *               urlSlug: { type: string, example: 'plumbing-services' }
 *               description: { type: string, example: 'Full plumbing and pipe installation services.' }
 *               iconName: { type: string, example: 'Wrench' }
 *               brandThemeColor: { type: string, example: '#0EA5E9' }
 *               bannerImageUrl: { type: string, example: 'https://cdn.brisk.com/banners/plumbing.png' }
 *               displayOrder: { type: integer, example: 1 }
 *               status: { type: string, enum: [active, inactive], example: 'active' }
 *               featured: { type: boolean, example: true }
 *     responses:
 *       201:
 *         description: Master Category created successfully.
 *       400:
 *         description: Validation error.
 *       409:
 *         description: Category code or URL slug conflict.
 */
router.post('/categories', validate(createCategorySchema), categoryAdminController.createCategory);

/**
 * @swagger
 * /admin/categories/{id}:
 *   get:
 *     summary: Get Master Category detail by ID
 *     tags: ['Admin / Categories']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category detail retrieved.
 *       404:
 *         description: Category not found.
 */
router.get('/categories/:id', validate(idParamSchema), categoryAdminController.getCategory);

/**
 * @swagger
 * /admin/categories/{id}:
 *   patch:
 *     summary: Update Master Category detail
 *     tags: ['Admin / Categories']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               categoryCode: { type: string }
 *               urlSlug: { type: string }
 *               description: { type: string }
 *               iconName: { type: string }
 *               brandThemeColor: { type: string }
 *               displayOrder: { type: integer }
 *               status: { type: string, enum: [active, inactive] }
 *               featured: { type: boolean }
 *     responses:
 *       200:
 *         description: Master Category updated.
 *       404:
 *         description: Category not found.
 */
router.patch('/categories/:id', validate(updateCategorySchema), categoryAdminController.updateCategory);

/**
 * @swagger
 * /admin/categories/{id}:
 *   delete:
 *     summary: Delete Master Category
 *     tags: ['Admin / Categories']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category deleted successfully.
 *       400:
 *         description: Cannot delete category with active sub-categories or jobs.
 *       404:
 *         description: Category not found.
 */
router.delete('/categories/:id', validate(idParamSchema), categoryAdminController.deleteCategory);

// ==========================================
// SUB-CATEGORY MASTER ROUTES (Screenshot 4)
// ==========================================

/**
 * @swagger
 * /admin/sub-categories:
 *   get:
 *     summary: List Sub-Categories (Paginated, Search, Parent Category & Status Filters)
 *     tags: ['Admin / Sub-Categories']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by subcategory name, code, or URL slug.
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: Filter by parent category ID.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *       - in: query
 *         name: featured
 *         schema: { type: boolean }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [name, code, urlSlug, status, createdAt, updatedAt] }
 *         description: Column to sort by. Defaults to `createdAt`.
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *         description: Sort direction. Defaults to `desc` (newest first).
 *     responses:
 *       200:
 *         description: Sub-Categories retrieved successfully matching Screenshot 4 format.
 */
router.get('/sub-categories', validate(subcategoryFilterSchema), categoryAdminController.listSubcategories);

/**
 * @swagger
 * /admin/sub-categories/dropdown:
 *   get:
 *     summary: All sub-categories for dropdown (no pagination, alphabetic order)
 *     tags: ['Admin / Sub-Categories']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns **all** sub-categories sorted A–Z by name. No `page`/`limit`.
 *       Optionally filter by `categoryId` to get sub-categories for one parent category.
 *       Use to populate sub-category select inputs in the admin UI.
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: Optional. Filter by parent category UUID.
 *     responses:
 *       200:
 *         description: Flat array of `{ id, name, code, status, categoryId, category }` objects.
 */
router.get('/sub-categories/dropdown', categoryAdminController.listSubcategoriesDropdown);

/**
 * @swagger
 * /admin/sub-categories:
 *   post:
 *     summary: Create new Sub-Category
 *     tags: ['Admin / Sub-Categories']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryId
 *               - name
 *               - urlSlug
 *             properties:
 *               categoryId: { type: string, format: uuid }
 *               name: { type: string, example: 'Leak Repair & Pipework' }
 *               serviceType: { type: string, example: 'Repair' }
 *               code: { type: string, example: 'PLUMB-LEAK' }
 *               urlSlug: { type: string, example: 'leak-repair-pipework' }
 *               featured: { type: boolean, example: true }
 *               status: { type: string, enum: [active, inactive], example: 'active' }
 *               siteVisitEnabled:
 *                 type: boolean
 *                 example: true
 *                 description: Enable/disable site visit for this sub-category
 *               priceEnabled:
 *                 type: boolean
 *                 example: true
 *                 description: Show price field when posting a job for this sub-category
 *               priceEnteredBy:
 *                 type: string
 *                 enum: [CUSTOMER, TRADER]
 *                 example: CUSTOMER
 *                 description: Who enters the price (customer or trader)
 *               qaFormSchema:
 *                 type: array
 *                 description: |
 *                   Admin-built Q&A form (JSON). Mobile app shows these fields when user selects this sub-category for a job.
 *                   Field types: text, textarea, number, dropdown, single_choice, multi_choice, date, boolean.
 *                 items:
 *                   type: object
 *                   required: [id, type, label]
 *                   properties:
 *                     id: { type: string, example: 'issue_type' }
 *                     type: { type: string, enum: [text, textarea, number, dropdown, single_choice, multi_choice, date, boolean] }
 *                     label: { type: string, example: 'What is the issue?' }
 *                     required: { type: boolean, example: true }
 *                     placeholder: { type: string }
 *                     helpText: { type: string }
 *                     options:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           label: { type: string, example: 'Leak' }
 *                           value: { type: string, example: 'leak' }
 *                     min: { type: number }
 *                     max: { type: number }
 *                 example:
 *                   - id: issue_type
 *                     type: dropdown
 *                     label: What is the issue?
 *                     required: true
 *                     options:
 *                       - { label: Leak, value: leak }
 *                       - { label: Blockage, value: blockage }
 *                   - id: notes
 *                     type: textarea
 *                     label: Extra details
 *                     required: false
 *     responses:
 *       201:
 *         description: Sub-Category created successfully.
 */
router.post('/sub-categories', validate(createSubcategorySchema), categoryAdminController.createSubcategory);

/**
 * @swagger
 * /admin/sub-categories/{id}:
 *   get:
 *     summary: Get Sub-Category detail by ID
 *     tags: ['Admin / Sub-Categories']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sub-Category detail retrieved successfully.
 *       404:
 *         description: Sub-Category not found.
 */
router.get('/sub-categories/:id', validate(idParamSchema), categoryAdminController.getSubcategory);

/**
 * @swagger
 * /admin/sub-categories/{id}:
 *   patch:
 *     summary: Update Sub-Category detail
 *     tags: ['Admin / Sub-Categories']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               serviceType: { type: string }
 *               code: { type: string }
 *               urlSlug: { type: string }
 *               featured: { type: boolean }
 *               status: { type: string, enum: [active, inactive] }
 *               siteVisitEnabled: { type: boolean, description: Enable/disable site visit }
 *               priceEnabled: { type: boolean, description: Show/hide price field on job post }
 *               priceEnteredBy: { type: string, enum: [CUSTOMER, TRADER], description: Who enters the price }
 *               qaFormSchema:
 *                 type: array
 *                 nullable: true
 *                 description: Replace the full Q&A form JSON (null clears the form)
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Sub-Category updated successfully.
 *       404:
 *         description: Sub-Category not found.
 */
router.patch('/sub-categories/:id', validate(updateSubcategorySchema), categoryAdminController.updateSubcategory);

/**
 * @swagger
 * /admin/sub-categories/{id}:
 *   delete:
 *     summary: Delete Sub-Category
 *     tags: ['Admin / Sub-Categories']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sub-Category deleted successfully.
 *       400:
 *         description: Cannot delete sub-category linked to existing active jobs.
 *       404:
 *         description: Sub-Category not found.
 */
router.delete('/sub-categories/:id', validate(idParamSchema), categoryAdminController.deleteSubcategory);

export default router;
