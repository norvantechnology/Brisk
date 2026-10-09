import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './trader-payments.controller';
import { paymentHistoryQuerySchema } from './trader-payments.validation';

const router = Router();

/**
 * @swagger
 * /traders/payments/history:
 *   get:
 *     summary: Trader payment history
 *     description: |
 *       Profile → Payments list. Paginated payment requests for the logged-in trader.
 *
 *       **Query**
 *       - `page`, `limit`
 *       - `search` — job code, title, or customer name
 *       - `filter` — `all` | `last_30_days` | `last_6_months` | `last_1_year` | `custom`
 *       - `startDate` / `endDate` — `YYYY-MM-DD` (required when `filter=custom`). Date = paid date for PAID, request date otherwise.
 *       - `status` — `PAID` | `PENDING` (same as row `status`), `type` — payment request type
 *       - `minAmount` / `maxAmount` — on `totalAmount`
 *       - `sortBy` + `sortOrder` — default: last updated first. `paymentDate` sorts on the date shown on the row.
 *
 *       Cancelled payment requests are excluded.
 *
 *       Example: `GET /traders/payments/history?page=1&limit=10&search=sink&filter=custom&startDate=2026-09-01&endDate=2026-09-30&status=PAID&type=FULL_JOB&minAmount=50&maxAmount=500&sortBy=paymentDate&sortOrder=desc`
 *
 *       **Receipt:** open `receiptUrl` (Bearer) → PDF invoice download.
 *     tags: ['Trader / Payments']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/TraderPage'
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, default: 10, maximum: 50 }
 *       - in: query
 *         name: search
 *         schema: { type: string, example: sink }
 *         description: Job code, job title or customer name.
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, last_30_days, last_6_months, last_1_year, custom]
 *           default: all
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date, example: '2026-01-01' }
 *         description: Required when filter=custom (YYYY-MM-DD).
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date, example: '2026-09-28' }
 *         description: Required when filter=custom (YYYY-MM-DD).
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PAID, PENDING] }
 *         description: PENDING = requested but not paid yet.
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [FULL_JOB, SITE_VISIT_FEE, PARTIAL] }
 *       - $ref: '#/components/parameters/TraderMinAmount'
 *       - $ref: '#/components/parameters/TraderMaxAmount'
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [paymentDate, createdAt, updatedAt, totalAmount, status, type, jobCode, jobTitle, customerName], default: updatedAt }
 *       - $ref: '#/components/parameters/TraderSortOrder'
 *     responses:
 *       200:
 *         description: Payment history list
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Payment history retrieved successfully.
 *               data:
 *                 - id: 11111111-2222-3333-4444-555555555555
 *                   jobId: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
 *                   jobCode: '#JOB-A43E'
 *                   jobTitle: Kitchen Sink Leak
 *                   customerName: Sarah Jenkins
 *                   customerImage: https://cdn.example.com/photo.jpg
 *                   totalAmount: 120
 *                   currencyCode: EUR
 *                   currencySymbol: €
 *                   status: PAID
 *                   paymentDate: '2026-09-20T10:00:00.000Z'
 *                   receiptUrl: https://api.brisk.ie/traders/jobs/mine/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/invoice/download
 *               meta:
 *                 total: 1
 *                 page: 1
 *                 limit: 10
 *                 totalPages: 1
 *       400:
 *         description: Invalid query (bad enum / sortBy, bad date, custom range without dates, minAmount > maxAmount).
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: startDate and endDate (YYYY-MM-DD) are required when filter=custom.
 *               error:
 *                 - field: query.startDate
 *                   message: startDate and endDate (YYYY-MM-DD) are required when filter=custom.
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
router.get('/history', validate(paymentHistoryQuerySchema), controller.listPaymentHistory);

export default router;
