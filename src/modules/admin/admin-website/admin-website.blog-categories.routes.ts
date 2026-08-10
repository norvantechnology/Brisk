import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import * as controller from './admin-website.controller';
import {
  listCategoriesQuerySchema,
  createCategorySchema,
  updateCategorySchema,
  idParamSchema,
  patchCategoryStatusSchema,
  patchCategorySortOrderSchema,
  bulkCategoryStatusSchema,
  bulkCategoryDeleteSchema,
} from './admin-website.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/blog/categories:
 *   get:
 *     summary: List blog categories (paginated)
 *     tags: ['Admin Panel — Website · Blog Categories']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *         description: Alias for per_page
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *       - in: query
 *         name: sort_by
 *         schema: { type: string, example: sort_order }
 *       - in: query
 *         name: sort_direction
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Blog categories fetched successfully.
 */
router.get('/', validate(listCategoriesQuerySchema), controller.listCategories);

/**
 * @swagger
 * /admin/blog/categories:
 *   post:
 *     summary: Create blog category
 *     tags: ['Admin Panel — Website · Blog Categories']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug, status, sort_order]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               slug: { type: string, maxLength: 150 }
 *               description: { type: string, maxLength: 500, nullable: true }
 *               icon: { type: string, maxLength: 50, nullable: true }
 *               status: { type: string, enum: [active, inactive] }
 *               sort_order: { type: integer, minimum: 0 }
 *     responses:
 *       201:
 *         description: Blog category created successfully.
 */
router.post('/', validate(createCategorySchema), controller.createCategory);

/**
 * @swagger
 * /admin/blog/categories/bulk-status:
 *   post:
 *     summary: Bulk update blog category status
 *     tags: ['Admin Panel — Website · Blog Categories']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids, status]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               status: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Blog categories status updated successfully.
 */
router.post('/bulk-status', validate(bulkCategoryStatusSchema), controller.bulkCategoryStatus);

/**
 * @swagger
 * /admin/blog/categories/bulk-delete:
 *   post:
 *     summary: Bulk delete blog categories
 *     tags: ['Admin Panel — Website · Blog Categories']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog categories deleted successfully.
 *       400:
 *         description: Cannot delete categories with assigned articles.
 */
router.post('/bulk-delete', validate(bulkCategoryDeleteSchema), controller.bulkCategoryDelete);

/**
 * @swagger
 * /admin/blog/categories/{id}:
 *   get:
 *     summary: Get blog category details
 *     tags: ['Admin Panel — Website · Blog Categories']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog category fetched successfully.
 */
router.get('/:id', validate(idParamSchema), controller.getCategory);

/**
 * @swagger
 * /admin/blog/categories/{id}:
 *   put:
 *     summary: Update blog category
 *     tags: ['Admin Panel — Website · Blog Categories']
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
 *             required: [name, slug, status, sort_order]
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string, nullable: true }
 *               icon: { type: string, nullable: true }
 *               status: { type: string, enum: [active, inactive] }
 *               sort_order: { type: integer }
 *     responses:
 *       200:
 *         description: Blog category updated successfully.
 */
router.put('/:id', validate(updateCategorySchema), controller.updateCategory);

/**
 * @swagger
 * /admin/blog/categories/{id}:
 *   delete:
 *     summary: Delete blog category (blocked if articles assigned)
 *     tags: ['Admin Panel — Website · Blog Categories']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog category deleted successfully.
 *       400:
 *         description: Category has associated articles.
 */
router.delete('/:id', validate(idParamSchema), controller.deleteCategory);

/**
 * @swagger
 * /admin/blog/categories/{id}/status:
 *   patch:
 *     summary: Activate or deactivate blog category
 *     tags: ['Admin Panel — Website · Blog Categories']
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Blog category status updated successfully.
 */
router.patch('/:id/status', validate(patchCategoryStatusSchema), controller.patchCategoryStatus);

/**
 * @swagger
 * /admin/blog/categories/{id}/sort-order:
 *   patch:
 *     summary: Update blog category sort order
 *     tags: ['Admin Panel — Website · Blog Categories']
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
 *             required: [sort_order]
 *             properties:
 *               sort_order: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Blog category sort order updated successfully.
 */
router.patch(
  '/:id/sort-order',
  validate(patchCategorySortOrderSchema),
  controller.patchCategorySortOrder
);

export default router;
