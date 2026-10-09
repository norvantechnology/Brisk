/**
 * @swagger
 * components:
 *   parameters:
 *     TraderPage:
 *       in: query
 *       name: page
 *       schema: { type: integer, minimum: 1, default: 1, example: 1 }
 *       description: Page number (1-based).
 *     TraderSearch:
 *       in: query
 *       name: search
 *       schema: { type: string, example: 'JOB-1024' }
 *       description: Case-insensitive partial match. Searched columns are listed on each endpoint.
 *     TraderSortOrder:
 *       in: query
 *       name: sortOrder
 *       schema: { type: string, enum: [asc, desc] }
 *       description: Sort direction for `sortBy` (case-insensitive; default per endpoint). Empty values are always listed last.
 *     TraderDateFrom:
 *       in: query
 *       name: from
 *       schema: { type: string, example: '2026-09-01' }
 *       description: Inclusive start date (ISO date or datetime). Date-only = 00:00:00.000Z.
 *     TraderDateTo:
 *       in: query
 *       name: to
 *       schema: { type: string, example: '2026-09-30' }
 *       description: Inclusive end date (ISO date or datetime). Date-only = 23:59:59.999Z.
 *     TraderMinAmount:
 *       in: query
 *       name: minAmount
 *       schema: { type: number, minimum: 0, example: 50 }
 *       description: Minimum amount (inclusive).
 *     TraderMaxAmount:
 *       in: query
 *       name: maxAmount
 *       schema: { type: number, minimum: 0, example: 500 }
 *       description: Maximum amount (inclusive). Must be ≥ minAmount.
 *   schemas:
 *     TraderListMeta:
 *       type: object
 *       description: Pagination metadata. `total` = rows matching the filters across all pages.
 *       properties:
 *         total: { type: integer, example: 42 }
 *         page: { type: integer, example: 1 }
 *         limit: { type: integer, example: 10 }
 *         totalPages: { type: integer, example: 5 }
 *   responses:
 *     TraderListValidationError:
 *       description: Invalid query parameter (unknown sortBy/enum value, bad uuid or date, min greater than max). `message` = first field error; `error` lists all.
 *       content:
 *         application/json:
 *           example:
 *             success: false
 *             message: 'sortBy must be one of: …'
 *             error:
 *               - field: query.sortBy
 *                 message: 'sortBy must be one of: …'
 *     TraderUnauthorized:
 *       description: Missing, invalid or expired access token.
 *       content:
 *         application/json:
 *           example: { success: false, message: 'Access token is missing or invalid.' }
 *     TraderForbidden:
 *       description: Token is valid but the user is not a trader, or (marketplace routes) the trader is not verified yet.
 *       content:
 *         application/json:
 *           examples:
 *             wrongRole:
 *               summary: Not a trader account
 *               value: { success: false, message: 'Forbidden: Access denied for this user role.' }
 *             notVerified:
 *               summary: Trader pending admin verification
 *               value:
 *                 success: false
 *                 message: 'Trader account is pending verification. Marketplace access is unavailable until admin approval.'
 *                 data:
 *                   verificationStatus: PENDING
 *                   onboardingStatus: SUBMITTED
 *                   nextStep: TRADER_PENDING_APPROVAL
 *                   traderAccountActive: false
 *                   code: TRADER_NOT_VERIFIED
 */
export {};
