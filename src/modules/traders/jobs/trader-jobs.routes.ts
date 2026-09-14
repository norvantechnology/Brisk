import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './trader-jobs.controller';
import {
  discoverJobIdParamSchema,
  discoverJobsQuerySchema,
} from './trader-jobs.validation';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Trader / Discover Jobs
 *     description: |
 *       Trader app **Discover → Nearby Opportunities** (lean job cards + detail).
 *       Auth: trader Bearer. Realtime: listen to `job:published` / `job:created` then refresh this list.
 */

/**
 * @swagger
 * /traders/jobs/discover:
 *   get:
 *     summary: Nearby Opportunities — job list (Discover tab)
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Lean list for Discover → **Nearby Opportunities**.
 *
 *       Returns only card fields: `id`, `title`, `badge`, `distanceKm`, `areaName`,
 *       `priceLabel`, `createdAt`, `isBookmarked`. Envelope includes `total` ("24 jobs found").
 *
 *       **Matching rules**
 *       - Status `PUBLISHED` and no assigned trader (open for quotes)
 *       - Category in trader's selected categories (or override with `categoryId`)
 *       - Within `radiusKm` of trader service center (or `lat`/`lng` override)
 *
 *       **Filters (chips)**
 *       - `radiusKm` — e.g. Within 10 km
 *       - `categoryId` — e.g. Plumbing
 *       - `siteVisit=true` — Site Visit jobs
 *       - `urgent=true` — scheduled within next 48 hours
 *
 *       **Badge:** `"Site Visit"` | `"Reschedule"` | `null`
 *       **priceLabel:** e.g. `"€30"` or `"€200 - €350"` (app can show as-is)
 *       **createdAt:** ISO — app formats "Posted 2 mins ago"
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: radiusKm
 *         schema: { type: number, example: 10 }
 *         description: Distance chip (default trader serviceRadiusKm or 10)
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *         description: Optional location override (with lng)
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: siteVisit
 *         schema: { type: boolean }
 *       - in: query
 *         name: urgent
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lean job cards + total count.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Nearby opportunities retrieved successfully.
 *               data:
 *                 total: 24
 *                 jobs:
 *                   - id: 11111111-1111-1111-1111-111111111111
 *                     title: Solar Panel Installation
 *                     badge: Site Visit
 *                     distanceKm: 2.5
 *                     areaName: Dublin 2
 *                     priceLabel: €30
 *                     createdAt: '2026-09-14T10:00:00.000Z'
 *                     isBookmarked: false
 *                   - id: 22222222-2222-2222-2222-222222222222
 *                     title: Full Bathroom Re-tiling
 *                     badge: null
 *                     distanceKm: 5.1
 *                     areaName: Rathmines
 *                     priceLabel: €800 - €1,200
 *                     createdAt: '2026-09-14T09:00:00.000Z'
 *                     isBookmarked: true
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Not a trader.
 */
router.get('/discover', validate(discoverJobsQuerySchema), controller.listDiscoverJobs);

/**
 * @swagger
 * /traders/jobs/discover/{id}:
 *   get:
 *     summary: Nearby job detail (View Details)
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Lean detail for Discover → View Details.
 *       Same card fields plus `description`, `photos`, schedule, category names.
 *       Optional `lat`/`lng` to recompute `distanceKm`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Lean job detail.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job details retrieved successfully.
 *               data:
 *                 id: 11111111-1111-1111-1111-111111111111
 *                 title: Solar Panel Installation
 *                 badge: Site Visit
 *                 distanceKm: 2.5
 *                 areaName: Dublin 2
 *                 priceLabel: €30
 *                 createdAt: '2026-09-14T10:00:00.000Z'
 *                 isBookmarked: false
 *                 description: Install 8 solar panels on south-facing roof.
 *                 photos:
 *                   - https://cdn.example.com/jobs/photo1.jpg
 *                 scheduledDate: '2026-09-16T09:00:00.000Z'
 *                 timeSlot: Morning
 *                 durationLabel: 2 Hours
 *                 categoryName: Solar
 *                 subcategoryName: Installation
 *       404:
 *         description: Job not found or no longer available.
 */
router.get(
  '/discover/:id',
  validate(discoverJobIdParamSchema),
  controller.getDiscoverJob
);

/**
 * @swagger
 * /traders/jobs/discover/{id}/bookmark:
 *   post:
 *     summary: Bookmark a nearby job
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Bookmarked.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job bookmarked successfully.
 *               data: { id: uuid, isBookmarked: true }
 *   delete:
 *     summary: Remove job bookmark
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Bookmark removed.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job bookmark removed successfully.
 *               data: { id: uuid, isBookmarked: false }
 */
router.post(
  '/discover/:id/bookmark',
  validate(discoverJobIdParamSchema),
  controller.bookmarkDiscoverJob
);
router.delete(
  '/discover/:id/bookmark',
  validate(discoverJobIdParamSchema),
  controller.unbookmarkDiscoverJob
);

export default router;
