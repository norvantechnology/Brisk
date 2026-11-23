import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-pricing.controller';
import { updatePricingConfigSchema } from './admin-pricing.validation';

const router = Router();
router.use(adminAuthMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminPricingConfig:
 *       type: object
 *       properties:
 *         platformFee:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [PERCENTAGE, FIXED]
 *               example: PERCENTAGE
 *             percentage:
 *               type: number
 *               example: 10
 *               description: Percentage fee of trader net
 *             fixedEur:
 *               type: number
 *               example: 10
 *               description: Fixed platform fee for EUR jobs
 *             fixedGbp:
 *               type: number
 *               example: 8.5
 *               description: Fixed platform fee for GBP jobs
 *         loyaltyPoints:
 *           type: object
 *           properties:
 *             pointsPerEur:
 *               type: integer
 *               example: 10
 *               description: Loyalty points earned per 1 EUR (e.g. 100 EUR = 1000 points)
 *             pointsPerGbp:
 *               type: integer
 *               example: 12
 *               description: Loyalty points earned per 1 GBP (e.g. 100 GBP = 1200 points)
 *         vatTax:
 *           type: object
 *           properties:
 *             traderStandardRate:
 *               type: number
 *               example: 13.5
 *               description: Irish trader standard reduced VAT rate percentage
 *             traderTwoThirdsRate:
 *               type: number
 *               example: 23
 *               description: Irish trader 2/3 rule standard VAT rate percentage
 *             platformFeeRate:
 *               type: number
 *               example: 23
 *               description: Irish platform fee VAT percentage
 *             ukStandardRate:
 *               type: number
 *               example: 20
 *               description: UK standard VAT rate percentage for GBP jobs
 */

/**
 * @swagger
 * /admin/pricing:
 *   get:
 *     summary: Get dynamic pricing, loyalty points, and VAT tax configuration
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current pricing configuration.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/AdminPricingConfig' }
 *   put:
 *     summary: Update dynamic pricing, loyalty points, and VAT tax configuration
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminPricingConfig'
 *     responses:
 *       200:
 *         description: Pricing configuration updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/AdminPricingConfig' }
 *   patch:
 *     summary: Partially update dynamic pricing, loyalty points, and VAT tax configuration
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminPricingConfig'
 *     responses:
 *       200:
 *         description: Pricing configuration updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/AdminPricingConfig' }
 */
router.get('/', controller.getPricing);
router.put('/', validate(updatePricingConfigSchema), controller.updatePricing);
router.patch('/', validate(updatePricingConfigSchema), controller.updatePricing);

export default router;
