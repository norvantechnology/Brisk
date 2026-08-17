/**
 * @swagger
 * /admin/cms/home:
 *   get:
 *     summary: List all homepage sections with items (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Use on:** Admin homepage CMS dashboard — overview of all sections and nested items.
 *
 *       **When to use:** Load admin editor; returns all sections regardless of publish status.
 *
 *       **Response:** Array of sections in `data` with camelCase admin fields and nested `items[]`.
 *
 *       **Example:** `GET /admin/cms/home`
 *     responses:
 *       200:
 *         description: All homepage sections with items for CMS editing.
 *       401:
 *         description: Missing or invalid admin Bearer token.
 *   put:
 *     summary: Update homepage page metadata (title / status)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Use on:** Admin — update top-level homepage page record only (not section content).
 *
 *       **When to use:** Change page title or publish/archive the entire homepage.
 *
 *       **Note:** Section content is updated via section-specific PUT endpoints (e.g. `PUT /admin/cms/home/hero`).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Home
 *                 description: Display title for the homepage in admin.
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ARCHIVED]
 *                 description: Publish status for the homepage page record.
 *     responses:
 *       200:
 *         description: Page metadata updated.
 *       401:
 *         description: Unauthorized.
 */

/**
 * @swagger
 * /admin/cms/home/hero:
 *   get:
 *     summary: Get hero section (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Use on:** Admin hero editor — headline, description, store links, background media.
 *
 *       **Fields:** title, description, backgroundVideo, backgroundImage, appStoreUrl, googlePlayUrl, primaryButtonText, primaryButtonUrl, secondaryButtonText, secondaryButtonUrl, status
 *     responses:
 *       200:
 *         description: Hero section with admin fields (camelCase).
 *   put:
 *     summary: Update hero section
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Use on:** Admin — save hero content.
 *
 *       **Image/video fields:** URL strings only (e.g. `https://yoursite.com/assets/hero.mp4`).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: 'The Future Of Local Trade Starts With Trust' }
 *               description: { type: string }
 *               backgroundVideo: { type: string, description: 'Hero background video URL' }
 *               backgroundImage: { type: string, description: 'Hero background / phone mockup image URL' }
 *               appStoreUrl: { type: string }
 *               googlePlayUrl: { type: string }
 *               primaryButtonText: { type: string }
 *               primaryButtonUrl: { type: string }
 *               secondaryButtonText: { type: string }
 *               secondaryButtonUrl: { type: string }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *     responses:
 *       200:
 *         description: Hero section saved.
 */

/**
 * @swagger
 * /admin/cms/home/hero-badges:
 *   get:
 *     summary: Get hero trust badges section (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: Returns badge section with `items[]` (Verified Traders, Secure Negotiation, etc.).
 *     responses:
 *       200:
 *         description: Badge section with items.
 *   put:
 *     summary: Update hero badges section wrapper
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Section updated.
 *   post:
 *     summary: Create a hero trust badge
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Fields per badge:** title, icon (URL string), sortOrder, status
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: 'Verified Traders' }
 *               icon: { type: string, description: 'Badge icon URL' }
 *               sortOrder: { type: integer }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *     responses:
 *       201:
 *         description: Badge created.
 */

/**
 * @swagger
 * /admin/cms/home/hero-badges/{itemId}:
 *   put:
 *     summary: Update a hero trust badge
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Badge item UUID from section `items[].id`.
 *     responses:
 *       200:
 *         description: Badge updated.
 *   delete:
 *     summary: Delete a hero trust badge
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Badge deleted.
 */

/**
 * @swagger
 * /admin/cms/home/hero-badges/{itemId}/status:
 *   put:
 *     summary: Toggle hero badge publish status
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
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
 *         description: Badge status updated.
 */

/**
 * @swagger
 * /admin/cms/home/job-process:
 *   get:
 *     summary: Get trader job-process section (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: '"From Job Post To Completion" — trader path workflow section with steps in items[].'
 *     responses:
 *       200:
 *         description: Section with workflow steps.
 *   put:
 *     summary: Update job-process section title / description
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Section updated.
 */

/**
 * @swagger
 * /admin/cms/home/job-process/steps:
 *   post:
 *     summary: Add trader workflow step
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Fields:** title, description, icon (URL), image (URL), stepNumber, sortOrder, status
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: 'Review Job' }
 *               description: { type: string }
 *               icon: { type: string }
 *               image: { type: string }
 *               stepNumber: { type: integer }
 *               sortOrder: { type: integer }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *     responses:
 *       201:
 *         description: Step created.
 */

/**
 * @swagger
 * /admin/cms/home/job-process/steps/{itemId}:
 *   put:
 *     summary: Update trader workflow step
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Step updated.
 *   delete:
 *     summary: Delete trader workflow step
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Step deleted.
 */

/**
 * @swagger
 * /admin/cms/home/customer-workflow:
 *   get:
 *     summary: Get customer workflow section (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Customer workflow section with steps.
 *   put:
 *     summary: Update customer workflow section
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Section updated.
 */

/**
 * @swagger
 * /admin/cms/home/customer-workflow/steps:
 *   post:
 *     summary: Add customer workflow step
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: Step created.
 */

/**
 * @swagger
 * /admin/cms/home/customer-workflow/steps/{itemId}:
 *   put:
 *     summary: Update customer workflow step
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Step updated.
 *   delete:
 *     summary: Delete customer workflow step
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Step deleted.
 */

/**
 * @swagger
 * /admin/cms/home/connected-marketplace:
 *   get:
 *     summary: Get connected marketplace section (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Section with feature card items.
 *   put:
 *     summary: Update connected marketplace section
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Section updated.
 */

/**
 * @swagger
 * /admin/cms/home/connected-marketplace/items:
 *   post:
 *     summary: Add connected marketplace feature card
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Fields:** title, description, icon, image, sortOrder, status.
 *       Optional button fields via metadata: button_text, button_url
 *     responses:
 *       201:
 *         description: Card created.
 */

/**
 * @swagger
 * /admin/cms/home/connected-marketplace/items/{itemId}:
 *   put:
 *     summary: Update marketplace feature card
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Card updated.
 *   delete:
 *     summary: Delete marketplace feature card
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Card deleted.
 */

/**
 * @swagger
 * /admin/cms/home/service-categories:
 *   get:
 *     summary: Get service categories section (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Category grid section with items.
 *   put:
 *     summary: Update service categories section wrapper
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Section updated.
 *   post:
 *     summary: Add homepage service category
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Fields:** title (name), icon, image, sortOrder, status.
 *       **metadata:** `{ slug, link }` for category slug and link URL.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: Plumbing }
 *               icon: { type: string, description: 'Category icon URL' }
 *               image: { type: string, description: 'Optional category image URL' }
 *               sortOrder: { type: integer }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *               metadata: { type: object, properties: { slug: { type: string }, link: { type: string } } }
 *     responses:
 *       201:
 *         description: Category created.
 */

/**
 * @swagger
 * /admin/cms/home/service-categories/{itemId}:
 *   put:
 *     summary: Update homepage service category
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category updated.
 *   delete:
 *     summary: Delete homepage service category
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category deleted.
 */

/**
 * @swagger
 * /admin/cms/home/service-categories/{itemId}/status:
 *   put:
 *     summary: Toggle service category publish status
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
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

/**
 * @swagger
 * /admin/cms/home/service-categories/sort:
 *   put:
 *     summary: Bulk reorder service categories
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Purpose:** Update sort order for multiple categories at once.
 *
 *       **Body:** `{ "items": [{ "id": "uuid", "sortOrder": 0 }, ...] }`
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, sortOrder]
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     sortOrder: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Sort order updated; returns refreshed items list.
 */

/**
 * @swagger
 * /admin/cms/home/why-brisk:
 *   get:
 *     summary: Get "Why BRISK" section (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Section with feature items.
 *   put:
 *     summary: Update "Why BRISK" section title / description
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Section updated.
 */

/**
 * @swagger
 * /admin/cms/home/why-brisk/items:
 *   post:
 *     summary: Add "Why BRISK" feature card
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: '**Fields:** title, description, icon (URL), image (URL), sortOrder, status'
 *     responses:
 *       201:
 *         description: Feature created.
 */

/**
 * @swagger
 * /admin/cms/home/why-brisk/items/{itemId}:
 *   put:
 *     summary: Update "Why BRISK" feature
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Feature updated.
 *   delete:
 *     summary: Delete "Why BRISK" feature
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Feature deleted.
 */

/**
 * @swagger
 * /admin/cms/home/customer:
 *   get:
 *     summary: Get "For Customers" promo section (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Customer promo section with feature items.
 *   put:
 *     summary: Update customer promo section
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Fields:** title (heading), subtitle, description, backgroundImage (URL), primaryButtonText, primaryButtonUrl, status
 *     responses:
 *       200:
 *         description: Section updated.
 */

/**
 * @swagger
 * /admin/cms/home/customer/features:
 *   post:
 *     summary: Add customer promo feature bullet
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: '**Fields:** title (bullet text), sortOrder, status'
 *     responses:
 *       201:
 *         description: Feature bullet created.
 */

/**
 * @swagger
 * /admin/cms/home/customer/features/{itemId}:
 *   put:
 *     summary: Update customer feature bullet
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Feature updated.
 *   delete:
 *     summary: Delete customer feature bullet
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Feature deleted.
 */

/**
 * @swagger
 * /admin/cms/home/trader:
 *   get:
 *     summary: Get "For Traders" promo section (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Trader promo section with feature items.
 *   put:
 *     summary: Update trader promo section
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Section updated.
 */

/**
 * @swagger
 * /admin/cms/home/trader/features:
 *   post:
 *     summary: Add trader promo feature bullet
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: Feature bullet created.
 */

/**
 * @swagger
 * /admin/cms/home/trader/features/{itemId}:
 *   put:
 *     summary: Update trader feature bullet
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Feature updated.
 *   delete:
 *     summary: Delete trader feature bullet
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Feature deleted.
 */

/**
 * @swagger
 * /admin/cms/home/statistics:
 *   get:
 *     summary: Get homepage statistics section (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: '"Built For Confidence" stat cards — title field = value (e.g. 100K+), description = label.'
 *     responses:
 *       200:
 *         description: Statistics section with stat items.
 *   put:
 *     summary: Update statistics section title / description
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Section updated.
 *   post:
 *     summary: Add stat card
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Fields:** title = value (e.g. `100%`, `4.7`, `100K+`), description = label, icon (URL), sortOrder, status
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: '100K+' }
 *               description: { type: string, example: Customers }
 *               icon: { type: string }
 *               sortOrder: { type: integer }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *     responses:
 *       201:
 *         description: Stat card created.
 */

/**
 * @swagger
 * /admin/cms/home/statistics/{itemId}:
 *   put:
 *     summary: Update stat card
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stat updated.
 *   delete:
 *     summary: Delete stat card
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stat deleted.
 */

/**
 * @swagger
 * /admin/cms/home/statistics/sort:
 *   put:
 *     summary: Bulk reorder stat cards
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: '**Body:** `{ "items": [{ "id": "uuid", "sortOrder": 0 }] }`'
 *     responses:
 *       200:
 *         description: Sort order updated.
 */

/**
 * @swagger
 * /admin/cms/home/app-download:
 *   get:
 *     summary: Get app download CTA section (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: App download section.
 *   put:
 *     summary: Update app download CTA section
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Fields:** title, description, appStoreUrl, googlePlayUrl, backgroundImage (green panel / backdrop URL), foregroundImage (phone mockup URL), primaryButtonText, status
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               appStoreUrl: { type: string }
 *               googlePlayUrl: { type: string }
 *               backgroundImage: { type: string, description: 'Backdrop / green panel image URL' }
 *               foregroundImage: { type: string, description: 'Phone mockup image URL' }
 *               primaryButtonText: { type: string }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *     responses:
 *       200:
 *         description: Section updated.
 */

/**
 * @swagger
 * /admin/cms/home/reviews:
 *   get:
 *     summary: List homepage reviews (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       **Use on:** Admin reviews manager for homepage.
 *
 *       **Filter:** Automatically scoped to homepage reviews (`pageType: HOME`).
 *
 *       **Response fields:** authorName, authorRole, badgeLabel, authorAvatarUrl, quoteText, rating, displayOrder, status, isVerified
 *     responses:
 *       200:
 *         description: Paginated testimonials list for homepage.
 *   post:
 *     summary: Create homepage review
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Accepts admin camelCase or doc snake_case field names.
 *
 *       **Required:** name (or authorName), review (or quoteText)
 *
 *       **Optional:** role, designation, profile_image (URL), rating, sort_order, status, isVerified
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, review]
 *             properties:
 *               name: { type: string, example: 'Diana Johnston' }
 *               role: { type: string, example: 'Verified Trader' }
 *               designation: { type: string, example: 'Verified Business User' }
 *               profile_image: { type: string, description: 'Avatar URL string' }
 *               rating: { type: number, example: 4.8 }
 *               review: { type: string }
 *               sort_order: { type: integer }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *     responses:
 *       201:
 *         description: Review created.
 */

/**
 * @swagger
 * /admin/cms/home/reviews/sort:
 *   put:
 *     summary: Bulk reorder homepage reviews
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     description: '**Body:** `{ "items": [{ "id": "uuid", "sortOrder": 0 }] }`'
 *     responses:
 *       200:
 *         description: Reviews reordered.
 */

/**
 * @swagger
 * /admin/cms/home/reviews/{id}:
 *   get:
 *     summary: Get homepage review by ID (admin)
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Testimonial UUID.
 *     responses:
 *       200:
 *         description: Single review record.
 *   put:
 *     summary: Update homepage review
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Review updated.
 *   delete:
 *     summary: Delete homepage review
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Review deleted.
 */

/**
 * @swagger
 * /admin/cms/home/reviews/{id}/status:
 *   put:
 *     summary: Update homepage review publish status
 *     tags: ['Admin / Website / Home']
 *     security: [{ bearerAuth: [] }]
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
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *     responses:
 *       200:
 *         description: Review status updated.
 */

export {};
