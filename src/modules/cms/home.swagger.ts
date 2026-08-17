/**
 * @swagger
 * /cms/home:
 *   get:
 *     summary: Get full homepage (all sections in order)
 *     tags: ['Website / Home']
 *     description: |
 *       **Use on:** Website homepage — load entire page in one call (recommended).
 *
 *       **Auth:** Not required.
 *
 *       **When to use:** Initial page render. Prefer this over calling each section separately.
 *
 *       **Alias:** Same payload as `GET /pages/home`.
 *
 *       **Not included:** User reviews — fetch separately via `GET /cms/home/reviews`.
 *
 *       **Response shape (snake_case):**
 *       - `data.page` — `{ slug, title, status }`
 *       - `data.sections[]` — ordered by `sort_order`; each section has `section_key`, `section_type`, text fields, buttons, URLs, and nested `items[]` where applicable.
 *
 *       **Example:** `GET /cms/home`
 *     responses:
 *       200:
 *         description: |
 *           Full homepage CMS payload.
 *           Each section in `data.sections[]` includes `items[]` for badges, workflow steps, feature cards, stats, etc.
 *       404:
 *         description: Home page not seeded yet — run `npm run db:seed` after deploy.
 */

/**
 * @swagger
 * /cms/home/reviews:
 *   get:
 *     summary: Homepage user reviews / testimonials
 *     tags: ['Website / Home']
 *     description: |
 *       **Use on:** "User Reviews" section on homepage (trader/customer toggle carousel).
 *
 *       **Auth:** Not required.
 *
 *       **When to use:** After loading main page, or in parallel with `GET /cms/home`.
 *
 *       **Alias:** Same data as `GET /testimonials?type=home`.
 *
 *       **Response fields per item (snake_case):**
 *       - `name` — reviewer display name
 *       - `role` — e.g. Trader, Verified Trader
 *       - `rating` — numeric rating (e.g. 4.8)
 *       - `review` — full testimonial text
 *       - `avatar` — profile image URL string
 *       - `is_verified` — verified badge flag
 *       - `sort_order` — display order
 *
 *       **Example:** `GET /cms/home/reviews`
 *     responses:
 *       200:
 *         description: |
 *           `data.items[]` — published homepage reviews ordered by `sort_order`.
 *           Empty array is valid when no reviews are seeded.
 */

/**
 * @swagger
 * /cms/home/{sectionRoute}:
 *   get:
 *     summary: Get one homepage section by route key
 *     tags: ['Website / Home']
 *     description: |
 *       **Use on:** Optional lazy-load of a single section instead of full page.
 *
 *       **Auth:** Not required.
 *
 *       **When to use:** Prefer `GET /cms/home` for full page. Use this only when refreshing one block.
 *
 *       **Note:** Feature lists (customer features, workflow steps, etc.) are included in `items[]` inside the section response.
 *     parameters:
 *       - in: path
 *         name: sectionRoute
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - hero
 *             - hero-badges
 *             - job-process
 *             - customer-workflow
 *             - connected-marketplace
 *             - service-categories
 *             - why-brisk
 *             - customer
 *             - trader
 *             - statistics
 *             - app-download
 *         description: |
 *           **Purpose:** Select which homepage section to load.
 *
 *           **Values:**
 *           - `hero` — Main headline, description, App Store / Google Play URLs, background video/image
 *           - `hero-badges` — Trust badges (Verified Traders, Secure Negotiation, etc.)
 *           - `job-process` — "From Job Post To Completion" trader workflow steps
 *           - `customer-workflow` — Customer journey steps (Schedule Job → Job Completed)
 *           - `connected-marketplace` — "A Connected Marketplace" feature cards
 *           - `service-categories` — Circular hub categories (Cleaning, Plumbing, etc.)
 *           - `why-brisk` — "Why BRISK Is Different" feature cards
 *           - `customer` — "For Customers" promo block + feature bullet items
 *           - `trader` — "For Traders" promo block + feature bullet items
 *           - `statistics` — "Built For Confidence" stat cards (100%, 4.7, 100K+, etc.)
 *           - `app-download` — "Everything You Need In One App" CTA + store links + background_image + foreground_image
 *
 *           **Example:** `GET /cms/home/hero`
 *     responses:
 *       200:
 *         description: |
 *           Single section object in `data` with nested `items[]` when the section has list content.
 *           Icons and images are URL strings in `icon`, `image`, `background_image` fields.
 *       404:
 *         description: Unknown section route or section not published.
 */

/**
 * @swagger
 * /pages/home:
 *   get:
 *     summary: Get full homepage (alias — same as GET /cms/home)
 *     tags: ['Website / Home']
 *     description: |
 *       **Use on:** Website homepage when using the `/pages/...` URL convention (same as Customers/Traders pages).
 *
 *       **Auth:** Not required.
 *
 *       **Preferred:** Either `GET /cms/home` or `GET /pages/home` — identical data.
 *
 *       **Reviews:** Use `GET /cms/home/reviews` separately.
 *
 *       **Example:** `GET /pages/home`
 *     responses:
 *       200:
 *         description: Same as `GET /cms/home` — page metadata + ordered sections with items.
 *       404:
 *         description: Home page not found or not seeded.
 */

export {};
