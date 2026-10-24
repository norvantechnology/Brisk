import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { uploadMiddleware } from '../../uploads/uploads.middleware';
import * as controller from './admin-import.controller';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/categories/import:
 *   post:
 *     summary: Bulk import Categories from Excel or CSV
 *     tags: ['Admin / Categories', 'Admin / Masters Import']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Admin Masters Import — Categories**
 *       Upload an Excel (`.xlsx`, `.xls`) or CSV file to bulk import or update master categories.
 *
 *       **Supported Columns in Spreadsheet:**
 *       - `name` *(Required)*: Category title (e.g. `Solar & Electrical`)
 *       - `categoryCode`: Unique code (e.g. `CAT-0010`). If omitted, auto-generated from slug.
 *       - `urlSlug`: URL slug (e.g. `solar-electrical`). If omitted, auto-generated from name.
 *       - `description`: Text description
 *       - `iconName`: Icon identifier (e.g. `sun`, `tools`, `plumbing`)
 *       - `brandThemeColor`: Hex color code (e.g. `#FF9800`)
 *       - `displayOrder`: Number (e.g. `1`, `2`)
 *       - `status`: `active` or `inactive` (Default: `active`)
 *       - `featured`: `true` or `false` (Default: `false`)
 *
 *       **Duplicate Handling Modes:**
 *       - `mode=skip` (default): Skips duplicate categories without failing the whole import.
 *       - `mode=upsert`: Updates existing category with new data from spreadsheet.
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [skip, upsert]
 *           default: skip
 *         description: How to handle duplicate categories.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel (.xlsx, .xls) or CSV file.
 *               mode:
 *                 type: string
 *                 enum: [skip, upsert]
 *                 default: skip
 *                 description: Optional duplicate handling mode.
 *     responses:
 *       200:
 *         description: Categories import result with summary, updated, skipped, and errors list.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Category import completed: 5 imported, 2 updated, 1 skipped, 0 failed."
 *               data:
 *                 summary:
 *                   totalRows: 8
 *                   importedCount: 5
 *                   updatedCount: 2
 *                   skippedCount: 1
 *                   failedCount: 0
 *                 imported:
 *                   - id: "7c9e6679-7425-40de-944b-e07fc1f90ae7"
 *                     name: "Solar & Electrical"
 *                     categoryCode: "CAT-0010"
 *                     urlSlug: "solar-electrical"
 *                     status: "active"
 *                 updated: []
 *                 skipped:
 *                   - row: 4
 *                     identifier: "Plumbing"
 *                     reason: "Category with code CAT-0001 already exists."
 *                 errors: []
 *       400:
 *         description: Invalid file or missing required file.
 */
router.post(
  ['/categories/import', '/import/categories'],
  uploadMiddleware.single('file'),
  controller.importCategories
);

/**
 * @swagger
 * /admin/categories/import/template:
 *   get:
 *     summary: Download sample import template for Categories (Excel or CSV)
 *     tags: ['Admin / Categories', 'Admin / Masters Import']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns a ready-to-use sample spreadsheet with correct headers and example rows.
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, xlsx]
 *           default: csv
 *         description: File format (CSV or Excel).
 *     responses:
 *       200:
 *         description: Downloadable sample template file.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  ['/categories/import/template', '/import/categories/template'],
  controller.downloadTemplate
);

/**
 * @swagger
 * /admin/sub-categories/import:
 *   post:
 *     summary: Bulk import Subcategories from Excel or CSV
 *     tags: ['Admin / Sub-Categories', 'Admin / Masters Import']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Admin Masters Import — Subcategories**
 *       Upload an Excel (`.xlsx`, `.xls`) or CSV file to bulk import or update master subcategories under categories.
 *
 *       **Supported Columns in Spreadsheet:**
 *       - `categoryCode` *(Required)*: Parent category code (or `categoryName` / `categoryId`)
 *       - `name` *(Required)*: Subcategory title (e.g. `Solar Panel Installation`)
 *       - `urlSlug`: URL slug (e.g. `solar-panel-installation`)
 *       - `code`: Subcategory code (e.g. `SUB-001`)
 *       - `serviceType`: Type tag (e.g. `Installation`, `Repair`, `Cleaning`)
 *       - `siteVisitEnabled`: `true` or `false`
 *       - `siteVisitFee`: Decimal amount (e.g. `30.00`)
 *       - `priceEnabled`: `true` or `false` (Default: `true`)
 *       - `priceEnteredBy`: `CUSTOMER` or `TRADER` (Default: `CUSTOMER`)
 *       - `status`: `active` or `inactive` (Default: `active`)
 *       - `featured`: `true` or `false` (Default: `false`)
 *
 *       **Duplicate Handling Modes:**
 *       - `mode=skip` (default): Skips duplicate subcategories without failing the whole import.
 *       - `mode=upsert`: Updates existing subcategory with new data from spreadsheet.
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [skip, upsert]
 *           default: skip
 *         description: How to handle duplicate subcategories.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel (.xlsx, .xls) or CSV file.
 *               mode:
 *                 type: string
 *                 enum: [skip, upsert]
 *                 default: skip
 *                 description: Optional duplicate handling mode.
 *     responses:
 *       200:
 *         description: Subcategories import result with summary, updated, skipped, and errors list.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Subcategory import completed: 10 imported, 1 updated, 1 skipped, 0 failed."
 *               data:
 *                 summary:
 *                   totalRows: 12
 *                   importedCount: 10
 *                   updatedCount: 1
 *                   skippedCount: 1
 *                   failedCount: 0
 *                 imported:
 *                   - id: "9a2f7c61-7425-40de-944b-e07fc1f90bc2"
 *                     categoryId: "7c9e6679-7425-40de-944b-e07fc1f90ae7"
 *                     name: "Solar Panel Installation"
 *                     urlSlug: "solar-panel-installation"
 *                     siteVisitEnabled: true
 *                     siteVisitFee: "30.00"
 *                     priceEnabled: true
 *                     priceEnteredBy: "CUSTOMER"
 *                 updated: []
 *                 skipped: []
 *                 errors: []
 *       400:
 *         description: Invalid file or missing required file.
 */
router.post(
  ['/sub-categories/import', '/categories/subcategories/import', '/import/subcategories'],
  uploadMiddleware.single('file'),
  controller.importSubcategories
);

/**
 * @swagger
 * /admin/sub-categories/import/template:
 *   get:
 *     summary: Download sample import template for Subcategories (Excel or CSV)
 *     tags: ['Admin / Sub-Categories', 'Admin / Masters Import']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns a ready-to-use sample spreadsheet with correct headers and example rows.
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, xlsx]
 *           default: csv
 *         description: File format (CSV or Excel).
 *     responses:
 *       200:
 *         description: Downloadable sample template file.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  ['/sub-categories/import/template', '/categories/subcategories/import/template', '/import/subcategories/template'],
  controller.downloadTemplate
);

export default router;
