/**
 * @swagger
 * components:
 *   parameters:
 *     AdminPage:
 *       in: query
 *       name: page
 *       schema: { type: integer, minimum: 1, default: 1, example: 1 }
 *       description: Page number (1-based).
 *     AdminLimit:
 *       in: query
 *       name: limit
 *       schema: { type: integer, minimum: 1, maximum: 100, default: 10, example: 10 }
 *       description: Rows per page (max 100).
 *     AdminSortOrder:
 *       in: query
 *       name: sortOrder
 *       schema: { type: string, enum: [asc, desc], default: desc }
 *       description: Sort direction for `sortBy`. Empty values are always listed last.
 *     AdminDateFrom:
 *       in: query
 *       name: from
 *       schema: { type: string, example: '2026-09-01' }
 *       description: Inclusive start date (ISO date or datetime). Date-only = 00:00:00.000Z.
 *     AdminDateTo:
 *       in: query
 *       name: to
 *       schema: { type: string, example: '2026-09-30' }
 *       description: Inclusive end date (ISO date or datetime). Date-only = 23:59:59.999Z.
 *     AdminMinAmount:
 *       in: query
 *       name: minAmount
 *       schema: { type: number, minimum: 0, example: 50 }
 *       description: Minimum amount (inclusive).
 *     AdminMaxAmount:
 *       in: query
 *       name: maxAmount
 *       schema: { type: number, minimum: 0, example: 500 }
 *       description: Maximum amount (inclusive). Must be ≥ minAmount.
 *   schemas:
 *     AdminListMeta:
 *       type: object
 *       description: Pagination metadata. Use `total` for counts, not the number of rows on the page.
 *       properties:
 *         total: { type: integer, example: 42, description: Rows matching the filters (all pages) }
 *         page: { type: integer, example: 1 }
 *         limit: { type: integer, example: 10 }
 *         totalPages: { type: integer, example: 5 }
 *     HistoricalMoney:
 *       type: object
 *       description: Amount in the currency it was charged in (never converted).
 *       properties:
 *         amount: { type: number, example: 144 }
 *         currency: { type: string, example: EUR }
 *         formatted: { type: string, example: '€144.00' }
 *         isHistorical: { type: boolean, example: true }
 *   responses:
 *     AdminListValidationError:
 *       description: Invalid query parameter (unknown sortBy/enum value, bad uuid or date, min greater than max). `message` = first field error; `error` lists all.
 *       content:
 *         application/json:
 *           example:
 *             success: false
 *             message: 'sortBy must be one of: …'
 *             error:
 *               - field: query.sortBy
 *                 message: 'sortBy must be one of: …'
 *     AdminUnauthorized:
 *       description: Missing, invalid or expired admin access token.
 *       content:
 *         application/json:
 *           example: { success: false, message: 'Admin access token is missing or invalid.' }
 */
export {};
