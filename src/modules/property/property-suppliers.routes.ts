import { Router } from 'express';
import * as controller from './property-suppliers.controller';

const router = Router();

/**
 * @swagger
 * /property-suppliers/categories:
 *   get:
 *     summary: List Active Property Supplier Categories (Energy, Broadband, Waste Management, etc.)
 *     tags: ['Property Suppliers']
 *     responses:
 *       200:
 *         description: List of active supplier categories with provider counts
 */
router.get('/property-suppliers/categories', controller.listCategories);

/**
 * @swagger
 * /property-suppliers/counties:
 *   get:
 *     summary: List Irish Counties and available domestic collectors / suppliers
 *     tags: ['Property Suppliers']
 *     responses:
 *       200:
 *         description: List of Irish counties with active suppliers
 */
router.get('/property-suppliers/counties', controller.listCounties);

/**
 * @swagger
 * /property-suppliers:
 *   get:
 *     summary: List Active Property Suppliers (Filterable by Category, County, Electricity, Gas)
 *     tags: ['Property Suppliers']
 *     parameters:
 *       - in: query
 *         name: categoryCode
 *         schema: { type: string, example: 'ENERGY' }
 *         description: Category code (ENERGY, BROADBAND, WASTE_MANAGEMENT)
 *       - in: query
 *         name: categorySlug
 *         schema: { type: string, example: 'energy-suppliers' }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: county
 *         schema: { type: string, example: 'Dublin' }
 *         description: Filter suppliers operating in this Irish county (e.g. Dublin, Cork, Galway)
 *       - in: query
 *         name: electricity
 *         schema: { type: boolean }
 *         description: Filter energy suppliers offering domestic electricity
 *       - in: query
 *         name: gas
 *         schema: { type: boolean }
 *         description: Filter energy suppliers offering domestic natural gas
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by supplier name, trading name, or services
 *     responses:
 *       200:
 *         description: Suppliers list
 */
router.get('/property-suppliers', controller.listSuppliers);

/**
 * @swagger
 * /property-suppliers/{id}:
 *   get:
 *     summary: Get Property Supplier Detail by ID or Slug
 *     tags: ['Property Suppliers']
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Supplier UUID or URL slug (e.g. bord-gais-energy, eir, panda)
 *     responses:
 *       200:
 *         description: Supplier details with parent brand, sub-brands, services, and covered counties
 */
router.get('/property-suppliers/:id', controller.getSupplierDetail);

export default router;
