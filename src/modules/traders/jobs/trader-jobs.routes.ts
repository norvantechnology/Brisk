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
 *       Trader Discover Nearby Opportunities.
 *       App UI currently uses search only (no filter bottom sheet).
 *       Optional later: radiusKm, lat, lng for distance filter.
 *       Auth: trader Bearer. Refresh list on job:published / job:created.
 */

/**
 * @swagger
 * /traders/jobs/discover:
 *   get:
 *     summary: Nearby Opportunities job list (Discover tab)
 *     tags: ['Trader / Discover Jobs']
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Lean list for Discover Nearby Opportunities (total = jobs found count).
 *
 *       App UI now: use search query only (Search for Services). No filter bottom sheet.
 *       Optional future distance filter: radiusKm, lat, lng (already supported).
 *
 *       Card fields only: id, title, badge, distanceKm, areaName, priceLabel, createdAt, isBookmarked
 *
 *       Matching: PUBLISHED jobs with no assigned trader; category match when trader has categories.
 *
 *       badge: Site Visit | Reschedule | null
 *       priceLabel examples: EUR 100 - 150 style string already formatted with euro sign
 *       createdAt: ISO timestamp (app formats Posted 2 mins ago)
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string, example: Kitchen Pipe }
 *         description: Primary app filter. Matches title, city/area, description.
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: radiusKm
 *         schema: { type: number, example: 10 }
 *         description: Optional future distance filter in km. Omit for now.
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *         description: Optional future location override (with lng).
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *         description: Optional future location override (with lat).
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: Optional category filter (not in current UI).
 *       - in: query
 *         name: siteVisit
 *         schema: { type: boolean }
 *         description: Optional site-visit-only filter (not in current UI).
 *       - in: query
 *         name: urgent
 *         schema: { type: boolean }
 *         description: Optional urgent filter scheduled within 48h (not in current UI).
 *     responses:
 *       200:
 *         description: Lean job cards plus total count.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Nearby opportunities retrieved successfully.
 *               data:
 *                 total: 3
 *                 jobs:
 *                   - id: 11111111-1111-1111-1111-111111111111
 *                     title: Leaking Kitchen Pipe Repair
 *                     badge: null
 *                     distanceKm: 2.5
 *                     areaName: Dublin 2
 *                     priceLabel: "€100 - €150"
 *                     createdAt: '2026-09-14T10:00:00.000Z'
 *                     isBookmarked: false
 *                   - id: 22222222-2222-2222-2222-222222222222
 *                     title: Full Bathroom Re-tiling
 *                     badge: Reschedule
 *                     distanceKm: 5.1
 *                     areaName: Rathmines
 *                     priceLabel: "€800 - €1,200"
 *                     createdAt: '2026-09-14T09:00:00.000Z'
 *                     isBookmarked: false
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
 *       Lean detail for Discover View Details.
 *       Same card fields plus description, photos, schedule, category names.
 *       Optional lat/lng to recompute distanceKm.
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
 *                 title: Leaking Kitchen Pipe Repair
 *                 badge: null
 *                 distanceKm: 2.5
 *                 areaName: Dublin 2
 *                 priceLabel: "€100 - €150"
 *                 createdAt: '2026-09-14T10:00:00.000Z'
 *                 isBookmarked: false
 *                 description: Fix leaking kitchen pipe under sink.
 *                 photos:
 *                   - https://cdn.example.com/jobs/photo1.jpg
 *                 scheduledDate: '2026-09-16T09:00:00.000Z'
 *                 timeSlot: Morning
 *                 durationLabel: 2 Hours
 *                 categoryName: Plumbing
 *                 subcategoryName: Repairs
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
