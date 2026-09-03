import { Router } from 'express';
import * as cmsController from './cms.controller';
import * as pageSectionsController from './page-sections.controller';
import { validate } from '../../middlewares/validate.middleware';
import {
  pageSlugParamSchema,
  pageSlugSectionKeyParamsSchema,
  sectionIdParamSchema,
} from './page-sections.validation';

const router = Router();

/**
 * @swagger
 * /cms/bootstrap:
 *   get:
 *     summary: Website layout bootstrap (SEO, social, featured article, testimonials, page nav)
 *     description: |
 *       **Use on:** App shell / layout wrapper — load once on page mount for header, footer, SEO, nav.
 *
 *       **Auth:** Not required.
 *
 *       **Does not include:** Full Customers/Traders page sections — use `GET /pages/{pageSlug}` for that.
 *
 *       **Typical pair:** `GET /cms/bootstrap?audience=customer` + `GET /pages/customers` + `GET /cms/testimonials?audience=CUSTOMER`
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *         description: |
 *           **Purpose:** Scope nav links, FAQs, testimonials, and SEO defaults to the visitor type.
 *           **customer** — For Customers site experience (nav items, audience-specific content).
 *           **trader** — For Traders site experience.
 *           **BOTH / both** — Shared homepage or neutral layout.
 *           **Example:** `GET /cms/bootstrap?audience=customer`
 *     responses:
 *       200:
 *         description: |
 *           Combined payload: SEO meta, social links, featured blog, testimonials snippet, published page nav.
 *           Use field names as returned (mixed camelCase/snake_case depending on nested resource).
 */
router.get('/bootstrap', cmsController.getBootstrap);

/**
 * @swagger
 * /cms/pages:
 *   get:
 *     summary: List published website pages (nav/sitemap — no HTML body)
 *     description: |
 *       **Use on:** Build header/footer navigation or sitemap.
 *
 *       **Not for:** Customers/Traders marketing pages — those use `GET /pages/customers` or `GET /pages/traders`.
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *         description: |
 *           **Purpose:** Filter nav pages visible to customer vs trader visitors.
 *           **Example:** `GET /cms/pages?audience=customer` — only pages tagged for customers.
 *     responses:
 *       200:
 *         description: Page summaries (slug, title, audience) — no section HTML.
 */
router.get('/pages', cmsController.listPages);

/**
 * @swagger
 * /cms/pages/{slug}:
 *   get:
 *     summary: Get published CMS page by slug (full content)
 *     description: |
 *       **Use on:** Generic CMS pages (About, Privacy, etc.) — not marketing Customers/Traders pages.
 *
 *       **Marketing pages:** Use `GET /pages/customers` or `GET /pages/traders` instead.
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string, example: about-us }
 *         description: |
 *           **Purpose:** Page URL slug from nav or sitemap (`GET /cms/pages`).
 *           **Example:** `GET /cms/pages/about-us`
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *         description: |
 *           **Purpose:** Verify page is published for this audience (returns 404 if audience mismatch).
 *     responses:
 *       200:
 *         description: Full published page body and metadata.
 *       404:
 *         description: Page not found or not published for this audience.
 */
router.get('/pages/:slug', cmsController.getPageBySlug);

/**
 * @swagger
 * /cms/social-links:
 *   get:
 *     summary: List active social links for footer/header
 *     tags: ['Website / Content']
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
 *     tags: ['Website / Content']
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
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: |
 *           **Purpose:** Load full guide/article after user clicks a Knowledge Hub card.
 *           **How to use:** Pass `slug` from `GET /cms/knowledge-hub` list response.
 *     responses:
 *       200:
 *         description: Section detail with `content_blocks` array.
 *       404:
 *         description: Section not found or not published.
 */
router.get('/knowledge-hub/:slug', cmsController.getKnowledgeBySlug);

/**
 * @swagger
 * /cms/blog/categories:
 *   get:
 *     summary: List active blog categories with published post counts
 *     tags: ['Website / Content']
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
 *     tags: ['Website / Content']
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
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *         description: |
 *           **Purpose:** Page number for blog listing grid.
 *           **Example:** `page=2` for second page of results.
 *       - in: query
 *         name: per_page
 *         schema: { type: integer, default: 12, minimum: 1, maximum: 50 }
 *         description: |
 *           **Purpose:** Number of post cards per page.
 *           **Example:** `per_page=6` for a compact homepage widget.
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: |
 *           **Purpose:** Full-text search across post titles and excerpts.
 *           **Example:** `search=plumbing tips`
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *         description: |
 *           **Purpose:** Filter posts by blog category UUID from `GET /cms/blog/categories`.
 *           **Use when:** You have the category `id` from the categories list.
 *       - in: query
 *         name: category_slug
 *         schema: { type: string }
 *         description: |
 *           **Purpose:** Filter posts by category URL slug (alternative to `category_id`).
 *           **Use when:** URL is `/blog/category/{slug}` — pass that slug here.
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *         description: |
 *           **Purpose:** Return only featured/spotlight posts.
 *           **Note:** For single hero post use `GET /cms/blog/featured` instead.
 *     responses:
 *       200:
 *         description: Paginated blog cards with `meta` (page, per_page, total).
 */
router.get('/blog/posts', cmsController.getBlogPosts);
router.get('/blog/articles', cmsController.getBlogPosts);

/**
 * @swagger
 * /cms/blog/posts/{slug}:
 *   get:
 *     summary: Get published blog post by slug (full article HTML)
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: |
 *           **Purpose:** Load full article when user opens a blog post URL.
 *           **How to use:** Pass `slug` from blog list card or featured article response.
 *           **Alias:** `GET /cms/blog/articles/{slug}` returns the same data.
 *     responses:
 *       200:
 *         description: Full published blog post including HTML `content`.
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
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *         description: |
 *           **Purpose:** Show FAQ category tabs relevant to customer vs trader Help Center.
 *           **Example:** `GET /cms/faq-categories?audience=customer`
 *     responses:
 *       200:
 *         description: FAQ categories with published question counts.
 */
router.get('/faq-categories', cmsController.getFaqCategories);

/**
 * @swagger
 * /cms/faqs:
 *   get:
 *     summary: List published FAQs for Help Center
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: query
 *         name: audience
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *         description: |
 *           **Purpose:** Filter FAQs shown on customer vs trader Help Center.
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *         description: |
 *           **Purpose:** Load questions for one FAQ category tab (UUID from `GET /cms/faq-categories`).
 *       - in: query
 *         name: category_slug
 *         schema: { type: string }
 *         description: |
 *           **Purpose:** Same as `category_id` but using URL slug when building slug-based routes.
 *       - in: query
 *         name: pageType
 *         schema: { type: string, enum: [CUSTOMER, TRADER, HOME, ABOUT_US, customer, trader, home, aboutUs] }
 *         description: |
 *           **Purpose:** Filter FAQs by page (`aboutUs` for About Us page).
 *     responses:
 *       200:
 *         description: Published FAQ question/answer pairs.
 */
router.get('/faqs', cmsController.getFaqs);

/**
 * @swagger
 * /cms/testimonials:
 *   get:
 *     summary: List published testimonials / reviews (standard endpoint)
 *     description: |
 *       **Standard public API for all website testimonial/review sections.**
 *
 *       Use this one endpoint for Customer page, Trader page, Homepage, Testimonials page, and future sections.
 *
 *       **Auth:** Not required.
 *
 *       **Filter rules (`audience`):**
 *       - `CUSTOMER` → testimonials with targetAudience **CUSTOMER** or **BOTH**
 *       - `TRADER` → testimonials with targetAudience **TRADER** or **BOTH**
 *       - `BOTH` → testimonials with targetAudience **BOTH** only (typical for homepage)
 *
 *       **Examples:**
 *       - Customer page: `GET /cms/testimonials?audience=CUSTOMER&limit=5`
 *       - Trader page: `GET /cms/testimonials?audience=TRADER&limit=5`
 *       - Home page: `GET /cms/testimonials?audience=BOTH&limit=10`
 *
 *       **Deprecated aliases (same handler):**
 *       - `GET /testimonials` — do not use for new work
 *       - `GET /cms/home/reviews` — do not use for new work (equivalent to `audience=BOTH`)
 *
 *       **Response:** `data.items[]` snake_case cards (`name`, `role`, `type`, `rating`, `review`, `avatar`, `is_verified`, `target_audience`, `sort_order`, …).
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: query
 *         name: audience
 *         required: false
 *         schema: { type: string, enum: [BOTH, CUSTOMER, TRADER, both, customer, trader] }
 *         description: |
 *           **Purpose:** Scope testimonials to the page/audience.
 *           **CUSTOMER** — customer + BOTH. **TRADER** — trader + BOTH. **BOTH** — BOTH only.
 *           **Example:** `audience=TRADER`
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *         description: |
 *           **Purpose:** Max number of records returned.
 *           **Example:** `limit=5`
 *       - in: query
 *         name: featured
 *         schema: { type: string, enum: [true, false] }
 *         description: Optional — only admin-marked featured testimonials.
 *       - in: query
 *         name: type
 *         deprecated: true
 *         schema: { type: string, enum: [customer, trader, home] }
 *         description: |
 *           **Deprecated.** Maps to audience when `audience` is omitted (`home` → BOTH). Prefer `audience`.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [published, draft] }
 *         description: Public default is published-only; rarely needed.
 *     responses:
 *       200:
 *         description: |
 *           `data.items[]` — testimonial cards ordered by `sort_order` / `display_order`.
 *           Empty array is valid when nothing matches the filter.
 */
router.get('/testimonials', cmsController.getTestimonials);

/**
 * @swagger
 * /cms/help/html:
 *   get:
 *     summary: Help Center HTML page for mobile WebView
 *     tags: ['Website / Content']
 *     responses:
 *       200:
 *         description: HTML document (open this URL in WebView).
 */
router.get('/help/html', cmsController.getHelpCenterHtml);

/**
 * @swagger
 * /cms/legal:
 *   get:
 *     summary: List published legal policies
 *     description: |
 *       Returns published legal policy summaries.
 *
 *       - `GET /cms/legal` — all published policies
 *       - `GET /cms/legal?show_in_footer=true` — footer links only
 *       - Alias: `showInFooter=true`
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: query
 *         name: show_in_footer
 *         schema: { type: boolean, example: true }
 *         description: When `true`, return only policies marked for footer display.
 *     responses:
 *       200:
 *         description: Legal policy summaries with current version.
 */
router.get('/legal', cmsController.listLegalPolicies);

/**
 * @swagger
 * /cms/legal/{slug}/html:
 *   get:
 *     summary: Legal policy HTML for mobile WebView
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string, example: privacy-policy }
 *         description: "terms-and-conditions or privacy-policy"
 *     responses:
 *       200:
 *         description: HTML document for WebView.
 */
router.get('/legal/:slug/html', cmsController.getLegalHtmlBySlug);

/**
 * @swagger
 * /cms/legal/{slug}:
 *   get:
 *     summary: Get latest published legal policy version by slug
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string, example: privacy-policy }
 *         description: |
 *           **Purpose:** Load full legal text for footer links (Privacy, Terms, etc.).
 *           **How to use:** Pass `slug` from `GET /cms/legal` list.
 *     responses:
 *       200:
 *         description: Latest published legal version with HTML content.
 *       404:
 *         description: Policy or published version not found.
 */
router.get('/legal/:slug', cmsController.getLegalBySlug);

/**
 * @swagger
 * /cms/seo:
 *   get:
 *     summary: Get public SEO / site head settings
 *     tags: ['Website / Content']
 *     responses:
 *       200:
 *         description: SEO settings for public site head injection.
 */
router.get('/seo', cmsController.getSeo);

/**
 * @swagger
 * /cms/settings/contact:
 *   get:
 *     summary: Get public Contact Information settings
 *     description: |
 *       Public contact channels for website footer / Contact page.
 *       Mirrors Admin Settings → Contact Info (`GET/PUT /admin/cms/settings/contact`).
 *     tags: ['Website / Content']
 *     responses:
 *       200:
 *         description: Contact information retrieved successfully.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Contact information retrieved successfully.
 *               data:
 *                 contact:
 *                   general_inquiry_email: info@brisk.com
 *                   customer_support_phone: '+353 123 456 789'
 *                   office_address: 14 Kensington High Street, London, W8 4PT, United Kingdom
 *                   show_general_inquiry_email: true
 *                   show_customer_support_phone: true
 *                   show_office_address: true
 */
router.get('/settings/contact', cmsController.getContactSettings);

/**
 * @swagger
 * /cms/marketing-pages/{pageSlug}:
 *   get:
 *     summary: Get full marketing page (CMS path — prefer GET /pages/{pageSlug})
 *     description: |
 *       Same data as `GET /pages/customers` or `GET /pages/traders`. Use `/pages/...` in frontend.
 *
 *       See `GET /pages/{pageSlug}` for full parameter and section_key documentation.
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: path
 *         name: pageSlug
 *         required: true
 *         schema: { type: string, enum: [customers, traders], example: customers }
 *         description: |
 *           **Purpose:** `customers` = For Customers page; `traders` = For Traders page.
 *     responses:
 *       200:
 *         description: Page with ordered `sections[]` and nested `items[]`.
 */
router.get(
  '/marketing-pages/:pageSlug',
  validate(pageSlugParamSchema),
  pageSectionsController.getMarketingPage
);

/**
 * @swagger
 * /cms/marketing-pages/{pageSlug}/sections/{sectionKey}:
 *   get:
 *     summary: Get one marketing page section (CMS path — prefer GET /pages/{pageSlug}/sections/{sectionKey})
 *     description: Same as `GET /pages/{pageSlug}/sections/{sectionKey}`. See that endpoint for parameter docs.
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: path
 *         name: pageSlug
 *         required: true
 *         schema: { type: string, enum: [customers, traders] }
 *         description: Parent page — `customers` or `traders`.
 *       - in: path
 *         name: sectionKey
 *         required: true
 *         schema: { type: string, example: hero }
 *         description: Section key from full page response — e.g. `hero`, `why-customers`, `trader_hero`.
 */
router.get(
  '/marketing-pages/:pageSlug/sections/:sectionKey',
  validate(pageSlugSectionKeyParamsSchema),
  pageSectionsController.getPageSection
);

/**
 * @swagger
 * /cms/sections/{sectionId}/items:
 *   get:
 *     summary: List published items for a section (feature cards, journey steps, etc.)
 *     description: |
 *       **Use on:** Optional lazy-load when you have a section UUID but need only its items.
 *
 *       **Usually not needed:** Full page/section responses already include `items[]`.
 *     tags: ['Website / Content']
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: |
 *           **Purpose:** Section UUID from `sections[].id` in page response.
 *           **Example:** `GET /cms/sections/{sectionId}/items`
 */
router.get(
  '/sections/:sectionId/items',
  validate(sectionIdParamSchema),
  pageSectionsController.getSectionItems
);

export default router;
