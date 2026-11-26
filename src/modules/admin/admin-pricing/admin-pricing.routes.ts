import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-pricing.controller';
import {
  updatePricingConfigSchema,
  updateCategoryPricingSchema,
  updateSubcategoryPricingSchema,
  listCustomPricingQuerySchema,
} from './admin-pricing.validation';

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
 *         customPricingStats:
 *           type: object
 *           properties:
 *             categoriesWithCustomPricing:
 *               type: integer
 *               example: 3
 *             subcategoriesWithCustomPricing:
 *               type: integer
 *               example: 7
 *             priorityOrder:
 *               type: array
 *               items: { type: string }
 *               example: ["SUBCATEGORY", "CATEGORY", "GLOBAL_DEFAULT"]
 *
 *     CustomPricingInput:
 *       type: object
 *       required:
 *         - enabled
 *       properties:
 *         enabled:
 *           type: boolean
 *           description: Set to true to activate custom pricing, false to reset/fallback to default rule.
 *           example: true
 *         type:
 *           type: string
 *           enum: [PERCENTAGE, FIXED]
 *           default: PERCENTAGE
 *           description: Pricing adjustment type. PERCENTAGE overrides default rate; FIXED sets a flat fee.
 *           example: PERCENTAGE
 *         percentage:
 *           type: number
 *           nullable: true
 *           description: Percentage platform fee (0-100), used when type=PERCENTAGE
 *           example: 15.0
 *         fixedEur:
 *           type: number
 *           nullable: true
 *           description: Flat fee in EUR (€), used when type=FIXED
 *           example: 15.00
 *         fixedGbp:
 *           type: number
 *           nullable: true
 *           description: Flat fee in GBP (£), used when type=FIXED
 *           example: 12.50
 *
 *     CategoryPricingItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           example: "Waste Removal"
 *         categoryCode:
 *           type: string
 *           example: "WASTE_REMOVAL"
 *         customPricing:
 *           type: object
 *           properties:
 *             enabled: { type: boolean, example: true }
 *             type: { type: string, enum: [PERCENTAGE, FIXED], example: "FIXED" }
 *             percentage: { type: number, nullable: true, example: null }
 *             fixedEur: { type: number, nullable: true, example: 15.00 }
 *             fixedGbp: { type: number, nullable: true, example: 12.50 }
 *         effectivePricing:
 *           type: object
 *           properties:
 *             level: { type: string, example: "CATEGORY" }
 *             type: { type: string, example: "FIXED" }
 *             percentage: { type: number, example: 10 }
 *             fixedEur: { type: number, example: 15 }
 *             fixedGbp: { type: number, example: 12.5 }
 *
 *     SubcategoryPricingItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           example: "Emergency Plumbing"
 *         categoryId:
 *           type: string
 *           format: uuid
 *         categoryName:
 *           type: string
 *           example: "Plumbing"
 *         customPricing:
 *           type: object
 *           properties:
 *             enabled: { type: boolean, example: true }
 *             type: { type: string, enum: [PERCENTAGE, FIXED], example: "PERCENTAGE" }
 *             percentage: { type: number, nullable: true, example: 15.0 }
 *             fixedEur: { type: number, nullable: true, example: null }
 *             fixedGbp: { type: number, nullable: true, example: null }
 *         categoryPricing:
 *           type: object
 *           properties:
 *             enabled: { type: boolean, example: false }
 *             type: { type: string, example: "PERCENTAGE" }
 *         effectivePricing:
 *           type: object
 *           properties:
 *             level: { type: string, example: "SUBCATEGORY" }
 *             type: { type: string, example: "PERCENTAGE" }
 *             percentage: { type: number, example: 15.0 }
 *             fixedEur: { type: number, example: 10.0 }
 *             fixedGbp: { type: number, example: 8.5 }
 *             sourceName: { type: string, example: "Emergency Plumbing" }
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
 */
router.get('/', controller.getPricing);
router.put('/', validate(updatePricingConfigSchema), controller.updatePricing);
router.patch('/', validate(updatePricingConfigSchema), controller.updatePricing);

/**
 * @swagger
 * /admin/pricing/custom-rules:
 *   get:
 *     summary: Overview of all Category and Subcategory custom pricing rules
 *     description: Returns the global default rule, priority resolution hierarchy, and all categories/subcategories with active custom pricing.
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active custom pricing overview.
 */
router.get('/custom-rules', controller.getCustomPricingOverview);

/**
 * @swagger
 * /admin/pricing/categories:
 *   get:
 *     summary: List categories with custom pricing status
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: customOnly
 *         schema: { type: boolean }
 *         description: If true, only returns categories with customPricingEnabled=true
 *     responses:
 *       200:
 *         description: List of categories with pricing configuration.
 */
router.get('/categories', validate(listCustomPricingQuerySchema), controller.listCategoriesPricing);

/**
 * @swagger
 * /admin/pricing/categories/{id}:
 *   get:
 *     summary: Get custom pricing configuration for a category
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category pricing details.
 *   put:
 *     summary: Configure or update custom pricing for a category
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomPricingInput'
 *     responses:
 *       200:
 *         description: Category custom pricing updated.
 *   patch:
 *     summary: Partially update custom pricing for a category
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomPricingInput'
 *     responses:
 *       200:
 *         description: Category custom pricing updated.
 *   delete:
 *     summary: Reset category custom pricing (reverts to global default 10%)
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category custom pricing disabled.
 */
router.get('/categories/:id', controller.getCategoryPricing);
router.put('/categories/:id', validate(updateCategoryPricingSchema), controller.updateCategoryPricing);
router.patch('/categories/:id', validate(updateCategoryPricingSchema), controller.updateCategoryPricing);
router.delete('/categories/:id', controller.deleteCategoryPricing);

/**
 * @swagger
 * /admin/pricing/subcategories:
 *   get:
 *     summary: List subcategories with custom pricing status and effective rules
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: Filter subcategories by parent category ID
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: customOnly
 *         schema: { type: boolean }
 *         description: If true, only returns subcategories with customPricingEnabled=true
 *     responses:
 *       200:
 *         description: List of subcategories with pricing configuration.
 */
router.get(
  '/subcategories',
  validate(listCustomPricingQuerySchema),
  controller.listSubcategoriesPricing
);

/**
 * @swagger
 * /admin/pricing/subcategories/{id}:
 *   get:
 *     summary: Get custom pricing configuration for a subcategory
 *     description: Shows subcategory custom rule, parent category rule, and the effective resolved rule.
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Subcategory pricing details.
 *   put:
 *     summary: Configure or update custom pricing for a subcategory
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomPricingInput'
 *     responses:
 *       200:
 *         description: Subcategory custom pricing updated.
 *   patch:
 *     summary: Partially update custom pricing for a subcategory
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomPricingInput'
 *     responses:
 *       200:
 *         description: Subcategory custom pricing updated.
 *   delete:
 *     summary: Reset subcategory custom pricing (reverts to Category/Default rule)
 *     tags: ['Admin / Pricing']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Subcategory custom pricing disabled.
 */
router.get('/subcategories/:id', controller.getSubcategoryPricing);
router.put(
  '/subcategories/:id',
  validate(updateSubcategoryPricingSchema),
  controller.updateSubcategoryPricing
);
router.patch(
  '/subcategories/:id',
  validate(updateSubcategoryPricingSchema),
  controller.updateSubcategoryPricing
);
router.delete('/subcategories/:id', controller.deleteSubcategoryPricing);

export default router;
