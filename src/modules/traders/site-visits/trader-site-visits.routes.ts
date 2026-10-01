import { Router, Response, NextFunction } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { sendResponse } from '../../../utils/apiResponse';
import { prisma } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import { traderSiteVisitsSchema } from '../../site-visits/site-visits.validation';
import {
  listTraderSiteVisits,
  type TraderSiteVisitListQuery,
} from '../../site-visits/site-visits.service';

const router = Router();

/**
 * @swagger
 * /traders/site-visits:
 *   get:
 *     summary: Trader Portal — Site Visits menu (Requested / Visited)
 *     description: |
 *       - `tab=REQUESTED` (default) — **Site Visit Requested**: visits waiting on the customer or next action
 *         (`PENDING` Waiting for Customer, `CONFIRMED` Visit Confirmed, `RESCHEDULE_REQUIRED` Reschedule Requested).
 *         Jobs cancelled, completed or awarded to another trader are excluded.
 *       - `tab=VISITED` — **Site Visited**: visits marked completed (`COMPLETED`).
 *
 *       `summary.requestedCount` / `summary.visitedCount` = tab badges (same counts as Admin Trader Details).
 *       Item shape matches `#/components/schemas/SiteVisitItem` without the Admin-only fields
 *       (`trader`, customer contact, `job.assignedTraderId`).
 *     tags: ['Trader / Site Visits']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: tab, schema: { type: string, enum: [REQUESTED, VISITED], default: REQUESTED } }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, CONFIRMED, RESCHEDULE_REQUIRED, COMPLETED] }
 *         description: Optional extra filter inside the tab.
 *       - { in: query, name: search, schema: { type: string }, description: Job ref, job title or customer name }
 *       - { in: query, name: categoryId, schema: { type: string, format: uuid } }
 *       - { in: query, name: from, schema: { type: string, example: '2026-10-01' }, description: Visit date from (YYYY-MM-DD) }
 *       - { in: query, name: to, schema: { type: string, example: '2026-10-31' }, description: Visit date to (YYYY-MM-DD) }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [updatedAt, requestedAt, visitDate], default: updatedAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200:
 *         description: Site visits for the selected tab.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Site visits retrieved successfully.
 *               data:
 *                 tab: REQUESTED
 *                 items:
 *                   - id: 6b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e
 *                     requestId: 6b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e
 *                     status: PENDING
 *                     statusLabel: Waiting for Customer
 *                     group: REQUESTED
 *                     requestStatus: PENDING
 *                     closedReason: null
 *                     visitDate: '2026-10-04'
 *                     timeSlot: MORNING
 *                     startTime: '08:00'
 *                     endTime: '12:00'
 *                     slots: []
 *                     slotCount: 0
 *                     siteVisitFee: 40
 *                     arrivedAt: null
 *                     completedAt: null
 *                     durationMinutes: null
 *                     requestedAt: '2026-10-01T09:30:00.000Z'
 *                     updatedAt: '2026-10-01T09:30:00.000Z'
 *                     job:
 *                       id: 1f2e3d4c-5b6a-4789-8abc-def012345678
 *                       jobRef: JOB-1042
 *                       title: Boiler not heating
 *                       status: PUBLISHED
 *                       category: { id: 3a07ea99-4d74-45b9-86ba-6f95ca85b8a2, name: Plumbing Services }
 *                       subcategory: { id: 15532727-16c1-4e72-b3c0-dfb59293bad7, name: Boiler & Heating Repair }
 *                       city: Dublin
 *                       postcode: D02 X285
 *                       scheduledDate: null
 *                     customer: { fullName: Sarah Jenkins, profilePhotoUrl: null }
 *                 summary: { total: 5, requestedCount: 3, visitedCount: 2, closedCount: 0 }
 *                 meta: { total: 3, page: 1, limit: 20, totalPages: 1 }
 */
router.get(
  '/',
  validate(traderSiteVisitsSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const trader = await prisma.trader.findUnique({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      if (!trader) throw new NotFoundError('Trader profile not found.');

      const { tab, ...query } = req.query as TraderSiteVisitListQuery & {
        tab: 'REQUESTED' | 'VISITED';
      };
      const result = await listTraderSiteVisits(trader.id, { ...query, group: tab }, 'TRADER');
      sendResponse({
        res,
        statusCode: 200,
        message: 'Site visits retrieved successfully.',
        data: { tab, ...result },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
