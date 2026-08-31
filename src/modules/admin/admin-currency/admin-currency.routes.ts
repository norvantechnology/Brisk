import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-currency.controller';
import {
  updateCurrencySchema,
  updatePlatformCurrencySettingsSchema,
  upsertCurrencySchema,
  upsertExchangeRatesSchema,
} from './admin-currency.validation';

const router = Router();
router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/currency:
 *   get:
 *     summary: Currency overview (base currency, catalog, exchange rates)
 *     tags: ['Admin / Currency']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform currency configuration.
 */
router.get('/currency', controller.getCurrencyOverview);

/**
 * @swagger
 * /admin/currency/settings:
 *   put:
 *     summary: Set platform base currency
 *     tags: ['Admin / Currency']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [baseCurrency]
 *             properties:
 *               baseCurrency: { type: string, example: EUR }
 *     responses:
 *       200:
 *         description: Base currency updated.
 */
router.put(
  '/currency/settings',
  validate(updatePlatformCurrencySettingsSchema),
  controller.updatePlatformBaseCurrency
);

/**
 * @swagger
 * /admin/currency/currencies:
 *   post:
 *     summary: Create or update a currency in the catalog
 *     tags: ['Admin / Currency']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, symbol]
 *             properties:
 *               code: { type: string, example: INR }
 *               name: { type: string, example: Indian Rupee }
 *               symbol: { type: string, example: ₹ }
 *               decimalPlaces: { type: integer, example: 2 }
 *               isActive: { type: boolean }
 *               sortOrder: { type: integer }
 *     responses:
 *       200:
 *         description: Currency saved.
 */
router.post('/currency/currencies', validate(upsertCurrencySchema), controller.upsertCurrency);

/**
 * @swagger
 * /admin/currency/currencies/{code}:
 *   put:
 *     summary: Update currency catalog entry
 *     tags: ['Admin / Currency']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Currency updated.
 */
router.put(
  '/currency/currencies/:code',
  validate(updateCurrencySchema),
  controller.updateCurrency
);

/**
 * @swagger
 * /admin/currency/exchange-rates:
 *   put:
 *     summary: Bulk update exchange rates from platform base currency
 *     tags: ['Admin / Currency']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Rates are stored as **1 baseCurrency = X toCurrency**.
 *       Example base EUR: `{ toCurrency: USD, rate: 1.08 }` means 1 EUR = 1.08 USD.
 *       Historical invoices/payments keep their original `currencyCode` — rates affect new display only.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rates]
 *             properties:
 *               rates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [toCurrency, rate]
 *                   properties:
 *                     toCurrency: { type: string, example: USD }
 *                     rate: { type: number, example: 1.08 }
 *     responses:
 *       200:
 *         description: Exchange rates updated.
 */
router.put(
  '/currency/exchange-rates',
  validate(upsertExchangeRatesSchema),
  controller.upsertExchangeRates
);

export default router;
