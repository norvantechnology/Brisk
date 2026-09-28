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
 *       - `startDate` / `endDate` — `YYYY-MM-DD` (required when `filter=custom`)
 *
 *       **Receipt:** open `receiptUrl` (Bearer) → PDF invoice download.
 *     tags: ['Trader / Payments']
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, last_30_days, last_6_months, last_1_year, custom]
 *           default: all
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date, example: '2026-01-01' }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date, example: '2026-09-28' }
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
 */
router.get('/history', validate(paymentHistoryQuerySchema), controller.listPaymentHistory);

export default router;
