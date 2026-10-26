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

/**
 * @swagger
 * /admin/document-rules/import:
 *   post:
 *     summary: Bulk import Document Rules from Excel or CSV
 *     tags: ['Admin / Document Rules', 'Admin / Masters Import']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Admin Masters Import — Document Rules**
 *       Upload an Excel (`.xlsx`, `.xls`) or CSV file to bulk import or update trader document verification requirements.
 *
 *       **Supported Columns in Spreadsheet:**
 *       - `scope`: `ENTITY` (for Solo/Company general requirements) or `CATEGORY` (for trade-specific requirements). Default: `ENTITY`.
 *       - `traderType`: `SOLO` or `COMPANY` (required if `scope=ENTITY`).
 *       - `categoryCode`: Category code/name/slug (required if `scope=CATEGORY`).
 *       - `documentKey` *(Required)*: Unique identifier (e.g. `driving_license`, `public_liability_insurance`, `safe_pass`).
 *       - `name` *(Required)*: Display title (e.g. `Public Liability Insurance`).
 *       - `description`: Instructions for the trader.
 *       - `required`: `true` or `false` (Default: `true`).
 *       - `acceptedFormats`: File types accepted (e.g. `pdf,image`). Default: `pdf,image`.
 *       - `sortOrder`: Number (e.g. `1`, `2`). Default: `0`.
 *       - `status`: `active` or `inactive` (Default: `active`).
 *
 *       **Duplicate Handling Modes:**
 *       - `mode=skip` (default): Skips duplicate rules without failing the whole batch.
 *       - `mode=upsert`: Updates existing rules with new spreadsheet values.
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [skip, upsert]
 *           default: skip
 *         description: How to handle duplicate document rules.
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
 *     responses:
 *       200:
 *         description: Import completed with summary and error report.
 *       400:
 *         description: Invalid file or missing required file.
 */
router.post(
  ['/document-rules/import', '/import/document-rules'],
  uploadMiddleware.single('file'),
  controller.importDocumentRules
);

/**
 * @swagger
 * /admin/document-rules/import/template:
 *   get:
 *     summary: Download sample import template for Document Rules (Excel or CSV)
 *     tags: ['Admin / Document Rules', 'Admin / Masters Import']
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
  ['/document-rules/import/template', '/import/document-rules/template'],
  (req, res, next) => {
    req.params.entity = 'document-rules';
    return controller.downloadTemplate(req, res, next);
  }
);

/**
 * @swagger
 * /admin/locations/import:
 *   post:
 *     summary: Bulk import Locations (Countries & Counties) from Excel or CSV
 *     tags: ['Admin / Locations', 'Admin / Masters Import']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Admin Masters Import — Locations**
 *       Upload an Excel (`.xlsx`, `.xls`) or CSV file to bulk import or update countries and counties.
 *
 *       **Supported Columns in Spreadsheet:**
 *       - `countryCode` *(Required)*: ISO 3166-1 alpha-2 code (e.g. `IE`, `GB`).
 *       - `countryName` *(Required)*: Full country name (e.g. `Ireland`, `United Kingdom`).
 *       - `countyName`: County name (e.g. `Dublin`, `Cork`, `Galway`). If omitted, creates country only.
 *       - `countyCode`: Optional county short code (e.g. `DB`, `CK`).
 *       - `isActive`: `true` or `false` (Default: `true`).
 *       - `sortOrder`: Number (Default: `0`).
 *
 *       **Duplicate Handling Modes:**
 *       - `mode=skip` (default): Skips existing records without failing.
 *       - `mode=upsert`: Updates existing country/county records with spreadsheet data.
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [skip, upsert]
 *           default: skip
 *         description: How to handle duplicate location records.
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
 *     responses:
 *       200:
 *         description: Import completed with summary and error report.
 *       400:
 *         description: Invalid file or missing required file.
 */
router.post(
  ['/locations/import', '/import/locations'],
  uploadMiddleware.single('file'),
  controller.importLocations
);

/**
 * @swagger
 * /admin/locations/import/template:
 *   get:
 *     summary: Download sample import template for Locations (Excel or CSV)
 *     tags: ['Admin / Locations', 'Admin / Masters Import']
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
  ['/locations/import/template', '/import/locations/template'],
  (req, res, next) => {
    req.params.entity = 'locations';
    return controller.downloadTemplate(req, res, next);
  }
);

export default router;
