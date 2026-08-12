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
  publishLegalVersionSchema,
  updateSeoSchema,
  dashboardAuditSchema,
} from './admin-cms.validation';
import {
  upsertPageSectionSchema,
  updatePageSectionSchema,
  pageSlugSectionKeyParamsSchema,
  pageSlugParamSchema,
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
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: Number of recent audit log entries to return (max 100).
 *     responses:
 *       200:
 *         description: CMS dashboard audit activity retrieved successfully.
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
// MARKETING PAGE SECTIONS (Customers / Traders pages)
// ==========================================

router.get('/marketing-pages', pageSectionsAdminController.listAdminMarketingPages);

router.get(
  '/marketing-pages/:pageSlug/sections',
  validate(pageSlugParamSchema),
  pageSectionsAdminController.listAdminPageSections
);

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

router.patch(
  '/sections/:sectionId/status',
  validate(sectionStatusSchema),
  pageSectionsAdminController.updateAdminSectionStatus
);

router.patch(
  '/sections/:sectionId/sort-order',
  validate(sectionSortOrderSchema),
  pageSectionsAdminController.updateAdminSectionSortOrder
);

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

router.patch(
  '/section-items/:itemId/sort-order',
  validate(sectionItemSortOrderSchema),
  pageSectionsAdminController.updateAdminSectionItemSortOrder
);

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
 *             properties:
 *               name: { type: string, example: 'Refund & Cancellation Policy' }
 *               slug: { type: string, example: 'refund-cancellation-policy' }
 *     responses:
 *       201:
 *         description: Legal policy created successfully.
 *       409:
 *         description: Legal policy slug conflict.
 */
router.post('/legal-policies', validate(createLegalPolicySchema), cmsAdminController.createLegalPolicy);

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

export default router;
