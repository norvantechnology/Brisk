import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import * as controller from './admin-website.controller';
import {
  listSectionsQuerySchema,
  createSectionSchema,
  updateSectionSchema,
  idParamSchema,
  sectionBlockParamsSchema,
  patchSectionStatusSchema,
  patchSectionSortOrderSchema,
  graphicImageSchema,
  createBlockSchema,
  updateBlockSchema,
  reorderBlocksSchema,
  bulkSectionStatusSchema,
  bulkSectionDeleteSchema,
} from './admin-website.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/knowledge-hub/sections:
 *   get:
 *     summary: List Knowledge Hub sections
 *     tags: ['📚 [Website] Knowledge Hub']
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
 *         schema: { type: string, enum: [draft, scheduled, published, archived] }
 *       - in: query
 *         name: sort_by
 *         schema: { type: string, example: sort_order }
 *       - in: query
 *         name: sort_direction
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Knowledge Hub sections fetched successfully.
 */
router.get('/sections', validate(listSectionsQuerySchema), controller.listSections);

/**
 * @swagger
 * /admin/knowledge-hub/sections:
 *   post:
 *     summary: Create Knowledge Hub section
 *     tags: ['📚 [Website] Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - section_title
 *               - slug
 *               - short_description
 *               - publishing_status
 *               - sort_order
 *             properties:
 *               section_title: { type: string, maxLength: 255 }
 *               slug: { type: string, maxLength: 255 }
 *               short_description: { type: string }
 *               detailed_content: { type: string, nullable: true }
 *               graphic_image_url:
 *                 type: string
 *                 format: uri
 *                 description: Graphic image URL string (alias graphic_image also accepted). JSON URL only; multipart/S3 later.
 *               graphic_image:
 *                 type: string
 *                 format: uri
 *                 description: Alias for graphic_image_url.
 *               icon: { type: string, maxLength: 50, nullable: true }
 *               publishing_status: { type: string, enum: [draft, scheduled, published, archived] }
 *               cta_button_text: { type: string, maxLength: 100, nullable: true }
 *               cta_url: { type: string, maxLength: 500, nullable: true }
 *               sort_order: { type: integer, minimum: 0 }
 *               seo_title: { type: string, maxLength: 255, nullable: true }
 *               meta_description: { type: string, maxLength: 500, nullable: true }
 *               content_blocks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [type, sort_order]
 *                   properties:
 *                     type: { type: string, enum: [step_card, feature_card, text_block, cta_banner] }
 *                     sort_order: { type: integer }
 *                     title: { type: string }
 *                     description: { type: string }
 *                     icon: { type: string }
 *                     image: { type: string, format: uri, nullable: true, description: 'Block image URL (alias image_url). JSON URL only; multipart/S3 later.' }
 *                     image_url: { type: string, format: uri, nullable: true, description: 'Alias for image.' }
 *                     button_text: { type: string }
 *                     button_url: { type: string }
 *                     content: { type: string }
 *     responses:
 *       201:
 *         description: Knowledge Hub section created successfully.
 */
router.post('/sections', validate(createSectionSchema), controller.createSection);

/**
 * @swagger
 * /admin/knowledge-hub/bulk-status:
 *   post:
 *     summary: Bulk update Knowledge Hub section publishing status
 *     tags: ['📚 [Website] Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids, publishing_status]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               publishing_status: { type: string, enum: [draft, scheduled, published, archived] }
 *     responses:
 *       200:
 *         description: Knowledge Hub sections status updated successfully.
 */
router.post('/bulk-status', validate(bulkSectionStatusSchema), controller.bulkSectionStatus);

/**
 * @swagger
 * /admin/knowledge-hub/bulk-delete:
 *   post:
 *     summary: Bulk soft-delete Knowledge Hub sections
 *     tags: ['📚 [Website] Knowledge Hub']
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
 *         description: Knowledge Hub sections deleted successfully.
 */
router.post('/bulk-delete', validate(bulkSectionDeleteSchema), controller.bulkSectionDelete);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}:
 *   get:
 *     summary: Get Knowledge Hub section details (with blocks)
 *     tags: ['📚 [Website] Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Knowledge Hub section fetched successfully.
 */
router.get('/sections/:id', validate(idParamSchema), controller.getSection);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}:
 *   put:
 *     summary: Update Knowledge Hub section
 *     tags: ['📚 [Website] Knowledge Hub']
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
 *               - section_title
 *               - slug
 *               - short_description
 *               - publishing_status
 *               - sort_order
 *             properties:
 *               section_title: { type: string }
 *               slug: { type: string }
 *               short_description: { type: string }
 *               detailed_content: { type: string, nullable: true }
 *               graphic_image_url: { type: string, format: uri, description: 'Alias graphic_image accepted. JSON URL only; multipart/S3 later.' }
 *               graphic_image: { type: string, format: uri, description: 'Alias for graphic_image_url.' }
 *               icon: { type: string, nullable: true }
 *               publishing_status: { type: string, enum: [draft, scheduled, published, archived] }
 *               cta_button_text: { type: string, nullable: true }
 *               cta_url: { type: string, nullable: true }
 *               sort_order: { type: integer }
 *               seo_title: { type: string, nullable: true }
 *               meta_description: { type: string, nullable: true }
 *               content_blocks:
 *                 type: array
 *                 description: When provided, replaces all existing content blocks.
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Knowledge Hub section updated successfully.
 */
router.put('/sections/:id', validate(updateSectionSchema), controller.updateSection);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}:
 *   delete:
 *     summary: Soft-delete Knowledge Hub section
 *     tags: ['📚 [Website] Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Knowledge Hub section deleted successfully.
 */
router.delete('/sections/:id', validate(idParamSchema), controller.deleteSection);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}/status:
 *   patch:
 *     summary: Change Knowledge Hub section publishing status
 *     tags: ['📚 [Website] Knowledge Hub']
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
 *             required: [publishing_status]
 *             properties:
 *               publishing_status: { type: string, enum: [draft, scheduled, published, archived] }
 *     responses:
 *       200:
 *         description: Knowledge Hub section status updated successfully.
 */
router.patch(
  '/sections/:id/status',
  validate(patchSectionStatusSchema),
  controller.patchSectionStatus
);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}/sort-order:
 *   patch:
 *     summary: Update Knowledge Hub section sort order
 *     tags: ['📚 [Website] Knowledge Hub']
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
 *         description: Knowledge Hub section sort order updated successfully.
 */
router.patch(
  '/sections/:id/sort-order',
  validate(patchSectionSortOrderSchema),
  controller.patchSectionSortOrder
);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}/graphic:
 *   post:
 *     summary: Set or replace section graphic URL
 *     description: JSON body with URL only (graphic_image_url or graphic_image). Multipart/S3 later.
 *     tags: ['📚 [Website] Knowledge Hub']
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
 *             required: [graphic_image_url]
 *             properties:
 *               graphic_image_url:
 *                 type: string
 *                 format: uri
 *                 description: JSON URL only; multipart/S3 later. Alias graphic_image also accepted.
 *                 example: https://cdn.example.com/knowledge-hub/smart-milestones.jpg
 *               graphic_image:
 *                 type: string
 *                 format: uri
 *                 description: Alias for graphic_image_url.
 *     responses:
 *       200:
 *         description: Knowledge Hub graphic uploaded successfully.
 */
router.post('/sections/:id/graphic', validate(graphicImageSchema), controller.setGraphic);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}/graphic:
 *   delete:
 *     summary: Remove section graphic
 *     tags: ['📚 [Website] Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Knowledge Hub graphic removed successfully.
 */
router.delete('/sections/:id/graphic', validate(idParamSchema), controller.removeGraphic);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}/blocks:
 *   get:
 *     summary: List content blocks for a section
 *     tags: ['📚 [Website] Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Content blocks fetched successfully.
 */
router.get('/sections/:id/blocks', validate(idParamSchema), controller.listBlocks);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}/blocks:
 *   post:
 *     summary: Add a content block
 *     tags: ['📚 [Website] Knowledge Hub']
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
 *             required: [type, sort_order]
 *             properties:
 *               type: { type: string, enum: [step_card, feature_card, text_block, cta_banner] }
 *               sort_order: { type: integer, minimum: 0 }
 *               title: { type: string, nullable: true }
 *               description: { type: string, nullable: true }
 *               icon: { type: string, nullable: true }
 *               image: { type: string, format: uri, nullable: true, description: 'Block image URL (alias image_url). JSON URL only; multipart/S3 later.' }
 *               image_url: { type: string, format: uri, nullable: true, description: 'Alias for image.' }
 *               button_text: { type: string, nullable: true }
 *               button_url: { type: string, nullable: true }
 *               content: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Content block added successfully.
 */
router.post('/sections/:id/blocks', validate(createBlockSchema), controller.createBlock);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}/blocks/reorder:
 *   patch:
 *     summary: Reorder content blocks
 *     tags: ['📚 [Website] Knowledge Hub']
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
 *             required: [blocks]
 *             properties:
 *               blocks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, sort_order]
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     sort_order: { type: integer }
 *     responses:
 *       200:
 *         description: Content blocks reordered successfully.
 */
router.patch(
  '/sections/:id/blocks/reorder',
  validate(reorderBlocksSchema),
  controller.reorderBlocks
);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}/blocks/{blockId}:
 *   put:
 *     summary: Update a content block
 *     tags: ['📚 [Website] Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: blockId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, sort_order]
 *             properties:
 *               type: { type: string, enum: [step_card, feature_card, text_block, cta_banner] }
 *               sort_order: { type: integer }
 *               title: { type: string, nullable: true }
 *               description: { type: string, nullable: true }
 *               icon: { type: string, nullable: true }
 *               image: { type: string, format: uri, nullable: true, description: 'Block image URL (alias image_url). JSON URL only; multipart/S3 later.' }
 *               image_url: { type: string, format: uri, nullable: true, description: 'Alias for image.' }
 *               button_text: { type: string, nullable: true }
 *               button_url: { type: string, nullable: true }
 *               content: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Content block updated successfully.
 */
router.put(
  '/sections/:id/blocks/:blockId',
  validate(updateBlockSchema),
  controller.updateBlock
);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}/blocks/{blockId}:
 *   delete:
 *     summary: Delete a content block
 *     tags: ['📚 [Website] Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: blockId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Content block deleted successfully.
 */
router.delete(
  '/sections/:id/blocks/:blockId',
  validate(sectionBlockParamsSchema),
  controller.deleteBlock
);

export default router;
