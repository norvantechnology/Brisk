import { Router } from 'express';
import * as controller from './admin-property-suppliers.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import {
  idParamSchema,
  supplierCountyParamSchema,
  createPropertySupplierCategorySchema,
  updatePropertySupplierCategorySchema,
  categoryFilterSchema,
  createPropertySupplierSchema,
  updatePropertySupplierSchema,
  supplierFilterSchema,
} from './admin-property-suppliers.validation';

const router = Router();

// Apply admin authentication middleware to all routes
router.use(adminAuthMiddleware);

// ============================================================================
// PROPERTY SUPPLIER CATEGORIES
// ============================================================================

/**
 * @swagger
 * /admin/property-supplier-categories:
 *   get:
 *     summary: List Property Supplier Categories
 *     tags: ['Admin / Property Suppliers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by category name, code, slug, or description
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *         description: Filter by active or inactive status
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [displayOrder, name, createdAt] }
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get(
  '/property-supplier-categories',
  validate(categoryFilterSchema),
  controller.listCategories
);

/**
 * @swagger
 * /admin/property-supplier-categories:
 *   post:
 *     summary: Create Property Supplier Category
 *     tags: ['Admin / Property Suppliers']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: 'Energy Suppliers' }
 *               code: { type: string, example: 'ENERGY' }
 *               slug: { type: string, example: 'energy-suppliers' }
 *               description: { type: string, example: 'Domestic electricity and gas' }
 *               iconUrl: { type: string, example: '/assets/providers/image10.png' }
 *               displayOrder: { type: integer, example: 1 }
 *               isActive: { type: boolean, example: true }
 *     responses:
 *       201:
 *         description: Category created successfully
 */
router.post(
  '/property-supplier-categories',
  validate(createPropertySupplierCategorySchema),
  controller.createCategory
);

/**
 * @swagger
 * /admin/property-supplier-categories/{id}:
 *   get:
 *     summary: Get Property Supplier Category by ID
 *     tags: ['Admin / Property Suppliers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category details
 */
router.get(
  '/property-supplier-categories/:id',
  validate(idParamSchema),
  controller.getCategory
);

/**
 * @swagger
 * /admin/property-supplier-categories/{id}:
 *   put:
 *     summary: Update Property Supplier Category
 *     tags: ['Admin / Property Suppliers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *               iconUrl: { type: string }
 *               displayOrder: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Category updated successfully
 */
router.put(
  '/property-supplier-categories/:id',
  validate(updatePropertySupplierCategorySchema),
  controller.updateCategory
);

/**
 * @swagger
 * /admin/property-supplier-categories/{id}:
 *   delete:
 *     summary: Delete Property Supplier Category
 *     tags: ['Admin / Property Suppliers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category deleted successfully
 */
router.delete(
  '/property-supplier-categories/:id',
  validate(idParamSchema),
  controller.deleteCategory
);

// ============================================================================
// COUNTY COVERAGE OVERVIEW
// ============================================================================

/**
 * @swagger
 * /admin/property-suppliers/coverage/overview:
 *   get:
 *     summary: Irish County Coverage Overview (Suppliers per County)
 *     tags: ['Admin / Property Suppliers']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Counties list with mapped suppliers
 */
router.get(
  '/property-suppliers/coverage/overview',
  controller.getCountyCoverageOverview
);

// ============================================================================
// PROPERTY SUPPLIERS
// ============================================================================

/**
 * @swagger
 * /admin/property-suppliers:
 *   get:
 *     summary: List Property Suppliers (Paginated, Filters for Category, County, Gas, Electricity, Parent)
 *     tags: ['Admin / Property Suppliers']
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
 *         description: Search by supplier name, trading name, service, description
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: categoryCode
 *         schema: { type: string, example: 'WASTE_MANAGEMENT' }
 *       - in: query
 *         name: categorySlug
 *         schema: { type: string, example: 'energy-suppliers' }
 *       - in: query
 *         name: county
 *         schema: { type: string, example: 'Dublin' }
 *         description: Filter suppliers providing service in this Irish county
 *       - in: query
 *         name: parentId
 *         schema: { type: string, format: uuid }
 *         description: Filter sub-brands of a parent supplier
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *       - in: query
 *         name: providesElectricity
 *         schema: { type: string, enum: ['true', 'false'] }
 *       - in: query
 *         name: providesGas
 *         schema: { type: string, enum: ['true', 'false'] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [displayOrder, name, createdAt, updatedAt] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Suppliers list
 */
router.get(
  '/property-suppliers',
  validate(supplierFilterSchema),
  controller.listSuppliers
);

/**
 * @swagger
 * /admin/property-suppliers:
 *   post:
 *     summary: Create Property Supplier
 *     tags: ['Admin / Property Suppliers']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryId, name]
 *             properties:
 *               categoryId: { type: string, format: uuid }
 *               parentId: { type: string, format: uuid, nullable: true }
 *               name: { type: string, example: 'Electric Ireland' }
 *               slug: { type: string, example: 'electric-ireland' }
 *               tradingName: { type: string }
 *               logoUrl: { type: string }
 *               iconUrl: { type: string }
 *               websiteUrl: { type: string }
 *               contactPhone: { type: string }
 *               contactEmail: { type: string }
 *               description: { type: string }
 *               typicalService: { type: string }
 *               coverageSummary: { type: string }
 *               providesElectricity: { type: boolean, default: false }
 *               providesGas: { type: boolean, default: false }
 *               counties: { type: array, items: { type: string }, example: ['Dublin', 'Cork'] }
 *               displayOrder: { type: integer, default: 0 }
 *               isActive: { type: boolean, default: true }
 *               metadata: { type: object }
 *     responses:
 *       201:
 *         description: Supplier created successfully
 */
router.post(
  '/property-suppliers',
  validate(createPropertySupplierSchema),
  controller.createSupplier
);

/**
 * @swagger
 * /admin/property-suppliers/{id}:
 *   get:
 *     summary: Get Property Supplier by ID
 *     tags: ['Admin / Property Suppliers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Supplier details with parent, children, and county coverage
 */
router.get(
  '/property-suppliers/:id',
  validate(idParamSchema),
  controller.getSupplier
);

/**
 * @swagger
 * /admin/property-suppliers/{id}:
 *   put:
 *     summary: Update Property Supplier
 *     tags: ['Admin / Property Suppliers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               categoryId: { type: string, format: uuid }
 *               parentId: { type: string, format: uuid, nullable: true }
 *               name: { type: string }
 *               slug: { type: string }
 *               tradingName: { type: string }
 *               logoUrl: { type: string }
 *               iconUrl: { type: string }
 *               websiteUrl: { type: string }
 *               contactPhone: { type: string }
 *               contactEmail: { type: string }
 *               description: { type: string }
 *               typicalService: { type: string }
 *               coverageSummary: { type: string }
 *               providesElectricity: { type: boolean }
 *               providesGas: { type: boolean }
 *               counties: { type: array, items: { type: string } }
 *               displayOrder: { type: integer }
 *               isActive: { type: boolean }
 *               metadata: { type: object }
 *     responses:
 *       200:
 *         description: Supplier updated successfully
 */
router.put(
  '/property-suppliers/:id',
  validate(updatePropertySupplierSchema),
  controller.updateSupplier
);

/**
 * @swagger
 * /admin/property-suppliers/{id}:
 *   delete:
 *     summary: Delete Property Supplier
 *     tags: ['Admin / Property Suppliers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Supplier deleted successfully
 */
router.delete(
  '/property-suppliers/:id',
  validate(idParamSchema),
  controller.deleteSupplier
);

/**
 * @swagger
 * /admin/property-suppliers/{id}/counties:
 *   post:
 *     summary: Assign County Coverage to Supplier
 *     tags: ['Admin / Property Suppliers']
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
 *             type: object
 *             required: [counties]
 *             properties:
 *               counties:
 *                 type: array
 *                 items: { type: string }
 *                 example: ['Dublin', 'Kildare', 'Wicklow']
 *               isDomesticCollector:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Counties assigned successfully
 */
router.post(
  '/property-suppliers/:id/counties',
  validate(idParamSchema),
  controller.assignCounties
);

/**
 * @swagger
 * /admin/property-suppliers/{id}/counties/{county}:
 *   delete:
 *     summary: Remove County Coverage from Supplier
 *     tags: ['Admin / Property Suppliers']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: county
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: County removed successfully
 */
router.delete(
  '/property-suppliers/:id/counties/:county',
  validate(supplierCountyParamSchema),
  controller.removeCounty
);

export default router;
