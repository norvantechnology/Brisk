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
  listKnowledgeCategoriesQuerySchema,
  createKnowledgeCategorySchema,
  updateKnowledgeCategorySchema,
  listKnowledgeSubcategoriesQuerySchema,
  createKnowledgeSubcategorySchema,
  updateKnowledgeSubcategorySchema,
} from './admin-website.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/knowledge-hub/sections:
 *   get:
 *     summary: List Knowledge Hub sections
 *     tags: ['Admin / Website / Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: per_page
 *         schema: { type: integer, default: 20 }
 *         description: Items per page
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *         description: Alias for per_page
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by title, slug, or description
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *         description: Filter sections by category UUID
 *         example: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *       - in: query
 *         name: subcategory_id
 *         schema: { type: string, format: uuid }
 *         description: Filter sections by subcategory UUID
 *         example: "a1111111-1111-1111-1111-111111111111"
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, scheduled, published, archived] }
 *         description: Filter by publishing status
 *       - in: query
 *         name: sort_by
 *         schema: { type: string, example: sort_order }
 *         description: Sort field (sort_order, title, created_at, updated_at)
 *       - in: query
 *         name: sort_direction
 *         schema: { type: string, enum: [asc, desc] }
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: Knowledge Hub sections fetched successfully.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Knowledge Hub sections fetched successfully.
 *               data:
 *                 items:
 *                   - id: "4f9d2b80-1a23-4c56-b789-0123456789ab"
 *                     category_id: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *                     subcategory_id: "a1111111-1111-1111-1111-111111111111"
 *                     category:
 *                       id: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *                       name: "Customer Guides"
 *                       slug: "customer-guides"
 *                     subcategory:
 *                       id: "a1111111-1111-1111-1111-111111111111"
 *                       name: "Booking & Payments"
 *                       slug: "booking-payments"
 *                     section_title: "How to Book a Trader"
 *                     slug: "how-to-book-a-trader"
 *                     short_description: "Step-by-step instructions on finding and booking verified traders."
 *                     detailed_content: "Learn how to search by category, compare quotes, and confirm site visits."
 *                     graphic_image: "https://cdn.example.com/images/booking-guide.png"
 *                     icon: "calendar-check"
 *                     publishing_status: "published"
 *                     cta_button_text: "Find a Trader"
 *                     cta_url: "https://brisk.com/traders"
 *                     sort_order: 1
 *                     seo_title: "How to Book a Trader | Brisk Knowledge Hub"
 *                     meta_description: "Step-by-step guide to booking trusted local traders on Brisk."
 *                     blocks_count: 3
 *                     created_at: "2026-10-23T10:00:00.000Z"
 *                     updated_at: "2026-10-23T10:30:00.000Z"
 *                 pagination:
 *                   page: 1
 *                   per_page: 20
 *                   total: 1
 *                   total_pages: 1
 *                   has_next: false
 *                   has_prev: false
 *       400:
 *         description: Validation error in query parameters.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid ID format."
 *               error:
 *                 - field: "query.category_id"
 *                   message: "Invalid ID format."
 *       401:
 *         description: Unauthorized - missing or invalid admin JWT token.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Unauthorized access. Token missing or invalid."
 */
router.get('/sections', validate(listSectionsQuerySchema), controller.listSections);

/**
 * @swagger
 * /admin/knowledge-hub/sections:
 *   post:
 *     summary: Create Knowledge Hub section
 *     tags: ['Admin / Website / Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_id
 *               - section_title
 *               - slug
 *               - short_description
 *               - publishing_status
 *               - sort_order
 *             properties:
 *               category_id:
 *                 type: string
 *                 format: uuid
 *                 description: Mandatory category UUID.
 *                 example: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *               subcategory_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: Optional subcategory UUID. If provided, must belong to the selected category_id.
 *                 example: "a1111111-1111-1111-1111-111111111111"
 *               section_title:
 *                 type: string
 *                 maxLength: 255
 *                 example: "How to Book a Trader"
 *               slug:
 *                 type: string
 *                 maxLength: 255
 *                 example: "how-to-book-a-trader"
 *               short_description:
 *                 type: string
 *                 example: "Step-by-step instructions on finding and booking verified traders."
 *               detailed_content:
 *                 type: string
 *                 nullable: true
 *                 example: "Learn how to search by category, compare quotes, and confirm site visits."
 *               graphic_image_url:
 *                 type: string
 *                 format: uri
 *                 description: Graphic image URL string (alias graphic_image also accepted). JSON URL only; multipart/S3 later.
 *                 example: "https://cdn.example.com/images/booking-guide.png"
 *               graphic_image:
 *                 type: string
 *                 format: uri
 *                 description: Alias for graphic_image_url.
 *               icon:
 *                 type: string
 *                 maxLength: 2000
 *                 nullable: true
 *                 description: Icon name or uploaded media URL (alias section_icon).
 *                 example: "calendar-check"
 *               publishing_status:
 *                 type: string
 *                 enum: [draft, scheduled, published, archived]
 *                 example: "published"
 *               cta_button_text:
 *                 type: string
 *                 maxLength: 100
 *                 nullable: true
 *                 example: "Find a Trader"
 *               cta_url:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *                 example: "https://brisk.com/traders"
 *               sort_order:
 *                 type: integer
 *                 minimum: 0
 *                 example: 1
 *               seo_title:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 example: "How to Book a Trader | Brisk Knowledge Hub"
 *               meta_description:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *                 example: "Step-by-step guide to booking trusted local traders on Brisk."
 *               content_blocks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [type, sort_order]
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [step_card, feature_card, text_block, cta_banner]
 *                       example: "step_card"
 *                     sort_order:
 *                       type: integer
 *                       example: 1
 *                     title:
 *                       type: string
 *                       example: "Step 1: Choose a Service"
 *                     description:
 *                       type: string
 *                       example: "Select your desired trade category and describe your needs."
 *                     icon:
 *                       type: string
 *                       example: "search"
 *                     image:
 *                       type: string
 *                       format: uri
 *                       nullable: true
 *                       description: "Block image URL (alias image_url)."
 *                       example: "https://cdn.example.com/images/step1.png"
 *                     image_url:
 *                       type: string
 *                       format: uri
 *                       nullable: true
 *                       description: "Alias for image."
 *                     button_text:
 *                       type: string
 *                       nullable: true
 *                       example: "Browse Categories"
 *                     button_url:
 *                       type: string
 *                       nullable: true
 *                       example: "https://brisk.com/services"
 *                     content:
 *                       type: string
 *                       nullable: true
 *                       example: "Detailed explanation of service categories..."
 *           examples:
 *             withCategoryAndSubcategory:
 *               summary: Create section with Category & Subcategory
 *               value:
 *                 category_id: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *                 subcategory_id: "a1111111-1111-1111-1111-111111111111"
 *                 section_title: "How to Book a Trader"
 *                 slug: "how-to-book-a-trader"
 *                 short_description: "Step-by-step instructions on finding and booking verified traders."
 *                 detailed_content: "Learn how to search by category, compare quotes, and confirm site visits."
 *                 graphic_image_url: "https://cdn.example.com/images/booking-guide.png"
 *                 icon: "calendar-check"
 *                 publishing_status: "published"
 *                 cta_button_text: "Find a Trader"
 *                 cta_url: "https://brisk.com/traders"
 *                 sort_order: 1
 *                 seo_title: "How to Book a Trader | Brisk Knowledge Hub"
 *                 meta_description: "Step-by-step guide to booking trusted local traders on Brisk."
 *                 content_blocks:
 *                   - type: "step_card"
 *                     sort_order: 1
 *                     title: "Step 1: Choose a Service"
 *                     description: "Select your trade category and describe your needs."
 *                     icon: "search"
 *             categoryOnly:
 *               summary: Create section with Category only (subcategory is null)
 *               value:
 *                 category_id: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *                 subcategory_id: null
 *                 section_title: "General Platform Overview"
 *                 slug: "general-platform-overview"
 *                 short_description: "An introduction to how Brisk connects customers and traders."
 *                 publishing_status: "draft"
 *                 sort_order: 2
 *     responses:
 *       201:
 *         description: Knowledge Hub section created successfully.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Knowledge Hub section created successfully.
 *               data:
 *                 id: "4f9d2b80-1a23-4c56-b789-0123456789ab"
 *                 category_id: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *                 subcategory_id: "a1111111-1111-1111-1111-111111111111"
 *                 category:
 *                   id: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *                   name: "Customer Guides"
 *                   slug: "customer-guides"
 *                 subcategory:
 *                   id: "a1111111-1111-1111-1111-111111111111"
 *                   name: "Booking & Payments"
 *                   slug: "booking-payments"
 *                 section_title: "How to Book a Trader"
 *                 slug: "how-to-book-a-trader"
 *                 short_description: "Step-by-step instructions on finding and booking verified traders."
 *                 detailed_content: "Learn how to search by category, compare quotes, and confirm site visits."
 *                 graphic_image: "https://cdn.example.com/images/booking-guide.png"
 *                 icon: "calendar-check"
 *                 publishing_status: "published"
 *                 cta_button_text: "Find a Trader"
 *                 cta_url: "https://brisk.com/traders"
 *                 sort_order: 1
 *                 seo_title: "How to Book a Trader | Brisk Knowledge Hub"
 *                 meta_description: "Step-by-step guide to booking trusted local traders on Brisk."
 *                 blocks_count: 1
 *                 created_at: "2026-10-23T10:00:00.000Z"
 *                 updated_at: "2026-10-23T10:00:00.000Z"
 *                 content_blocks:
 *                   - id: "b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e"
 *                     type: "step_card"
 *                     title: "Step 1: Choose a Service"
 *                     description: "Select your trade category and describe your needs."
 *                     content: null
 *                     icon: "search"
 *                     image: null
 *                     button_text: null
 *                     button_url: null
 *                     sort_order: 1
 *                     created_at: "2026-10-23T10:00:00.000Z"
 *                     updated_at: "2026-10-23T10:00:00.000Z"
 *       400:
 *         description: Validation error (e.g. missing category_id or subcategory mismatch).
 *         content:
 *           application/json:
 *             examples:
 *               subcategoryMismatch:
 *                 summary: Subcategory does not belong to category
 *                 value:
 *                   success: false
 *                   message: "The selected subcategory does not belong to the selected category."
 *               missingCategoryId:
 *                 summary: Missing mandatory category_id
 *                 value:
 *                   success: false
 *                   message: "category_id is required"
 *                   error:
 *                     - field: "body.category_id"
 *                       message: "Required"
 *               invalidUuid:
 *                 summary: Invalid UUID format
 *                 value:
 *                   success: false
 *                   message: "Invalid ID format."
 *                   error:
 *                     - field: "body.category_id"
 *                       message: "Invalid ID format."
 *       404:
 *         description: Category or Subcategory not found.
 *         content:
 *           application/json:
 *             examples:
 *               categoryNotFound:
 *                 summary: Category does not exist
 *                 value:
 *                   success: false
 *                   message: "Knowledge category not found."
 *               subcategoryNotFound:
 *                 summary: Subcategory does not exist
 *                 value:
 *                   success: false
 *                   message: "Knowledge subcategory not found."
 *       409:
 *         description: Slug conflict.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Knowledge Hub section slug already exists."
 */
router.post('/sections', validate(createSectionSchema), controller.createSection);

/**
 * @swagger
 * /admin/knowledge-hub/bulk-status:
 *   post:
 *     summary: Bulk update Knowledge Hub section publishing status
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *     tags: ['Admin / Website / Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Knowledge Hub section UUID
 *         example: "4f9d2b80-1a23-4c56-b789-0123456789ab"
 *     responses:
 *       200:
 *         description: Knowledge Hub section fetched successfully.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Knowledge Hub section fetched successfully.
 *               data:
 *                 id: "4f9d2b80-1a23-4c56-b789-0123456789ab"
 *                 category_id: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *                 subcategory_id: "a1111111-1111-1111-1111-111111111111"
 *                 category:
 *                   id: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *                   name: "Customer Guides"
 *                   slug: "customer-guides"
 *                 subcategory:
 *                   id: "a1111111-1111-1111-1111-111111111111"
 *                   name: "Booking & Payments"
 *                   slug: "booking-payments"
 *                 section_title: "How to Book a Trader"
 *                 slug: "how-to-book-a-trader"
 *                 short_description: "Step-by-step instructions on finding and booking verified traders."
 *                 detailed_content: "Learn how to search by category, compare quotes, and confirm site visits."
 *                 graphic_image: "https://cdn.example.com/images/booking-guide.png"
 *                 icon: "calendar-check"
 *                 publishing_status: "published"
 *                 cta_button_text: "Find a Trader"
 *                 cta_url: "https://brisk.com/traders"
 *                 sort_order: 1
 *                 seo_title: "How to Book a Trader | Brisk Knowledge Hub"
 *                 meta_description: "Step-by-step guide to booking trusted local traders on Brisk."
 *                 blocks_count: 2
 *                 created_at: "2026-10-23T10:00:00.000Z"
 *                 updated_at: "2026-10-23T10:30:00.000Z"
 *                 content_blocks:
 *                   - id: "b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e"
 *                     type: "step_card"
 *                     title: "Step 1: Choose a Service"
 *                     description: "Select your trade category and describe your needs."
 *                     content: "Details about selecting categories..."
 *                     icon: "search"
 *                     image: "https://cdn.example.com/images/step1.png"
 *                     button_text: "Browse Categories"
 *                     button_url: "https://brisk.com/services"
 *                     sort_order: 1
 *                     created_at: "2026-10-23T10:00:00.000Z"
 *                     updated_at: "2026-10-23T10:00:00.000Z"
 *                   - id: "c2d3e4f5-a6b7-8c9d-0e1f-2a3b4c5d6e7f"
 *                     type: "feature_card"
 *                     title: "Step 2: Compare Quotes"
 *                     description: "Review instant prices and trader profiles."
 *                     content: null
 *                     icon: "check-circle"
 *                     image: null
 *                     button_text: null
 *                     button_url: null
 *                     sort_order: 2
 *                     created_at: "2026-10-23T10:05:00.000Z"
 *                     updated_at: "2026-10-23T10:05:00.000Z"
 *       400:
 *         description: Invalid UUID in path parameters.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid ID format."
 *               error:
 *                 - field: "params.id"
 *                   message: "Invalid ID format."
 *       404:
 *         description: Knowledge Hub section not found.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Knowledge Hub section not found."
 */
router.get('/sections/:id', validate(idParamSchema), controller.getSection);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}:
 *   put:
 *     summary: Update Knowledge Hub section
 *     tags: ['Admin / Website / Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Knowledge Hub section UUID
 *         example: "4f9d2b80-1a23-4c56-b789-0123456789ab"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_id
 *               - section_title
 *               - slug
 *               - short_description
 *               - publishing_status
 *               - sort_order
 *             properties:
 *               category_id:
 *                 type: string
 *                 format: uuid
 *                 description: Mandatory category UUID.
 *                 example: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *               subcategory_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: Optional subcategory UUID. If provided, must belong to the selected category_id. Pass null to remove subcategory.
 *                 example: "a1111111-1111-1111-1111-111111111111"
 *               section_title:
 *                 type: string
 *                 maxLength: 255
 *                 example: "How to Book a Trader (Updated)"
 *               slug:
 *                 type: string
 *                 maxLength: 255
 *                 example: "how-to-book-a-trader"
 *               short_description:
 *                 type: string
 *                 example: "Updated step-by-step instructions on booking verified traders."
 *               detailed_content:
 *                 type: string
 *                 nullable: true
 *                 example: "Comprehensive updated guide on searching and booking."
 *               graphic_image_url:
 *                 type: string
 *                 format: uri
 *                 description: Graphic image URL (alias graphic_image accepted). JSON URL only; multipart/S3 later.
 *                 example: "https://cdn.example.com/images/booking-guide-v2.png"
 *               graphic_image:
 *                 type: string
 *                 format: uri
 *                 description: Alias for graphic_image_url.
 *               icon:
 *                 type: string
 *                 maxLength: 2000
 *                 nullable: true
 *                 description: Icon name or uploaded media URL (alias section_icon).
 *                 example: "calendar-check"
 *               publishing_status:
 *                 type: string
 *                 enum: [draft, scheduled, published, archived]
 *                 example: "published"
 *               cta_button_text:
 *                 type: string
 *                 maxLength: 100
 *                 nullable: true
 *                 example: "Book Now"
 *               cta_url:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *                 example: "https://brisk.com/traders"
 *               sort_order:
 *                 type: integer
 *                 minimum: 0
 *                 example: 1
 *               seo_title:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 example: "How to Book a Trader | Brisk"
 *               meta_description:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *                 example: "Step-by-step guide to finding trusted traders."
 *               content_blocks:
 *                 type: array
 *                 description: When provided, replaces all existing content blocks.
 *                 items:
 *                   type: object
 *                   required: [type, sort_order]
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [step_card, feature_card, text_block, cta_banner]
 *                       example: "step_card"
 *                     sort_order:
 *                       type: integer
 *                       example: 1
 *                     title:
 *                       type: string
 *                       example: "Step 1: Choose a Service"
 *                     description:
 *                       type: string
 *                       example: "Select your trade category and describe your needs."
 *                     icon:
 *                       type: string
 *                       example: "search"
 *                     image:
 *                       type: string
 *                       format: uri
 *                       nullable: true
 *                       example: "https://cdn.example.com/images/step1.png"
 *                     image_url:
 *                       type: string
 *                       format: uri
 *                       nullable: true
 *                     button_text:
 *                       type: string
 *                       nullable: true
 *                       example: "Browse Categories"
 *                     button_url:
 *                       type: string
 *                       nullable: true
 *                       example: "https://brisk.com/services"
 *                     content:
 *                       type: string
 *                       nullable: true
 *           examples:
 *             fullUpdate:
 *               summary: Update section with Category and Subcategory
 *               value:
 *                 category_id: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *                 subcategory_id: "a1111111-1111-1111-1111-111111111111"
 *                 section_title: "How to Book a Trader (Updated)"
 *                 slug: "how-to-book-a-trader"
 *                 short_description: "Updated step-by-step instructions on booking verified traders."
 *                 detailed_content: "Comprehensive updated guide on searching and booking."
 *                 graphic_image_url: "https://cdn.example.com/images/booking-guide-v2.png"
 *                 icon: "calendar-check"
 *                 publishing_status: "published"
 *                 cta_button_text: "Book Now"
 *                 cta_url: "https://brisk.com/traders"
 *                 sort_order: 1
 *                 seo_title: "How to Book a Trader | Brisk"
 *                 meta_description: "Step-by-step guide to finding trusted traders."
 *             clearSubcategory:
 *               summary: Update section and clear subcategory (category only)
 *               value:
 *                 category_id: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *                 subcategory_id: null
 *                 section_title: "Platform Overview"
 *                 slug: "platform-overview"
 *                 short_description: "General guide without subcategory."
 *                 publishing_status: "published"
 *                 sort_order: 2
 *     responses:
 *       200:
 *         description: Knowledge Hub section updated successfully.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Knowledge Hub section updated successfully.
 *               data:
 *                 id: "4f9d2b80-1a23-4c56-b789-0123456789ab"
 *                 category_id: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *                 subcategory_id: "a1111111-1111-1111-1111-111111111111"
 *                 category:
 *                   id: "e076d231-b0da-46cb-b60d-8aa9fbb8ce26"
 *                   name: "Customer Guides"
 *                   slug: "customer-guides"
 *                 subcategory:
 *                   id: "a1111111-1111-1111-1111-111111111111"
 *                   name: "Booking & Payments"
 *                   slug: "booking-payments"
 *                 section_title: "How to Book a Trader (Updated)"
 *                 slug: "how-to-book-a-trader"
 *                 short_description: "Updated step-by-step instructions on booking verified traders."
 *                 detailed_content: "Comprehensive updated guide on searching and booking."
 *                 graphic_image: "https://cdn.example.com/images/booking-guide-v2.png"
 *                 icon: "calendar-check"
 *                 publishing_status: "published"
 *                 cta_button_text: "Book Now"
 *                 cta_url: "https://brisk.com/traders"
 *                 sort_order: 1
 *                 seo_title: "How to Book a Trader | Brisk"
 *                 meta_description: "Step-by-step guide to finding trusted traders."
 *                 blocks_count: 0
 *                 created_at: "2026-10-23T10:00:00.000Z"
 *                 updated_at: "2026-10-23T10:45:00.000Z"
 *       400:
 *         description: Validation error (e.g. subcategory mismatch or missing category_id).
 *         content:
 *           application/json:
 *             examples:
 *               subcategoryMismatch:
 *                 summary: Subcategory does not belong to category
 *                 value:
 *                   success: false
 *                   message: "The selected subcategory does not belong to the selected category."
 *               missingCategoryId:
 *                 summary: Missing mandatory category_id
 *                 value:
 *                   success: false
 *                   message: "category_id is required"
 *                   error:
 *                     - field: "body.category_id"
 *                       message: "Required"
 *               invalidUuid:
 *                 summary: Invalid UUID in body or path
 *                 value:
 *                   success: false
 *                   message: "Invalid ID format."
 *                   error:
 *                     - field: "body.category_id"
 *                       message: "Invalid ID format."
 *       404:
 *         description: Section, Category, or Subcategory not found.
 *         content:
 *           application/json:
 *             examples:
 *               sectionNotFound:
 *                 summary: Section not found
 *                 value:
 *                   success: false
 *                   message: "Knowledge Hub section not found."
 *               categoryNotFound:
 *                 summary: Category not found
 *                 value:
 *                   success: false
 *                   message: "Knowledge category not found."
 *               subcategoryNotFound:
 *                 summary: Subcategory not found
 *                 value:
 *                   success: false
 *                   message: "Knowledge subcategory not found."
 *       409:
 *         description: Slug conflict with another section.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Knowledge Hub section slug already in use."
 */
router.put('/sections/:id', validate(updateSectionSchema), controller.updateSection);

/**
 * @swagger
 * /admin/knowledge-hub/sections/{id}:
 *   delete:
 *     summary: Soft-delete Knowledge Hub section
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *     tags: ['Admin / Website / Knowledge Hub']
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

// ==========================================
// KNOWLEDGE HUB CATEGORIES & SUBCATEGORIES
// ==========================================

/**
 * @swagger
 * /admin/knowledge-hub/categories:
 *   get:
 *     summary: List Knowledge Hub categories
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Knowledge categories fetched successfully.
 */
router.get(
  '/categories',
  validate(listKnowledgeCategoriesQuerySchema),
  controller.listKnowledgeCategories
);

/**
 * @swagger
 * /admin/knowledge-hub/categories:
 *   post:
 *     summary: Create a Knowledge Hub category
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *               - slug
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *               icon: { type: string }
 *               status: { type: string, enum: [active, inactive] }
 *               sort_order: { type: integer, default: 0 }
 *     responses:
 *       201:
 *         description: Knowledge category created successfully.
 */
router.post(
  '/categories',
  validate(createKnowledgeCategorySchema),
  controller.createKnowledgeCategory
);

/**
 * @swagger
 * /admin/knowledge-hub/categories/{id}:
 *   get:
 *     summary: Get Knowledge Hub category by ID
 *     tags: ['Admin / Website / Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Knowledge category fetched successfully.
 */
router.get(
  '/categories/:id',
  validate(idParamSchema),
  controller.getKnowledgeCategory
);

/**
 * @swagger
 * /admin/knowledge-hub/categories/{id}:
 *   put:
 *     summary: Update Knowledge Hub category
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *               slug: { type: string }
 *               description: { type: string }
 *               icon: { type: string }
 *               status: { type: string, enum: [active, inactive] }
 *               sort_order: { type: integer }
 *     responses:
 *       200:
 *         description: Knowledge category updated successfully.
 */
router.put(
  '/categories/:id',
  validate(updateKnowledgeCategorySchema),
  controller.updateKnowledgeCategory
);

/**
 * @swagger
 * /admin/knowledge-hub/categories/{id}:
 *   delete:
 *     summary: Delete Knowledge Hub category
 *     tags: ['Admin / Website / Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Knowledge category deleted successfully.
 */
router.delete(
  '/categories/:id',
  validate(idParamSchema),
  controller.deleteKnowledgeCategory
);

/**
 * @swagger
 * /admin/knowledge-hub/subcategories:
 *   get:
 *     summary: List Knowledge Hub subcategories
 *     tags: ['Admin / Website / Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Knowledge subcategories fetched successfully.
 */
router.get(
  ['/subcategories', '/categories/:categoryId/subcategories'],
  validate(listKnowledgeSubcategoriesQuerySchema),
  controller.listKnowledgeSubcategories
);

/**
 * @swagger
 * /admin/knowledge-hub/subcategories:
 *   post:
 *     summary: Create Knowledge Hub subcategory
 *     tags: ['Admin / Website / Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_id
 *               - name
 *               - slug
 *             properties:
 *               category_id: { type: string, format: uuid }
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *               icon: { type: string }
 *               status: { type: string, enum: [active, inactive] }
 *               sort_order: { type: integer, default: 0 }
 *     responses:
 *       201:
 *         description: Knowledge subcategory created successfully.
 */
router.post(
  ['/subcategories', '/categories/:categoryId/subcategories'],
  validate(createKnowledgeSubcategorySchema),
  controller.createKnowledgeSubcategory
);

/**
 * @swagger
 * /admin/knowledge-hub/subcategories/{id}:
 *   get:
 *     summary: Get Knowledge Hub subcategory by ID
 *     tags: ['Admin / Website / Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Knowledge subcategory fetched successfully.
 */
router.get(
  '/subcategories/:id',
  validate(idParamSchema),
  controller.getKnowledgeSubcategory
);

/**
 * @swagger
 * /admin/knowledge-hub/subcategories/{id}:
 *   put:
 *     summary: Update Knowledge Hub subcategory
 *     tags: ['Admin / Website / Knowledge Hub']
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
 *               category_id: { type: string, format: uuid }
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *               icon: { type: string }
 *               status: { type: string, enum: [active, inactive] }
 *               sort_order: { type: integer }
 *     responses:
 *       200:
 *         description: Knowledge subcategory updated successfully.
 */
router.put(
  '/subcategories/:id',
  validate(updateKnowledgeSubcategorySchema),
  controller.updateKnowledgeSubcategory
);

/**
 * @swagger
 * /admin/knowledge-hub/subcategories/{id}:
 *   delete:
 *     summary: Delete Knowledge Hub subcategory
 *     tags: ['Admin / Website / Knowledge Hub']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Knowledge subcategory deleted successfully.
 */
router.delete(
  '/subcategories/:id',
  validate(idParamSchema),
  controller.deleteKnowledgeSubcategory
);

export default router;

