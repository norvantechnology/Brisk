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
 *     tags: ['📂 [Admin Category] Master Categories']
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
 *     responses:
 *       200:
 *         description: Master Categories retrieved successfully.
 *       401:
 *         description: Missing or invalid Admin JWT token.
 */
router.get('/categories', validate(categoryFilterSchema), categoryAdminController.listCategories);

/**
 * @swagger
 * /admin/categories:
 *   post:
 *     summary: Create new Master Category
 *     tags: ['📂 [Admin Category] Master Categories']
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
 *     tags: ['📂 [Admin Category] Master Categories']
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
router.get('/categories/:id', categoryAdminController.getCategory);

/**
 * @swagger
 * /admin/categories/{id}:
 *   patch:
 *     summary: Update Master Category detail
 *     tags: ['📂 [Admin Category] Master Categories']
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
 *     tags: ['📂 [Admin Category] Master Categories']
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
router.delete('/categories/:id', categoryAdminController.deleteCategory);

// ==========================================
// SUB-CATEGORY MASTER ROUTES (Screenshot 4)
// ==========================================

/**
 * @swagger
 * /admin/sub-categories:
 *   get:
 *     summary: List Sub-Categories (Paginated, Search, Parent Category & Status Filters)
 *     tags: ['🏷️ [Admin Category] Master Sub-Categories']
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
 *     responses:
 *       200:
 *         description: Sub-Categories retrieved successfully matching Screenshot 4 format.
 */
router.get('/sub-categories', validate(subcategoryFilterSchema), categoryAdminController.listSubcategories);

/**
 * @swagger
 * /admin/sub-categories:
 *   post:
 *     summary: Create new Sub-Category
 *     tags: ['🏷️ [Admin Category] Master Sub-Categories']
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
 *     tags: ['🏷️ [Admin Category] Master Sub-Categories']
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
router.get('/sub-categories/:id', categoryAdminController.getSubcategory);

/**
 * @swagger
 * /admin/sub-categories/{id}:
 *   patch:
 *     summary: Update Sub-Category detail
 *     tags: ['🏷️ [Admin Category] Master Sub-Categories']
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
 *     tags: ['🏷️ [Admin Category] Master Sub-Categories']
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
router.delete('/sub-categories/:id', categoryAdminController.deleteSubcategory);

export default router;
