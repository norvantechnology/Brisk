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
 *     summary: Trader Portal — Site Visits menu (Requested / Upcoming / Visited / Cancelled)
 *     description: |
 *       Tabs are mutually exclusive (same `tab` query param):
 *       - `tab=REQUESTED` (default) — **Site Visit Requested**: waiting on the customer
 *         (`PENDING` Waiting for Customer, `RESCHEDULE_REQUIRED` Reschedule Requested).
 *         Jobs cancelled, completed or awarded to another trader are excluded.
 *       - `tab=UPCOMING` — **Upcoming**: customer confirmed the visit (`CONFIRMED` Visit Confirmed),
 *         not completed yet. Same open-job exclusion rules as REQUESTED.
 *       - `tab=VISITED` — **Site Visited**: visits marked completed (`COMPLETED`).
 *       - `tab=CANCELLED` — **Cancelled / Closed**: request `CANCELLED`, or open request on a
 *         cancelled/completed job / awarded to another trader (`status` may be `CLOSED` with
 *         `closedReason`). Item `group` is `CLOSED`.
 *
 *       Badge counts: `summary.requestedCount` / `upcomingCount` / `visitedCount` /
 *       `closedCount` (= `cancelledCount` for CANCELLED tab badge).
 *       Item shape matches `#/components/schemas/SiteVisitItem` without Admin-only fields.
 *     tags: ['Trader / Site Visits']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: tab, schema: { type: string, enum: [REQUESTED, UPCOMING, VISITED, CANCELLED], default: REQUESTED } }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, CONFIRMED, RESCHEDULE_REQUIRED, COMPLETED, CANCELLED, CLOSED] }
 *         description: Optional extra filter inside the tab.
 *       - { in: query, name: search, schema: { type: string }, description: Job ref, job title or customer name }
 *       - { in: query, name: categoryId, schema: { type: string, format: uuid } }
 *       - { in: query, name: from, schema: { type: string, example: '2026-10-01' }, description: Visit date from (YYYY-MM-DD) }
 *       - { in: query, name: to, schema: { type: string, example: '2026-10-31' }, description: Visit date to (YYYY-MM-DD) }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [updatedAt, requestedAt, visitDate, jobRef, jobTitle, customerName, categoryName], default: updatedAt }, description: "visitDate = displayed visit date (selected slot, else requested date); requestedAt = request created date" }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200:
 *         description: Site visits for the selected tab.
 *         content:
 *           application/json:
 *             examples:
 *               requested:
 *                 summary: tab=REQUESTED
 *                 value:
 *                   success: true
 *                   message: Site visits retrieved successfully.
 *                   data:
 *                     tab: REQUESTED
 *                     items:
 *                       - id: 6b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e
 *                         requestId: 6b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e
 *                         status: PENDING
 *                         statusLabel: Waiting for Customer
 *                         group: REQUESTED
 *                         requestStatus: PENDING
 *                         closedReason: null
 *                         visitDate: '2026-10-04'
 *                         timeSlot: MORNING
 *                         startTime: '08:00'
 *                         endTime: '12:00'
 *                         slots: []
 *                         slotCount: 0
 *                         siteVisitFee: 40
 *                         arrivedAt: null
 *                         completedAt: null
 *                         durationMinutes: null
 *                         requestedAt: '2026-10-01T09:30:00.000Z'
 *                         updatedAt: '2026-10-01T09:30:00.000Z'
 *                         job:
 *                           id: 1f2e3d4c-5b6a-4789-8abc-def012345678
 *                           jobRef: JOB-1042
 *                           title: Boiler not heating
 *                           status: PUBLISHED
 *                           category: { id: 3a07ea99-4d74-45b9-86ba-6f95ca85b8a2, name: Plumbing Services }
 *                           subcategory: { id: 15532727-16c1-4e72-b3c0-dfb59293bad7, name: Boiler & Heating Repair }
 *                           city: Dublin
 *                           postcode: D02 X285
 *                           scheduledDate: null
 *                         customer: { fullName: Sarah Jenkins, profilePhotoUrl: null }
 *                     summary: { total: 8, requestedCount: 3, upcomingCount: 3, visitedCount: 2, closedCount: 0 }
 *                     meta: { total: 3, page: 1, limit: 20, totalPages: 1 }
 *               upcoming:
 *                 summary: tab=UPCOMING
 *                 value:
 *                   success: true
 *                   message: Site visits retrieved successfully.
 *                   data:
 *                     tab: UPCOMING
 *                     items:
 *                       - id: efb61996-43b1-444f-8e17-290bc568b926
 *                         requestId: efb61996-43b1-444f-8e17-290bc568b926
 *                         status: CONFIRMED
 *                         statusLabel: Visit Confirmed
 *                         group: UPCOMING
 *                         requestStatus: CONFIRMED
 *                         closedReason: null
 *                         visitDate: '2026-10-19'
 *                         timeSlot: MORNING
 *                         startTime: '08:00'
 *                         endTime: '12:00'
 *                         slots:
 *                           - { id: a1b2c3d4-0000-4000-8000-000000000001, date: '2026-10-19', timeSlot: MORNING, startTime: '08:00', endTime: '12:00', isSelected: true }
 *                         slotCount: 1
 *                         siteVisitFee: 30
 *                         arrivedAt: null
 *                         completedAt: null
 *                         durationMinutes: null
 *                         requestedAt: '2026-10-15T10:00:00.000Z'
 *                         updatedAt: '2026-10-16T12:00:00.000Z'
 *                         job:
 *                           id: 1514fb8d-d8e5-4d06-abd9-6bbbbdcfe3ba
 *                           jobRef: JOB-7B30
 *                           title: Test Solar Panel Instalation
 *                           status: PUBLISHED
 *                           category: { id: 3a07ea99-4d74-45b9-86ba-6f95ca85b8a2, name: Plumbing Services }
 *                           subcategory: null
 *                           city: Dublin
 *                           postcode: D02 X285
 *                           scheduledDate: null
 *                         customer: { fullName: Brisk Customer, profilePhotoUrl: null }
 *                     summary: { total: 8, requestedCount: 3, upcomingCount: 3, visitedCount: 2, closedCount: 0 }
 *                     meta: { total: 3, page: 1, limit: 20, totalPages: 1 }
 *       400:
 *         $ref: '#/components/responses/TraderListValidationError'
 *       401:
 *         $ref: '#/components/responses/TraderUnauthorized'
 *       403:
 *         $ref: '#/components/responses/TraderForbidden'
 *       404:
 *         description: Trader profile not found.
 *         content:
 *           application/json:
 *             example: { success: false, message: 'Trader profile not found.' }
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
        tab: 'REQUESTED' | 'UPCOMING' | 'VISITED' | 'CANCELLED';
      };
      // CANCELLED tab = closed/cancelled bucket (same filter as Admin CLOSED group).
      const group = tab === 'CANCELLED' ? ('CLOSED' as const) : tab;
      const result = await listTraderSiteVisits(trader.id, { ...query, group }, 'TRADER');
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
