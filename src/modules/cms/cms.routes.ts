import { Router } from 'express';
import * as cmsController from './cms.controller';

const router = Router();

/**
 * @swagger
 * /cms/bootstrap:
 *   get:
 *     summary: Website layout bootstrap (SEO, social, featured article, testimonials, page nav)
 *     description: Single optimized call for homepage/layout shell. Uses published Website Management data only.
 *     tags: ['Website — Public Content']
 *     parameters:
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *     responses:
 *       200:
 *         description: Bootstrap payload for dynamic website shell.
 */
router.get('/bootstrap', cmsController.getBootstrap);

/**
 * @swagger
 * /cms/pages:
 *   get:
 *     summary: List published website pages (nav/sitemap — no HTML body)
 *     tags: ['Website — Public Content']
 *     parameters:
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *     responses:
 *       200:
 *         description: Published page summaries.
 */
router.get('/pages', cmsController.listPages);

/**
 * @swagger
 * /cms/pages/{slug}:
 *   get:
 *     summary: Get published CMS page by slug (full content)
 *     tags: ['Website — Public Content']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *     responses:
 *       200:
 *         description: Published page retrieved.
 *       404:
 *         description: Page not found or not published.
 */
router.get('/pages/:slug', cmsController.getPageBySlug);

/**
 * @swagger
 * /cms/social-links:
 *   get:
 *     summary: List active social links for footer/header
 *     tags: ['Website — Public Content']
 *     responses:
 *       200:
 *         description: Active social links ordered by sort_order.
 */
router.get('/social-links', cmsController.getSocialLinks);

/**
 * @swagger
 * /cms/knowledge-hub:
 *   get:
 *     summary: List published Knowledge Hub sections (cards — no blocks)
 *     tags: ['Website — Public Content']
 *     responses:
 *       200:
 *         description: Published guide cards.
 */
router.get('/knowledge-hub', cmsController.getKnowledgeHub);

/**
 * @swagger
 * /cms/knowledge-hub/{slug}:
 *   get:
 *     summary: Get published Knowledge Hub section detail with content blocks
 *     tags: ['Website — Public Content']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Section detail with content_blocks.
 *       404:
 *         description: Section not found.
 */
router.get('/knowledge-hub/:slug', cmsController.getKnowledgeBySlug);

/**
 * @swagger
 * /cms/blog/categories:
 *   get:
 *     summary: List active blog categories with published post counts
 *     tags: ['Website — Public Content']
 *     responses:
 *       200:
 *         description: Active blog categories.
 */
router.get('/blog/categories', cmsController.getBlogCategories);

/**
 * @swagger
 * /cms/blog/featured:
 *   get:
 *     summary: Get the featured/spotlight blog article (hero)
 *     tags: ['Website — Public Content']
 *     responses:
 *       200:
 *         description: Featured article card or null.
 */
router.get('/blog/featured', cmsController.getFeaturedBlogPost);

/**
 * @swagger
 * /cms/blog/posts:
 *   get:
 *     summary: List published blog posts (paginated cards — no full HTML body)
 *     tags: ['Website — Public Content']
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer, default: 12 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: category_slug
 *         schema: { type: string }
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *     responses:
 *       200:
 *         description: Paginated published blog cards.
 */
router.get('/blog/posts', cmsController.getBlogPosts);
router.get('/blog/articles', cmsController.getBlogPosts);

/**
 * @swagger
 * /cms/blog/posts/{slug}:
 *   get:
 *     summary: Get published blog post by slug (full article HTML)
 *     tags: ['Website — Public Content']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Published blog post detail.
 *       404:
 *         description: Post not found or not live.
 */
router.get('/blog/posts/:slug', cmsController.getBlogPostBySlug);
router.get('/blog/articles/:slug', cmsController.getBlogPostBySlug);

/**
 * @swagger
 * /cms/faq-categories:
 *   get:
 *     summary: List FAQ categories that have published FAQs
 *     tags: ['Website — Public Content']
 *     parameters:
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *     responses:
 *       200:
 *         description: FAQ categories with counts.
 */
router.get('/faq-categories', cmsController.getFaqCategories);

/**
 * @swagger
 * /cms/faqs:
 *   get:
 *     summary: List published FAQs for Help Center
 *     tags: ['Website — Public Content']
 *     parameters:
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: category_slug
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Published FAQs.
 */
router.get('/faqs', cmsController.getFaqs);

/**
 * @swagger
 * /cms/testimonials:
 *   get:
 *     summary: List published testimonials (homepage carousel)
 *     tags: ['Website — Public Content']
 *     parameters:
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Published testimonials.
 */
router.get('/testimonials', cmsController.getTestimonials);

/**
 * @swagger
 * /cms/legal:
 *   get:
 *     summary: List published legal policies (footer links)
 *     tags: ['Website — Public Content']
 *     responses:
 *       200:
 *         description: Legal policy summaries with current version.
 */
router.get('/legal', cmsController.listLegalPolicies);

/**
 * @swagger
 * /cms/legal/{slug}:
 *   get:
 *     summary: Get latest published legal policy version by slug
 *     tags: ['Website — Public Content']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Latest published legal version.
 *       404:
 *         description: Policy or published version not found.
 */
router.get('/legal/:slug', cmsController.getLegalBySlug);

/**
 * @swagger
 * /cms/seo:
 *   get:
 *     summary: Get public SEO / site head settings
 *     tags: ['Website — Public Content']
 *     responses:
 *       200:
 *         description: SEO settings for public site head injection.
 */
router.get('/seo', cmsController.getSeo);

export default router;
