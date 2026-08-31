import { Router } from 'express';
import * as cmsAdminController from './admin-cms.controller';
import * as pageSectionsAdminController from './page-sections.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import {
  listFilterSchema,
  idParamSchema,
  createPageSchema,
  updatePageSchema,
  createSocialLinkSchema,
  updateSocialLinkSchema,
  createFaqCategorySchema,
  createFaqSchema,
  updateFaqSchema,
  reorderFaqsSchema,
  createTestimonialSchema,
  updateTestimonialSchema,
  testimonialStatusSchema,
  testimonialSortOrderSchema,
  createLegalPolicySchema,
  updateLegalPolicySchema,
  publishLegalVersionSchema,
  updateSeoSchema,
  updateContactSettingsSchema,
  dashboardAuditSchema,
} from './admin-cms.validation';
import {
  upsertPageSectionSchema,
  updatePageSectionSchema,
  pageSlugSectionKeyParamsSchema,
  pageSlugParamSchema,
  createMarketingPageSchema,
  sectionIdParamSchema,
  createSectionItemSchema,
  updateSectionItemSchema,
  sectionItemIdParamSchema,
  sectionItemSortOrderSchema,
  sectionStatusSchema,
  sectionSortOrderSchema,
  sectionItemStatusSchema,
  updateSectionByIdSchema,
} from '../../cms/page-sections.validation';

import homeAdminRoutes from './home-admin.routes';

const router = Router();

// Apply Admin Auth Middleware across all CMS admin routes
router.use(adminAuthMiddleware);

// ==========================================
// CMS DASHBOARD
// ==========================================

/**
 * @swagger
 * /admin/cms/dashboard/stats:
 *   get:
 *     summary: Retrieve CMS Dashboard KPI Stat Cards
 *     tags: ['Admin / Website / Dashboard']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CMS dashboard stats retrieved successfully.
 *       401:
 *         description: Missing or invalid Admin JWT token.
 */
router.get('/dashboard/stats', cmsAdminController.getCmsDashboardStats);

/**
 * @swagger
 * /admin/cms/dashboard/audit:
 *   get:
 *     summary: Retrieve Recent CMS Audit Activity Log
 *     tags: ['Admin / Website / Dashboard']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number (1-based).
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: Rows per page (max 100). Default 20.
 *     responses:
 *       200:
 *         description: |
 *           CMS dashboard audit activity retrieved successfully.
 *           `data.items` shape is unchanged; `data.meta` adds `{ total, page, limit, totalPages }`.
 *       401:
 *         description: Missing or invalid Admin JWT token.
 */
router.get('/dashboard/audit', validate(dashboardAuditSchema), cmsAdminController.getCmsDashboardAudit);

// ==========================================
// WEBSITE PAGES
// ==========================================

/**
 * @swagger
 * /admin/cms/pages:
 *   get:
 *     summary: List Website Pages (Paginated, Search, Status & Audience Filters)
 *     tags: ['Admin / Website / Pages']
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
 *         description: Search by page title or slug.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *         description: Filter by publish status.
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER] }
 *         description: Filter by target audience.
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *         description: Sort order (e.g. newest, oldest).
 *     responses:
 *       200:
 *         description: Website pages retrieved successfully.
 *       401:
 *         description: Missing or invalid Admin JWT token.
 */
router.get('/pages', validate(listFilterSchema), cmsAdminController.listPages);

/**
 * @swagger
 * /admin/cms/pages:
 *   post:
 *     summary: Create new Website Page
 *     tags: ['Admin / Website / Pages']
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
 *               - slug
 *             properties:
 *               title: { type: string, example: 'About BRISK' }
 *               slug: { type: string, example: 'about-brisk' }
 *               content: { type: string, example: '<p>About BRISK content...</p>' }
 *               targetAudience: { type: string, enum: [BOTH, CUSTOMER, TRADER], example: 'BOTH' }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED], example: 'DRAFT' }
 *               isActive: { type: boolean, example: true }
 *     responses:
 *       201:
 *         description: Website page created successfully.
 *       400:
 *         description: Validation error.
 *       409:
 *         description: Page slug conflict.
 */
router.post('/pages', validate(createPageSchema), cmsAdminController.createPage);

/**
 * @swagger
 * /admin/cms/pages/{id}:
 *   get:
 *     summary: Get Website Page detail by ID
 *     tags: ['Admin / Website / Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Website page retrieved successfully.
 *       404:
 *         description: Website page not found.
 */
router.get('/pages/:id', validate(idParamSchema), cmsAdminController.getPage);

/**
 * @swagger
 * /admin/cms/pages/{id}:
 *   patch:
 *     summary: Update Website Page
 *     tags: ['Admin / Website / Pages']
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
 *               title: { type: string }
 *               slug: { type: string }
 *               content: { type: string }
 *               targetAudience: { type: string, enum: [BOTH, CUSTOMER, TRADER] }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Website page updated successfully.
 *       404:
 *         description: Website page not found.
 */
router.patch('/pages/:id', validate(updatePageSchema), cmsAdminController.updatePage);

/**
 * @swagger
 * /admin/cms/pages/{id}/toggle:
 *   patch:
 *     summary: Toggle Website Page active status
 *     tags: ['Admin / Website / Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Website page active status toggled successfully.
 *       404:
 *         description: Website page not found.
 */
router.patch('/pages/:id/toggle', validate(idParamSchema), cmsAdminController.togglePageActive);

/**
 * @swagger
 * /admin/cms/pages/{id}/duplicate:
 *   post:
 *     summary: Duplicate Website Page
 *     tags: ['Admin / Website / Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Website page duplicated successfully.
 *       404:
 *         description: Website page not found.
 */
router.post('/pages/:id/duplicate', validate(idParamSchema), cmsAdminController.duplicatePage);

/**
 * @swagger
 * /admin/cms/pages/{id}:
 *   delete:
 *     summary: Delete Website Page
 *     tags: ['Admin / Website / Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Website page deleted successfully.
 *       404:
 *         description: Website page not found.
 */
router.delete('/pages/:id', validate(idParamSchema), cmsAdminController.deletePage);

// ==========================================
// SOCIAL LINKS
// ==========================================

/**
 * @swagger
 * /admin/cms/social-links:
 *   get:
 *     summary: List Social Links (Paginated, Search & Status Filters)
 *     tags: ['Admin / Website / Social Links']
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
 *         description: Search by platform name or profile URL.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE] }
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Social links retrieved successfully.
 */
router.get('/social-links', validate(listFilterSchema), cmsAdminController.listSocialLinks);

/**
 * @swagger
 * /admin/cms/social-links:
 *   post:
 *     summary: Create new Social Link
 *     tags: ['Admin / Website / Social Links']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - platform
 *               - profileUrl
 *             properties:
 *               platform: { type: string, example: 'LinkedIn' }
 *               profileUrl: { type: string, example: 'https://linkedin.com/company/brisk' }
 *               sortOrder: { type: integer, example: 0 }
 *               status: { type: string, enum: [ACTIVE, INACTIVE], example: 'ACTIVE' }
 *     responses:
 *       201:
 *         description: Social link created successfully.
 *       400:
 *         description: Validation error.
 */
router.post('/social-links', validate(createSocialLinkSchema), cmsAdminController.createSocialLink);

/**
 * @swagger
 * /admin/cms/social-links/{id}:
 *   patch:
 *     summary: Update Social Link
 *     tags: ['Admin / Website / Social Links']
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
 *               platform: { type: string }
 *               profileUrl: { type: string }
 *               sortOrder: { type: integer }
 *               status: { type: string, enum: [ACTIVE, INACTIVE] }
 *     responses:
 *       200:
 *         description: Social link updated successfully.
 *       404:
 *         description: Social link not found.
 */
router.patch('/social-links/:id', validate(updateSocialLinkSchema), cmsAdminController.updateSocialLink);

/**
 * @swagger
 * /admin/cms/social-links/{id}:
 *   delete:
 *     summary: Delete Social Link
 *     tags: ['Admin / Website / Social Links']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Social link deleted successfully.
 *       404:
 *         description: Social link not found.
 */
router.delete('/social-links/:id', validate(idParamSchema), cmsAdminController.deleteSocialLink);

// ==========================================
// FAQ CATEGORIES & FAQS
// ==========================================

/**
 * @swagger
 * /admin/cms/faq-categories:
 *   get:
 *     summary: List FAQ Categories
 *     tags: ['Admin / Website / FAQ']
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
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: FAQ categories retrieved successfully.
 */
router.get('/faq-categories', validate(listFilterSchema), cmsAdminController.listFaqCategories);

/**
 * @swagger
 * /admin/cms/faq-categories:
 *   post:
 *     summary: Create FAQ Category
 *     tags: ['Admin / Website / FAQ']
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
 *               name: { type: string, example: 'Payments' }
 *               slug: { type: string, example: 'payments' }
 *     responses:
 *       201:
 *         description: FAQ category created successfully.
 *       409:
 *         description: FAQ category slug conflict.
 */
router.post('/faq-categories', validate(createFaqCategorySchema), cmsAdminController.createFaqCategory);

/**
 * @swagger
 * /admin/cms/faqs:
 *   get:
 *     summary: List FAQs (Paginated, Search, Category, Audience & Status Filters)
 *     tags: ['Admin / Website / FAQ']
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
 *         description: Search by question or answer.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER] }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: pageType
 *         schema: { type: string, enum: [CUSTOMER, TRADER, HOME, ABOUT_US, aboutUs] }
 *         description: Filter by page. Use `aboutUs` for About Us FAQs.
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: FAQs retrieved successfully.
 */
router.get('/faqs', validate(listFilterSchema), cmsAdminController.listFaqs);

/**
 * @swagger
 * /admin/cms/faqs:
 *   post:
 *     summary: Create FAQ Item
 *     tags: ['Admin / Website / FAQ']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *               - answer
 *             properties:
 *               question: { type: string, example: 'How does escrow work?' }
 *               answer: { type: string, example: 'Funds are held securely until milestones are approved.' }
 *               categoryId: { type: string, format: uuid }
 *               targetAudience: { type: string, enum: [BOTH, CUSTOMER, TRADER], example: 'BOTH' }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED], example: 'PUBLISHED' }
 *               displayOrder: { type: integer, example: 0 }
 *     responses:
 *       201:
 *         description: FAQ created successfully.
 */
router.post('/faqs', validate(createFaqSchema), cmsAdminController.createFaq);

/**
 * @swagger
 * /admin/cms/faqs/reorder:
 *   patch:
 *     summary: Bulk Reorder FAQ Items by displayOrder
 *     tags: ['Admin / Website / FAQ']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, displayOrder]
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     displayOrder: { type: integer }
 *     responses:
 *       200:
 *         description: FAQs reordered successfully.
 *       400:
 *         description: Reorder items are required.
 */
router.patch('/faqs/reorder', validate(reorderFaqsSchema), cmsAdminController.reorderFaqs);

/**
 * @swagger
 * /admin/cms/faqs/{id}:
 *   get:
 *     summary: Get FAQ detail by ID
 *     tags: ['Admin / Website / FAQ']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: FAQ retrieved successfully.
 *       404:
 *         description: FAQ not found.
 */
router.get('/faqs/:id', validate(idParamSchema), cmsAdminController.getFaq);

/**
 * @swagger
 * /admin/cms/faqs/{id}:
 *   patch:
 *     summary: Update FAQ Item
 *     tags: ['Admin / Website / FAQ']
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
 *               question: { type: string }
 *               answer: { type: string }
 *               categoryId: { type: string, format: uuid, nullable: true }
 *               targetAudience: { type: string, enum: [BOTH, CUSTOMER, TRADER] }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *               displayOrder: { type: integer }
 *     responses:
 *       200:
 *         description: FAQ updated successfully.
 *       404:
 *         description: FAQ not found.
 */
router.patch('/faqs/:id', validate(updateFaqSchema), cmsAdminController.updateFaq);

/**
 * @swagger
 * /admin/cms/faqs/{id}:
 *   delete:
 *     summary: Delete FAQ Item
 *     tags: ['Admin / Website / FAQ']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: FAQ deleted successfully.
 *       404:
 *         description: FAQ not found.
 */
router.delete('/faqs/:id', validate(idParamSchema), cmsAdminController.deleteFaq);

// ==========================================
// TESTIMONIALS
// ==========================================

/**
 * @swagger
 * /admin/cms/testimonials/stats:
 *   get:
 *     summary: Retrieve Testimonial KPI Stats
 *     tags: ['Admin / Website / Testimonials']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Testimonial stats retrieved successfully (total published, avg rating, featured count).
 */
router.get('/testimonials/stats', cmsAdminController.getTestimonialStats);

/**
 * @swagger
 * /admin/cms/testimonials:
 *   get:
 *     summary: List Testimonials (Paginated, Search, Audience, Status & Featured Filters)
 *     tags: ['Admin / Website / Testimonials']
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
 *         description: Search by author, company, or quote.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER] }
 *       - in: query
 *         name: featured
 *         schema: { type: boolean }
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Testimonials retrieved successfully.
 */
router.get('/testimonials', validate(listFilterSchema), cmsAdminController.listTestimonials);

/**
 * @swagger
 * /admin/cms/testimonials:
 *   post:
 *     summary: Create Testimonial
 *     tags: ['Admin / Website / Testimonials']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - authorName
 *               - quoteText
 *             properties:
 *               authorName: { type: string, example: 'Sarah Murphy' }
 *               authorRole: { type: string, example: 'Homeowner' }
 *               companyName: { type: string, example: 'Murphy Residences' }
 *               badgeLabel: { type: string, example: 'Verified Customer' }
 *               authorAvatarUrl: { type: string, example: 'https://cdn.brisk.com/avatars/sarah.jpg' }
 *               quoteText: { type: string, example: 'BRISK made hiring a trader effortless.' }
 *               rating: { type: integer, minimum: 1, maximum: 5, example: 5 }
 *               targetAudience: { type: string, enum: [BOTH, CUSTOMER, TRADER], example: 'BOTH' }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED], example: 'PUBLISHED' }
 *               isFeatured: { type: boolean, example: false }
 *               displayOrder: { type: integer, example: 0 }
 *     responses:
 *       201:
 *         description: Testimonial created successfully.
 */
router.post('/testimonials', validate(createTestimonialSchema), cmsAdminController.createTestimonial);

/**
 * @swagger
 * /admin/cms/testimonials/{id}:
 *   patch:
 *     summary: Update Testimonial
 *     tags: ['Admin / Website / Testimonials']
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
 *               authorName: { type: string }
 *               authorRole: { type: string }
 *               companyName: { type: string }
 *               badgeLabel: { type: string }
 *               authorAvatarUrl: { type: string }
 *               quoteText: { type: string }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               targetAudience: { type: string, enum: [BOTH, CUSTOMER, TRADER] }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *               isFeatured: { type: boolean }
 *               displayOrder: { type: integer }
 *     responses:
 *       200:
 *         description: Testimonial updated successfully.
 *       404:
 *         description: Testimonial not found.
 */
router.patch('/testimonials/:id', validate(updateTestimonialSchema), cmsAdminController.updateTestimonial);
router.put('/testimonials/:id', validate(updateTestimonialSchema), cmsAdminController.updateTestimonial);

/**
 * @swagger
 * /admin/cms/testimonials/{id}:
 *   delete:
 *     summary: Delete Testimonial
 *     tags: ['Admin / Website / Testimonials']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Testimonial deleted successfully.
 *       404:
 *         description: Testimonial not found.
 */
router.delete('/testimonials/:id', validate(idParamSchema), cmsAdminController.deleteTestimonial);

/**
 * @swagger
 * /admin/cms/testimonials/{id}:
 *   get:
 *     summary: Get testimonial by ID
 *     tags: ['Admin / Website / Testimonials']
 *     security:
 *       - bearerAuth: []
 */
router.get('/testimonials/:id', validate(idParamSchema), cmsAdminController.getTestimonial);

router.patch(
  '/testimonials/:id/status',
  validate(testimonialStatusSchema),
  cmsAdminController.updateTestimonialStatus
);

router.patch(
  '/testimonials/:id/sort-order',
  validate(testimonialSortOrderSchema),
  cmsAdminController.updateTestimonialSortOrder
);

// ==========================================
// MARKETING PAGE SECTIONS
// (customers | traders | home | about-brisk | contact-brisk)
// ==========================================

/**
 * @swagger
 * /admin/cms/marketing-pages:
 *   get:
 *     summary: List all CMS marketing pages
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns every marketing page row (slug + sectionsCount).
 *
 *       **Exact pageSlug values for FE:**
 *       - `customers` — For Customers
 *       - `traders` — For Traders
 *       - `home` — Homepage (admin also has `/admin/cms/home`)
 *       - `about-brisk` — **About Us**
 *       - `contact-brisk` — **Contact Us**
 *
 *       Public website reads: `GET /pages/{pageSlug}` (snake_case fields).
 *     responses:
 *       200:
 *         description: Marketing pages list.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Marketing pages retrieved successfully.
 *               data:
 *                 - id: 57ee285a-6fa2-4087-a54c-ebce2aab6c34
 *                   slug: about-brisk
 *                   title: About Us
 *                   status: PUBLISHED
 *                   sectionsCount: 4
 *                 - id: aa11bb22-cc33-4455-6677-889900aabbcc
 *                   slug: contact-brisk
 *                   title: Contact Us
 *                   status: PUBLISHED
 *                   sectionsCount: 4
 *       401:
 *         description: Unauthorized.
 *   post:
 *     summary: Create a marketing page (by slug)
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates an empty page shell. Then add sections via
 *       `POST /admin/cms/marketing-pages/{pageSlug}/sections/{sectionKey}`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slug, title]
 *             properties:
 *               slug: { type: string, example: about-brisk }
 *               title: { type: string, example: About Us }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED], example: PUBLISHED }
 *           example:
 *             slug: about-brisk
 *             title: About Us
 *             status: PUBLISHED
 *     responses:
 *       201:
 *         description: Page created.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Marketing page created successfully.
 *               data:
 *                 id: 57ee285a-6fa2-4087-a54c-ebce2aab6c34
 *                 slug: about-brisk
 *                 title: About Us
 *                 status: PUBLISHED
 *                 sectionsCount: 0
 *       400:
 *         description: Validation error or slug already exists.
 *       401:
 *         description: Unauthorized.
 */
router.get('/marketing-pages', pageSectionsAdminController.listAdminMarketingPages);
router.post(
  '/marketing-pages',
  validate(createMarketingPageSchema),
  pageSectionsAdminController.createAdminMarketingPage
);

/**
 * @swagger
 * /admin/cms/marketing-pages/{pageSlug}/sections:
 *   get:
 *     summary: List all sections for a page
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **About Us:** `pageSlug=about-brisk`  
 *       **Contact Us:** `pageSlug=contact-brisk`
 *
 *       Seeded About sections: `hero`, `mission`, `vision`, `core_values`  
 *       Seeded Contact sections: `hero`, `contact_info`, `help_desks`, `map`
 *     parameters:
 *       - in: path
 *         name: pageSlug
 *         required: true
 *         schema:
 *           type: string
 *           enum: [customers, traders, home, about-brisk, contact-brisk]
 *           example: about-brisk
 *         description: Exact slug — About Us = about-brisk · Contact Us = contact-brisk
 *     responses:
 *       200:
 *         description: Sections with nested items (admin camelCase).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Page sections retrieved successfully.
 *               data:
 *                 - id: 11111111-1111-1111-1111-111111111111
 *                   pageId: 22222222-2222-2222-2222-222222222222
 *                   sectionType: hero
 *                   sectionKey: hero
 *                   title: About BRISK
 *                   subtitle: Making Things Quicker
 *                   description: BRISK connects customers with verified local traders across Ireland.
 *                   primaryButtonText: Get Started
 *                   primaryButtonUrl: /customers
 *                   status: PUBLISHED
 *                   sortOrder: 1
 *                   items: []
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Page slug not found.
 */
router.get(
  '/marketing-pages/:pageSlug/sections',
  validate(pageSlugParamSchema),
  pageSectionsAdminController.listAdminPageSections
);

/**
 * @swagger
 * /admin/cms/marketing-pages/{pageSlug}/sections/{sectionKey}:
 *   get:
 *     summary: Get one page section by key
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageSlug
 *         required: true
 *         schema:
 *           type: string
 *           enum: [customers, traders, home, about-brisk, contact-brisk]
 *           example: about-brisk
 *       - in: path
 *         name: sectionKey
 *         required: true
 *         schema: { type: string, example: hero }
 *         description: |
 *           About — hero, mission, vision, core_values  
 *           Contact — hero, contact_info, help_desks, map
 *     responses:
 *       200:
 *         description: Section with items.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Page section retrieved successfully.
 *               data:
 *                 id: 11111111-1111-1111-1111-111111111111
 *                 sectionKey: mission
 *                 sectionType: content
 *                 title: Our Mission
 *                 description: To make hiring trusted trade professionals simple...
 *                 status: PUBLISHED
 *                 sortOrder: 2
 *                 items: []
 *       404:
 *         description: Section not found.
 *   post:
 *     summary: Create / upsert section by sectionKey
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageSlug
 *         required: true
 *         schema: { type: string, example: about-brisk }
 *       - in: path
 *         name: sectionKey
 *         required: true
 *         schema: { type: string, example: mission }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sectionType]
 *             properties:
 *               sectionType: { type: string, example: content }
 *               title: { type: string, example: Our Mission }
 *               subtitle: { type: string, example: null }
 *               description: { type: string, example: To make hiring trusted professionals simple. }
 *               primaryButtonText: { type: string }
 *               primaryButtonUrl: { type: string }
 *               secondaryButtonText: { type: string }
 *               secondaryButtonUrl: { type: string }
 *               backgroundImage: { type: string }
 *               foregroundImage: { type: string }
 *               backgroundVideo: { type: string }
 *               appStoreUrl: { type: string }
 *               googlePlayUrl: { type: string }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED], example: PUBLISHED }
 *               sortOrder: { type: integer, example: 2 }
 *           example:
 *             sectionType: content
 *             title: Our Mission
 *             description: To make hiring trusted trade professionals simple, transparent, and fast.
 *             status: PUBLISHED
 *             sortOrder: 2
 *     responses:
 *       200:
 *         description: Section created or updated.
 *       400:
 *         description: Validation error (sectionType required on create).
 *       404:
 *         description: Page not found.
 *   put:
 *     summary: Update section content by pageSlug + sectionKey
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageSlug
 *         required: true
 *         schema: { type: string, example: contact-brisk }
 *       - in: path
 *         name: sectionKey
 *         required: true
 *         schema: { type: string, example: hero }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: Contact Us }
 *               subtitle: { type: string, example: We are here to help }
 *               description: { type: string }
 *               primaryButtonText: { type: string }
 *               primaryButtonUrl: { type: string }
 *               secondaryButtonText: { type: string }
 *               secondaryButtonUrl: { type: string }
 *               backgroundImage: { type: string }
 *               backgroundVideo: { type: string }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *               sortOrder: { type: integer }
 *           example:
 *             title: Contact Us
 *             subtitle: We are here to help
 *             description: Reach the BRISK team for support or partnerships.
 *             status: PUBLISHED
 *     responses:
 *       200:
 *         description: Section updated.
 *       404:
 *         description: Page or section not found.
 */
router.get(
  '/marketing-pages/:pageSlug/sections/:sectionKey',
  validate(pageSlugSectionKeyParamsSchema),
  pageSectionsAdminController.getAdminPageSection
);

router.post(
  '/marketing-pages/:pageSlug/sections/:sectionKey',
  validate(upsertPageSectionSchema),
  pageSectionsAdminController.upsertAdminPageSection
);

router.put(
  '/marketing-pages/:pageSlug/sections/:sectionKey',
  validate(updatePageSectionSchema),
  pageSectionsAdminController.upsertAdminPageSection
);

/**
 * @swagger
 * /admin/cms/sections/{sectionId}:
 *   get:
 *     summary: Get section by ID
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Section retrieved.
 *   put:
 *     summary: Update section by ID
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               subtitle: { type: string }
 *               description: { type: string }
 *               primaryButtonText: { type: string }
 *               primaryButtonUrl: { type: string }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *               sortOrder: { type: integer }
 *     responses:
 *       200:
 *         description: Section updated.
 *   delete:
 *     summary: Delete section by ID
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Section deleted.
 */
router.get(
  '/sections/:sectionId',
  validate(sectionIdParamSchema),
  pageSectionsAdminController.getAdminSectionById
);

router.put(
  '/sections/:sectionId',
  validate(updateSectionByIdSchema),
  pageSectionsAdminController.updateAdminSectionById
);

router.delete(
  '/sections/:sectionId',
  validate(sectionIdParamSchema),
  pageSectionsAdminController.deleteAdminSectionById
);

/**
 * @swagger
 * /admin/cms/sections/{sectionId}/status:
 *   patch:
 *     summary: Publish / draft / archive a section
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Works for any marketing page section (including `about-brisk` and `contact-brisk`).
 *       Get `sectionId` from `GET /admin/cms/marketing-pages/{pageSlug}/sections`.
 *     parameters:
 *       - in: path
 *         name: sectionId
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
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED], example: PUBLISHED }
 *           example:
 *             status: PUBLISHED
 *     responses:
 *       200:
 *         description: Status updated.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Section status updated.
 *               data:
 *                 id: 11111111-1111-1111-1111-111111111111
 *                 sectionKey: hero
 *                 status: PUBLISHED
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Section not found.
 */
router.patch(
  '/sections/:sectionId/status',
  validate(sectionStatusSchema),
  pageSectionsAdminController.updateAdminSectionStatus
);

/**
 * @swagger
 * /admin/cms/sections/{sectionId}/sort-order:
 *   patch:
 *     summary: Reorder section on the page
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     description: Lower `sortOrder` appears first on About/Contact/Customers/Traders pages.
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sortOrder]
 *             properties:
 *               sortOrder: { type: integer, example: 1 }
 *           example:
 *             sortOrder: 1
 *     responses:
 *       200:
 *         description: Sort order updated.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Section sort order updated.
 *               data:
 *                 id: 11111111-1111-1111-1111-111111111111
 *                 sectionKey: mission
 *                 sortOrder: 1
 *       400:
 *         description: Validation error.
 *       404:
 *         description: Section not found.
 */
router.patch(
  '/sections/:sectionId/sort-order',
  validate(sectionSortOrderSchema),
  pageSectionsAdminController.updateAdminSectionSortOrder
);

/**
 * @swagger
 * /admin/cms/sections/{sectionId}/items:
 *   get:
 *     summary: List cards/steps under a section
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Example: Core Values cards on About (`about-brisk` / `core_values`),
 *       or Help Desks cards on Contact (`contact-brisk` / `help_desks`).
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Section items list.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Section items retrieved successfully.
 *               data:
 *                 - id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
 *                   sectionId: 11111111-1111-1111-1111-111111111111
 *                   title: Trust
 *                   description: Verified traders and transparent workflows.
 *                   icon: null
 *                   image: null
 *                   stepNumber: null
 *                   sortOrder: 1
 *                   status: PUBLISHED
 *   post:
 *     summary: Add card/step item to a section
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: Trust }
 *               description: { type: string, example: Verified traders and transparent workflows. }
 *               icon: { type: string, nullable: true }
 *               image: { type: string, nullable: true }
 *               stepNumber: { type: integer, example: 1, nullable: true }
 *               sortOrder: { type: integer, example: 1 }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED], example: PUBLISHED }
 *               metadata: { type: object, nullable: true }
 *           example:
 *             title: Trust
 *             description: Verified traders and transparent workflows.
 *             icon: null
 *             image: null
 *             stepNumber: 1
 *             sortOrder: 1
 *             status: PUBLISHED
 *     responses:
 *       201:
 *         description: Item created.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Section item created successfully.
 *               data:
 *                 id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
 *                 title: Trust
 *                 status: PUBLISHED
 *                 sortOrder: 1
 *       400:
 *         description: Validation error.
 *       404:
 *         description: Section not found.
 */
router.get(
  '/sections/:sectionId/items',
  validate(sectionIdParamSchema),
  pageSectionsAdminController.listAdminSectionItems
);

router.post(
  '/sections/:sectionId/items',
  validate(createSectionItemSchema),
  pageSectionsAdminController.createAdminSectionItem
);

/**
 * @swagger
 * /admin/cms/section-items/{itemId}:
 *   get:
 *     summary: Get one section item
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Item retrieved.
 *   put:
 *     summary: Update section item (card/step)
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               icon: { type: string }
 *               image: { type: string }
 *               stepNumber: { type: integer }
 *               sortOrder: { type: integer }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *     responses:
 *       200:
 *         description: Item updated.
 *   delete:
 *     summary: Delete section item
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Item deleted.
 */
router.get(
  '/section-items/:itemId',
  validate(sectionItemIdParamSchema),
  pageSectionsAdminController.getAdminSectionItemById
);

router.put(
  '/section-items/:itemId',
  validate(updateSectionItemSchema),
  pageSectionsAdminController.updateAdminSectionItem
);

router.delete(
  '/section-items/:itemId',
  validate(sectionItemIdParamSchema),
  pageSectionsAdminController.deleteAdminSectionItem
);

/**
 * @swagger
 * /admin/cms/section-items/{itemId}/sort-order:
 *   patch:
 *     summary: Reorder section item
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sortOrder]
 *             properties:
 *               sortOrder: { type: integer }
 *     responses:
 *       200:
 *         description: Sort order updated.
 */
router.patch(
  '/section-items/:itemId/sort-order',
  validate(sectionItemSortOrderSchema),
  pageSectionsAdminController.updateAdminSectionItemSortOrder
);

/**
 * @swagger
 * /admin/cms/section-items/{itemId}/status:
 *   patch:
 *     summary: Publish / draft / archive a section item
 *     tags: ['Admin / Website / Marketing Pages']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
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
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *     responses:
 *       200:
 *         description: Status updated.
 */
router.patch(
  '/section-items/:itemId/status',
  validate(sectionItemStatusSchema),
  pageSectionsAdminController.updateAdminSectionItemStatus
);

// ==========================================
// LEGAL & POLICIES
// ==========================================

/**
 * @swagger
 * /admin/cms/legal-policies:
 *   get:
 *     summary: List Legal Policies (Paginated & Search)
 *     tags: ['Admin / Website / Legal']
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
 *         description: Search by policy name or slug.
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Legal policies retrieved successfully.
 */
router.get('/legal-policies', validate(listFilterSchema), cmsAdminController.listLegalPolicies);

/**
 * @swagger
 * /admin/cms/legal-policies:
 *   post:
 *     summary: Create Legal Policy
 *     tags: ['Admin / Website / Legal']
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
 *               - content
 *             properties:
 *               name: { type: string, example: 'Terms & Conditions' }
 *               slug: { type: string, example: 'terms-and-conditions' }
 *               content: { type: string, example: '<p>Terms & Conditions content...</p>' }
 *               showInFooter: { type: boolean, example: true }
 *     responses:
 *       201:
 *         description: Legal policy created successfully.
 *       409:
 *         description: Legal policy slug conflict.
 */
router.post('/legal-policies', validate(createLegalPolicySchema), cmsAdminController.createLegalPolicy);

/**
 * @swagger
 * /admin/cms/legal-policies/{id}:
 *   put:
 *     summary: Update Legal Policy
 *     tags: ['Admin / Website / Legal']
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
 *               name: { type: string, example: 'Terms & Conditions' }
 *               slug: { type: string, example: 'terms-and-conditions' }
 *               content: { type: string, example: '<p>Updated policy content...</p>' }
 *               showInFooter: { type: boolean, example: true }
 *           example:
 *             name: Terms & Conditions
 *             slug: terms-and-conditions
 *             content: '<p>Terms & Conditions content...</p>'
 *             showInFooter: true
 *     responses:
 *       200:
 *         description: Legal policy updated successfully.
 *       404:
 *         description: Legal policy not found.
 *       409:
 *         description: Legal policy slug conflict.
 */
router.put(
  '/legal-policies/:id',
  validate(updateLegalPolicySchema),
  cmsAdminController.updateLegalPolicy
);

/**
 * @swagger
 * /admin/cms/legal-policies/{id}/versions:
 *   get:
 *     summary: Get Legal Policy Version History
 *     tags: ['Admin / Website / Legal']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Legal policy version history retrieved successfully.
 *       404:
 *         description: Legal policy not found.
 */
router.get('/legal-policies/:id/versions', validate(idParamSchema), cmsAdminController.getLegalPolicyHistory);

/**
 * @swagger
 * /admin/cms/legal-policies/{id}/versions:
 *   post:
 *     summary: Publish new Legal Policy Version
 *     tags: ['Admin / Website / Legal']
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
 *               - versionLabel
 *               - content
 *               - effectiveDate
 *             properties:
 *               versionLabel: { type: string, example: 'v1.2' }
 *               content: { type: string, example: '<p>Full policy content...</p>' }
 *               effectiveDate: { type: string, example: '2026-08-01' }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED], example: 'PUBLISHED' }
 *     responses:
 *       201:
 *         description: Legal policy version published successfully.
 *       404:
 *         description: Legal policy not found.
 */
router.post(
  '/legal-policies/:id/versions',
  validate(publishLegalVersionSchema),
  cmsAdminController.publishLegalVersion
);

// ==========================================
// SEO SETTINGS
// ==========================================

/**
 * @swagger
 * /admin/cms/seo:
 *   get:
 *     summary: Get Global SEO Settings
 *     tags: ['Admin / Website / SEO']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SEO settings retrieved successfully.
 */
router.get('/seo', cmsAdminController.getSeoSettings);

/**
 * @swagger
 * /admin/cms/seo:
 *   put:
 *     summary: Upsert Global SEO Settings
 *     tags: ['Admin / Website / SEO']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - globalSiteTitle
 *               - metaDescription
 *               - canonicalBaseUrl
 *             properties:
 *               globalSiteTitle: { type: string, example: 'BRISK — Trusted Home Services Marketplace' }
 *               metaDescription: { type: string, example: 'Hire verified traders with escrow-protected milestones.' }
 *               metaKeywords: { type: string, example: 'home services, tradespeople, escrow' }
 *               canonicalBaseUrl: { type: string, example: 'https://brisk.com' }
 *               ogImageUrl: { type: string, example: 'https://cdn.brisk.com/og/default.jpg' }
 *               twitterHandle: { type: string, example: '@briskapp' }
 *               gaMeasurementId: { type: string, example: 'G-XXXXXXXXXX' }
 *               robotsTxt: { type: string, example: 'User-agent: *\nAllow: /' }
 *     responses:
 *       200:
 *         description: SEO settings updated successfully.
 *       400:
 *         description: Validation error.
 */
router.put('/seo', validate(updateSeoSchema), cmsAdminController.upsertSeoSettings);

// ==========================================
// CONTACT SETTINGS (Admin Settings → Contact Info)
// ==========================================

/**
 * @swagger
 * /admin/cms/settings/contact:
 *   get:
 *     summary: Get Contact Information settings
 *     description: |
 *       **Admin Settings → Contact Info**
 *
 *       Returns the singleton public contact & support channels used by the website/footer.
 *       If never saved, returns default seed values (`id: null`).
 *     tags: ['Admin / Settings / Contact']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contact information loaded successfully.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Contact information loaded successfully.
 *               data:
 *                 contact:
 *                   id: 3fa85f64-5717-4562-b3fc-2c963f66afa6
 *                   generalInquiryEmail: info@brisk.com
 *                   customerSupportPhone: '+353 123 456 789'
 *                   officeAddress: 14 Kensington High Street, London, W8 4PT, United Kingdom
 *                   showGeneralInquiryEmail: true
 *                   showCustomerSupportPhone: true
 *                   showOfficeAddress: true
 *                   updatedAt: '2026-08-26T08:00:00.000Z'
 *       401:
 *         description: Unauthorized.
 */
router.get('/settings/contact', cmsAdminController.getContactSettings);

/**
 * @swagger
 * /admin/cms/settings/contact:
 *   put:
 *     summary: Update / save Contact Information settings
 *     description: |
 *       **Admin Settings → Contact Info → Save Contact Settings**
 *
 *       Upserts the singleton contact settings row.
 *     tags: ['Admin / Settings / Contact']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - generalInquiryEmail
 *               - customerSupportPhone
 *               - officeAddress
 *             properties:
 *               generalInquiryEmail:
 *                 type: string
 *                 format: email
 *                 example: info@brisk.com
 *                 description: General inquiry email shown publicly.
 *               customerSupportPhone:
 *                 type: string
 *                 example: '+353 123 456 789'
 *                 description: Customer support helpline phone.
 *               officeAddress:
 *                 type: string
 *                 example: 14 Kensington High Street, London, W8 4PT, United Kingdom
 *                 description: Official physical office address.
 *               showGeneralInquiryEmail:
 *                 type: boolean
 *                 example: true
 *                 description: Show general inquiry email on public site.
 *               showCustomerSupportPhone:
 *                 type: boolean
 *                 example: true
 *                 description: Show customer support phone on public site.
 *               showOfficeAddress:
 *                 type: boolean
 *                 example: true
 *                 description: Show office address on public site.
 *           example:
 *             generalInquiryEmail: info@brisk.com
 *             customerSupportPhone: '+353 123 456 789'
 *             officeAddress: 14 Kensington High Street, London, W8 4PT, United Kingdom
 *             showGeneralInquiryEmail: true
 *             showCustomerSupportPhone: true
 *             showOfficeAddress: true
 *     responses:
 *       200:
 *         description: Contact information updated successfully.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Contact information updated successfully.
 *               data:
 *                 contact:
 *                   id: 3fa85f64-5717-4562-b3fc-2c963f66afa6
 *                   generalInquiryEmail: info@brisk.com
 *                   customerSupportPhone: '+353 123 456 789'
 *                   officeAddress: 14 Kensington High Street, London, W8 4PT, United Kingdom
 *                   showGeneralInquiryEmail: true
 *                   showCustomerSupportPhone: true
 *                   showOfficeAddress: true
 *                   updatedAt: '2026-08-26T08:00:00.000Z'
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Unauthorized.
 */
router.put(
  '/settings/contact',
  validate(updateContactSettingsSchema),
  cmsAdminController.upsertContactSettings
);

router.use('/home', homeAdminRoutes);

export default router;
