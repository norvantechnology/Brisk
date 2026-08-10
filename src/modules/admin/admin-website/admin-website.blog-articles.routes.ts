import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import * as controller from './admin-website.controller';
import {
  listArticlesQuerySchema,
  createArticleSchema,
  updateArticleSchema,
  idParamSchema,
  patchArticleStatusSchema,
  patchArticleFeaturedSchema,
  coverImageSchema,
  bulkArticleStatusSchema,
  bulkArticleDeleteSchema,
} from './admin-website.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/blog/articles:
 *   get:
 *     summary: List blog articles (filters, search, pagination)
 *     tags: ['📰 [Website] Blog Articles']
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
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, scheduled, published, archived] }
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: sort_by
 *         schema: { type: string, example: publish_date }
 *       - in: query
 *         name: sort_direction
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Blog articles fetched successfully.
 */
router.get('/', validate(listArticlesQuerySchema), controller.listArticles);

/**
 * @swagger
 * /admin/blog/articles:
 *   post:
 *     summary: Create blog article
 *     tags: ['📰 [Website] Blog Articles']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - category_id
 *               - slug
 *               - short_description
 *               - content
 *               - publish_status
 *               - is_featured
 *             properties:
 *               title: { type: string, maxLength: 255 }
 *               category_id: { type: string, format: uuid }
 *               slug: { type: string, maxLength: 255 }
 *               cover_image_url:
 *                 type: string
 *                 format: uri
 *                 description: Cover image URL string (alias cover_image also accepted). JSON URL only; multipart/S3 later. Required when publish_status is published.
 *               cover_image:
 *                 type: string
 *                 format: uri
 *                 description: Alias for cover_image_url.
 *               short_description: { type: string }
 *               content: { type: string }
 *               author_name: { type: string, maxLength: 150, nullable: true }
 *               author_role: { type: string, maxLength: 150, nullable: true }
 *               reading_time: { type: string, maxLength: 50, nullable: true, example: '5 min read' }
 *               publish_date: { type: string, example: '2026-08-10' }
 *               publish_status: { type: string, enum: [draft, scheduled, published, archived] }
 *               is_featured: { type: boolean }
 *               seo_title: { type: string, maxLength: 255, nullable: true }
 *               meta_description: { type: string, maxLength: 500, nullable: true }
 *     responses:
 *       201:
 *         description: Blog article created successfully.
 */
router.post('/', validate(createArticleSchema), controller.createArticle);

/**
 * @swagger
 * /admin/blog/articles/bulk-status:
 *   post:
 *     summary: Bulk update article publish status
 *     tags: ['📰 [Website] Blog Articles']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids, publish_status]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               publish_status: { type: string, enum: [draft, scheduled, published, archived] }
 *     responses:
 *       200:
 *         description: Blog articles status updated successfully.
 */
router.post('/bulk-status', validate(bulkArticleStatusSchema), controller.bulkArticleStatus);

/**
 * @swagger
 * /admin/blog/articles/bulk-delete:
 *   post:
 *     summary: Bulk soft-delete blog articles
 *     tags: ['📰 [Website] Blog Articles']
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
 *         description: Blog articles deleted successfully.
 */
router.post('/bulk-delete', validate(bulkArticleDeleteSchema), controller.bulkArticleDelete);

/**
 * @swagger
 * /admin/blog/articles/{id}:
 *   get:
 *     summary: Get blog article details
 *     tags: ['📰 [Website] Blog Articles']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog article fetched successfully.
 */
router.get('/:id', validate(idParamSchema), controller.getArticle);

/**
 * @swagger
 * /admin/blog/articles/{id}:
 *   put:
 *     summary: Update blog article
 *     tags: ['📰 [Website] Blog Articles']
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
 *             required:
 *               - title
 *               - category_id
 *               - slug
 *               - short_description
 *               - content
 *               - publish_status
 *               - is_featured
 *             properties:
 *               title: { type: string }
 *               category_id: { type: string, format: uuid }
 *               slug: { type: string }
 *               cover_image_url: { type: string, format: uri, description: 'Alias cover_image accepted. JSON URL only; multipart/S3 later.' }
 *               cover_image: { type: string, format: uri, description: 'Alias for cover_image_url.' }
 *               short_description: { type: string }
 *               content: { type: string }
 *               author_name: { type: string, nullable: true }
 *               author_role: { type: string, nullable: true }
 *               reading_time: { type: string, nullable: true }
 *               publish_date: { type: string }
 *               publish_status: { type: string, enum: [draft, scheduled, published, archived] }
 *               is_featured: { type: boolean }
 *               seo_title: { type: string, nullable: true }
 *               meta_description: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Blog article updated successfully.
 */
router.put('/:id', validate(updateArticleSchema), controller.updateArticle);

/**
 * @swagger
 * /admin/blog/articles/{id}:
 *   delete:
 *     summary: Soft-delete blog article
 *     tags: ['📰 [Website] Blog Articles']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog article deleted successfully.
 */
router.delete('/:id', validate(idParamSchema), controller.deleteArticle);

/**
 * @swagger
 * /admin/blog/articles/{id}/status:
 *   patch:
 *     summary: Change article publish status
 *     tags: ['📰 [Website] Blog Articles']
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
 *             required: [publish_status]
 *             properties:
 *               publish_status: { type: string, enum: [draft, scheduled, published, archived] }
 *     responses:
 *       200:
 *         description: Blog article status updated successfully.
 */
router.patch('/:id/status', validate(patchArticleStatusSchema), controller.patchArticleStatus);

/**
 * @swagger
 * /admin/blog/articles/{id}/featured:
 *   patch:
 *     summary: Enable or disable Featured/Spotlight (only one featured at a time)
 *     tags: ['📰 [Website] Blog Articles']
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
 *             required: [is_featured]
 *             properties:
 *               is_featured: { type: boolean }
 *     responses:
 *       200:
 *         description: Blog article featured spotlight updated successfully.
 */
router.patch(
  '/:id/featured',
  validate(patchArticleFeaturedSchema),
  controller.patchArticleFeatured
);

/**
 * @swagger
 * /admin/blog/articles/{id}/cover-image:
 *   post:
 *     summary: Set or replace article cover image URL
 *     description: JSON body with URL only (cover_image_url or cover_image). Multipart/S3 later.
 *     tags: ['📰 [Website] Blog Articles']
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
 *             required: [cover_image_url]
 *             properties:
 *               cover_image_url:
 *                 type: string
 *                 format: uri
 *                 description: JSON URL only; multipart/S3 later. Alias cover_image also accepted.
 *                 example: https://cdn.example.com/blog/cover.jpg
 *               cover_image:
 *                 type: string
 *                 format: uri
 *                 description: Alias for cover_image_url.
 *     responses:
 *       200:
 *         description: Blog article cover image updated successfully.
 */
router.post('/:id/cover-image', validate(coverImageSchema), controller.setCoverImage);

/**
 * @swagger
 * /admin/blog/articles/{id}/cover-image:
 *   delete:
 *     summary: Remove article cover image
 *     tags: ['📰 [Website] Blog Articles']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog article cover image removed successfully.
 */
router.delete('/:id/cover-image', validate(idParamSchema), controller.removeCoverImage);

export default router;
