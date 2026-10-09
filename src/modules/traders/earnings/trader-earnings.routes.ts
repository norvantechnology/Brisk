import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './trader-earnings.controller';
import {
  earningsDashboardQuerySchema,
  paymentTransactionsQuerySchema,
} from './trader-earnings.validation';

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
 *                     paymentType: FULL_JOB
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

/**
 * @swagger
 * /traders/earnings/payment-transactions:
 *   get:
 *     summary: Trader payment transactions (full list, filters + search)
 *     description: |
 *       Paginated payment requests of the logged-in trader. Each item has the **same shape as
 *       dashboard `recentTransactions`**, so the same row widget can be reused.
 *
 *       - `formattedAmount` e.g. `€ +250`, `jobStatusLabel` e.g. `IN PROGRESS`
 *       - `payoutStatus` `PAID` | `PENDING`; `paymentStatus` `RECEIVED` (customer paid) | `PENDING`
 *       - `paymentType` `FULL_JOB` | `PARTIAL` | `SITE_VISIT_FEE`
 *       - `formattedDate` = paid date for paid items, request date otherwise (in `timezone`)
 *
 *       **Filters** (`filter`): `all` (default) | `last_30_days` | `last_6_months` | `last_1_year` | `custom`
 *       (`custom` requires `startDate` + `endDate`, YYYY-MM-DD). Date applies to paid date for paid items,
 *       request date otherwise.
 *       **Search** (`search`): job title, job ref, or customer name.
 *       **Status** (`status`): `PAID` | `PENDING` (same as `payoutStatus`). **Type** (`type`): `FULL_JOB` | `PARTIAL` | `SITE_VISIT_FEE`.
 *       **Amount** (`minAmount` / `maxAmount`) on `amount`.
 *       Cancelled payment requests are excluded. Default order: last updated first; `sortBy=date` sorts on the date shown (`formattedDate`).
 *
 *       Example: `GET /traders/earnings/payment-transactions?page=1&limit=10&search=pipe&filter=last_30_days&status=PENDING&type=PARTIAL&minAmount=50&sortBy=amount&sortOrder=desc&timezone=Europe/Dublin`
 *     tags: ['Trader / Earnings']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PAID, PENDING] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [FULL_JOB, SITE_VISIT_FEE, PARTIAL] }
 *       - $ref: '#/components/parameters/TraderMinAmount'
 *       - $ref: '#/components/parameters/TraderMaxAmount'
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [date, createdAt, updatedAt, amount, paymentStatus, paymentType, title, jobStatus], default: updatedAt }
 *       - $ref: '#/components/parameters/TraderSortOrder'
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [all, last_30_days, last_6_months, last_1_year, custom], default: all }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, example: '2026-09-01' }
 *         description: Required when filter=custom (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema: { type: string, example: '2026-09-30' }
 *         description: Required when filter=custom (YYYY-MM-DD)
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *       - in: query
 *         name: timezone
 *         schema: { type: string, example: Europe/Dublin }
 *         description: IANA zone for formattedDate (default Europe/Dublin)
 *     responses:
 *       200:
 *         description: Payment transactions
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Payment transactions fetched successfully.
 *               data:
 *                 - id: 11111111-2222-3333-4444-555555555555
 *                   jobId: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
 *                   title: Bathroom Pipe Leakage Repair
 *                   formattedDate: 24 Oct 2026, 10:30 AM
 *                   jobStatus: COMPLETED
 *                   jobStatusLabel: COMPLETED
 *                   amount: 250
 *                   formattedAmount: € +250
 *                   currencyCode: EUR
 *                   currencySymbol: €
 *                   payoutStatus: PAID
 *                   paymentStatus: RECEIVED
 *                   paymentType: FULL_JOB
 *               meta: { page: 1, limit: 10, total: 25, totalPages: 3 }
 *       400:
 *         description: Invalid query (bad enum / sortBy, bad date or timezone, custom range without dates, minAmount > maxAmount).
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: minAmount cannot be greater than maxAmount.
 *               error:
 *                 - field: query.minAmount
 *                   message: minAmount cannot be greater than maxAmount.
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
  '/payment-transactions',
  validate(paymentTransactionsQuerySchema),
  controller.listPaymentTransactions
);

export default router;
