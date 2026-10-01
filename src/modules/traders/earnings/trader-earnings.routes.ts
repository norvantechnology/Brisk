import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './trader-earnings.controller';
import { earningsDashboardQuerySchema } from './trader-earnings.validation';

const router = Router();

/**
 * @swagger
 * /traders/earnings/dashboard:
 *   get:
 *     summary: Trader earnings dashboard
 *     description: |
 *       Earnings / History screen for the logged-in trader. All values come from live records.
 *
 *       - **revenue** — today's PAID payment requests (converted to trader's preferred currency).
 *         `growthPercentage` compares today vs yesterday. `dailyGoalAmount` = average earnings per
 *         working day over the last 30 days (excluding today); `dailyGoalPercentage` = today / goal × 100
 *         (can exceed 100).
 *       - **overview** — average rating + total reviews, latest reviewer avatars, and
 *         `jobsInProgressCount` (same as My Jobs ACTIVE tab total).
 *       - **recentTransactions** — latest payment requests (full list: `GET /traders/payments/history`).
 *         Display fields: `formattedAmount` (e.g. `€ +120`), `jobStatusLabel` (e.g. `IN PROGRESS`),
 *         `paymentStatus` (`RECEIVED` = customer paid, `PENDING` = awaiting payment).
 *         Raw `amount`, `jobStatus` and `payoutStatus` are unchanged.
 *       - **recentFeedbacks** — latest customer reviews.
 *
 *       **Query**
 *       - `limit` — items in recent lists / avatars (default 5, max 20)
 *       - `timezone` — IANA zone used for "today" (default `Europe/Dublin`)
 *     tags: ['Trader / Earnings']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5, maximum: 20 }
 *       - in: query
 *         name: timezone
 *         schema: { type: string, example: Europe/Dublin }
 *     responses:
 *       200:
 *         description: Earnings dashboard
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Earnings dashboard retrieved successfully.
 *               data:
 *                 revenue:
 *                   todayRevenue: 120
 *                   currencyCode: EUR
 *                   currencySymbol: €
 *                   growthPercentage: 20
 *                   isGrowthPositive: true
 *                   dailyGoalPercentage: 75
 *                   dailyGoalAmount: 160
 *                 overview:
 *                   averageRating: 4.9
 *                   totalReviewsCount: 42
 *                   recentReviewerAvatars: [https://cdn.example.com/a.jpg]
 *                   jobsInProgressCount: 3
 *                 recentTransactions:
 *                   - id: 11111111-2222-3333-4444-555555555555
 *                     jobId: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
 *                     title: Kitchen Sink Leak
 *                     formattedDate: 28 Sep 2026, 2:30 PM
 *                     jobStatus: IN_PROGRESS
 *                     jobStatusLabel: IN PROGRESS
 *                     amount: 120
 *                     formattedAmount: € +120
 *                     currencyCode: EUR
 *                     currencySymbol: €
 *                     payoutStatus: PAID
 *                     paymentStatus: RECEIVED
 *                 recentFeedbacks:
 *                   - id: 99999999-8888-7777-6666-555555555555
 *                     rating: 5
 *                     comment: Great work, very professional.
 *                     customerName: Sarah Jenkins
 *                     customerLocation: Dublin
 *                     customerImage: https://cdn.example.com/photo.jpg
 *                     createdAt: '2026-09-27T10:00:00.000Z'
 */
router.get('/dashboard', validate(earningsDashboardQuerySchema), controller.getEarningsDashboard);

export default router;
