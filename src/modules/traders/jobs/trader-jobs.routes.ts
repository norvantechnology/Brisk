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
 *       Lean list for Discover Nearby Opportunities.
 *       Response data is a job array. App shows count from data.length (no total field).
 *
 *       App UI now: use search query only (Search for Services). No filter bottom sheet.
 *       Optional future distance filter: radiusKm, lat, lng (already supported).
 *
 *       Card fields: id, title, badge, distanceKm, areaName, priceLabel, createdAt, postedAgo, isBookmarked, isSiteVisit
 *       postedAgo examples: 5 mins ago, 1 hour ago, 2 hours ago
 *       badge: Site Visit | Reschedule | null
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
 *         description: Job card array in data (use data.length for jobs found).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Nearby opportunities retrieved successfully.
 *               data:
 *                 - id: 8a8fb0e5-a330-4c62-8e76-a358bd792b84
 *                   title: Sample Job POst
 *                   badge: Site Visit
 *                   distanceKm: 2.5
 *                   areaName: Dublin
 *                   priceLabel: "€30"
 *                   createdAt: '2026-09-11T10:46:44.111Z'
 *                   postedAgo: 1 hour ago
 *                   isBookmarked: false
 *                   isSiteVisit: true
 *                 - id: 319a86dd-02d6-4db7-bcc0-45b604ac8a36
 *                   title: Second Job Post
 *                   badge: Reschedule
 *                   distanceKm: 5.1
 *                   areaName: Rathmines
 *                   priceLabel: "€1,000 - €1,500"
 *                   createdAt: '2026-09-10T12:11:49.000Z'
 *                   postedAgo: 2 hours ago
 *                   isBookmarked: false
 *                   isSiteVisit: false
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
 *       Full Job Details for Discover View Details in one response (no extra API calls).
 *       Includes postedAgo/postedLabel, site visit fee, customer, photos, location/map, actions.
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
 *         description: Full job detail payload.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Job details retrieved successfully.
 *               data:
 *                 id: 11111111-1111-1111-1111-111111111111
 *                 title: Solar Panel Installation
 *                 badge: Site Visit
 *                 distanceKm: 3.4
 *                 areaName: Dublin 8
 *                 priceLabel: "€30"
 *                 createdAt: '2026-09-14T10:00:00.000Z'
 *                 postedAgo: 5 mins ago
 *                 postedLabel: Posted 5 mins ago from your area
 *                 isBookmarked: false
 *                 isSiteVisit: true
 *                 isReschedule: false
 *                 siteVisitFee: 30
 *                 siteVisitFeeLabel: "€30"
 *                 siteVisitFeeNote: This fee is paid to the platform to secure the visit and ensure high intent for both parties.
 *                 canSelectDateTime: true
 *                 canRequestSiteVisit: true
 *                 primaryActionLabel: Request For Site Visit
 *                 description: Looking for a professional to install solar panels.
 *                 photos:
 *                   - https://cdn.example.com/jobs/photo1.jpg
 *                 photoCount: 1
 *                 customer:
 *                   id: uuid
 *                   fullName: Sarah Jenkins
 *                   profilePhotoUrl: null
 *                   isVerified: true
 *                   verifiedLabel: Verified Customer
 *                 category: { id: uuid, name: Solar, iconName: sun }
 *                 subcategory: null
 *                 categoryName: Solar
 *                 subcategoryName: null
 *                 scheduledDate: null
 *                 timeSlot: Morning
 *                 durationLabel: 2 Hours
 *                 location:
 *                   areaName: Dublin 8
 *                   distanceKm: 3.4
 *                   distanceLabel: approx. 3.4km away
 *                   latitude: 53.34
 *                   longitude: -6.27
 *                   mapPreviewUrl: https://www.openstreetmap.org/export/embed.html?...
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
