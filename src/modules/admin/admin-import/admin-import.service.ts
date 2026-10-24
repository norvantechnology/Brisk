import * as XLSX from 'xlsx';
import { SubcategoryPriceEnteredBy } from '@prisma/client';
import { prisma } from '../../../config/database';
import { ImportMode, ImportResult, RowError, SkippedRow } from './admin-import.types';
import { BadRequestError } from '../../../utils/errors';

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toBoolean = (val: unknown, defaultVal = false): boolean => {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return defaultVal;
};

const normalizeRow = (raw: Record<string, unknown>): Record<string, unknown> => {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.trim().toLowerCase().replace(/[\s_-]+/g, '');
    clean[key] = typeof v === 'string' ? v.trim() : v;
  }
  return clean;
};

export const parseBufferToRows = (buffer: Buffer): Record<string, unknown>[] => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  } catch (err) {
    throw new BadRequestError('Invalid Excel or CSV file. Could not parse data.');
  }
};

/**
 * Bulk import Categories from parsed spreadsheet rows.
 */
export const importCategories = async (
  rows: Record<string, unknown>[],
  mode: ImportMode = 'skip'
): Promise<ImportResult> => {
  const imported: unknown[] = [];
  const updated: unknown[] = [];
  const skipped: SkippedRow[] = [];
  const errors: RowError[] = [];

  let rowNum = 1; // Header is row 1
  for (const raw of rows) {
    rowNum++;
    const row = normalizeRow(raw);

    const name = String(row['name'] || row['categoryname'] || '').trim();
    if (!name) {
      errors.push({
        row: rowNum,
        field: 'name',
        message: 'Category name is required.',
      });
      continue;
    }

    let categoryCode = String(row['categorycode'] || row['code'] || '').trim();
    const urlSlug = slugify(String(row['urlslug'] || row['slug'] || name));
    const description = row['description'] ? String(row['description']).trim() : null;
    const iconName = row['iconname'] || row['icon'] ? String(row['iconname'] || row['icon']).trim() : null;
    const brandThemeColor = row['brandthemecolor'] || row['themecolor'] || row['color']
      ? String(row['brandthemecolor'] || row['themecolor'] || row['color']).trim()
      : null;
    const displayOrder = row['displayorder'] || row['order'] ? Number(row['displayorder'] || row['order']) || 0 : 0;
    const rawStatus = String(row['status'] || 'active').trim().toLowerCase();
    const status = rawStatus === 'inactive' ? 'inactive' : 'active';
    const featured = toBoolean(row['featured'], false);

    // Auto-generate categoryCode if missing
    if (!categoryCode) {
      categoryCode = `CAT-${urlSlug.toUpperCase().slice(0, 10)}`;
    }

    // Check existing
    const existing = await prisma.category.findFirst({
      where: {
        OR: [{ categoryCode }, { urlSlug }],
      },
    });

    if (existing) {
      if (mode === 'skip') {
        skipped.push({
          row: rowNum,
          identifier: name,
          reason: `Category with code "${existing.categoryCode}" or slug "${existing.urlSlug}" already exists.`,
        });
        continue;
      } else {
        // Upsert mode -> update
        try {
          const item = await prisma.category.update({
            where: { id: existing.id },
            data: {
              name,
              description: description ?? existing.description,
              iconName: iconName ?? existing.iconName,
              brandThemeColor: brandThemeColor ?? existing.brandThemeColor,
              displayOrder: displayOrder || existing.displayOrder,
              status,
              featured,
            },
          });
          updated.push(item);
        } catch (err: unknown) {
          errors.push({
            row: rowNum,
            identifier: name,
            message: err instanceof Error ? err.message : 'Failed to update category',
          });
        }
        continue;
      }
    }

    // Insert new
    try {
      const item = await prisma.category.create({
        data: {
          name,
          categoryCode,
          urlSlug,
          description,
          iconName,
          brandThemeColor,
          displayOrder,
          status,
          featured,
        },
      });
      imported.push(item);
    } catch (err: unknown) {
      errors.push({
        row: rowNum,
        identifier: name,
        message: err instanceof Error ? err.message : 'Failed to create category',
      });
    }
  }

  return {
    summary: {
      totalRows: rows.length,
      importedCount: imported.length,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      failedCount: errors.length,
    },
    imported,
    updated,
    skipped,
    errors,
  };
};

/**
 * Bulk import Subcategories from parsed spreadsheet rows.
 */
export const importSubcategories = async (
  rows: Record<string, unknown>[],
  mode: ImportMode = 'skip'
): Promise<ImportResult> => {
  const imported: unknown[] = [];
  const updated: unknown[] = [];
  const skipped: SkippedRow[] = [];
  const errors: RowError[] = [];

  let rowNum = 1;
  for (const raw of rows) {
    rowNum++;
    const row = normalizeRow(raw);

    const name = String(row['name'] || row['subcategoryname'] || '').trim();
    if (!name) {
      errors.push({
        row: rowNum,
        field: 'name',
        message: 'Subcategory name is required.',
      });
      continue;
    }

    // Resolve parent category
    const categoryRef = String(
      row['categorycode'] || row['categoryid'] || row['categoryname'] || row['category'] || ''
    ).trim();

    if (!categoryRef) {
      errors.push({
        row: rowNum,
        identifier: name,
        field: 'categoryCode',
        message: 'Parent category (categoryCode, categoryName, or categoryId) is required.',
      });
      continue;
    }

    const parentCategory = await prisma.category.findFirst({
      where: {
        OR: [
          { categoryCode: categoryRef },
          { name: { equals: categoryRef, mode: 'insensitive' } },
          ...(categoryRef.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
            ? [{ id: categoryRef }]
            : []),
        ],
      },
    });

    if (!parentCategory) {
      errors.push({
        row: rowNum,
        identifier: name,
        field: 'categoryCode',
        message: `Parent category "${categoryRef}" was not found.`,
      });
      continue;
    }

    const urlSlug = slugify(String(row['urlslug'] || row['slug'] || name));
    const code = row['code'] ? String(row['code']).trim() : null;
    const serviceType = row['servicetype'] ? String(row['servicetype']).trim() : null;
    const siteVisitEnabled = toBoolean(row['sitevisitenabled'] || row['sitevisit'], false);
    const siteVisitFee = row['sitevisitfee'] != null && row['sitevisitfee'] !== ''
      ? Number(row['sitevisitfee'])
      : null;
    const priceEnabled = toBoolean(row['priceenabled'], true);

    const rawPriceEnteredBy = String(row['priceenteredby'] || 'CUSTOMER').trim().toUpperCase();
    const priceEnteredBy = rawPriceEnteredBy === 'TRADER'
      ? SubcategoryPriceEnteredBy.TRADER
      : SubcategoryPriceEnteredBy.CUSTOMER;

    const rawStatus = String(row['status'] || 'active').trim().toLowerCase();
    const status = rawStatus === 'inactive' ? 'inactive' : 'active';
    const featured = toBoolean(row['featured'], false);

    // Check existing within category
    const existing = await prisma.subcategory.findFirst({
      where: {
        categoryId: parentCategory.id,
        OR: [{ urlSlug }, { name: { equals: name, mode: 'insensitive' } }],
      },
    });

    if (existing) {
      if (mode === 'skip') {
        skipped.push({
          row: rowNum,
          identifier: `${parentCategory.name} -> ${name}`,
          reason: `Subcategory "${name}" already exists in category "${parentCategory.name}".`,
        });
        continue;
      } else {
        // Upsert mode -> update
        try {
          const item = await prisma.subcategory.update({
            where: { id: existing.id },
            data: {
              name,
              code: code ?? existing.code,
              serviceType: serviceType ?? existing.serviceType,
              siteVisitEnabled,
              siteVisitFee: siteVisitFee != null ? siteVisitFee : existing.siteVisitFee,
              priceEnabled,
              priceEnteredBy,
              status,
              featured,
            },
          });
          updated.push(item);
        } catch (err: unknown) {
          errors.push({
            row: rowNum,
            identifier: name,
            message: err instanceof Error ? err.message : 'Failed to update subcategory',
          });
        }
        continue;
      }
    }

    // Insert new
    try {
      const item = await prisma.subcategory.create({
        data: {
          categoryId: parentCategory.id,
          name,
          urlSlug,
          code,
          serviceType,
          siteVisitEnabled,
          siteVisitFee,
          priceEnabled,
          priceEnteredBy,
          status,
          featured,
        },
      });
      imported.push(item);
    } catch (err: unknown) {
      errors.push({
        row: rowNum,
        identifier: name,
        message: err instanceof Error ? err.message : 'Failed to create subcategory',
      });
    }
  }

  return {
    summary: {
      totalRows: rows.length,
      importedCount: imported.length,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      failedCount: errors.length,
    },
    imported,
    updated,
    skipped,
    errors,
  };
};

/**
 * Generate sample CSV / Excel template buffer for download.
 */
export const generateTemplate = (
  entity: 'categories' | 'subcategories',
  format: 'csv' | 'xlsx' = 'csv'
): { buffer: Buffer; filename: string; mimeType: string } => {
  const wb = XLSX.utils.book_new();

  if (entity === 'categories') {
    const headers = [
      'name',
      'categoryCode',
      'urlSlug',
      'description',
      'iconName',
      'brandThemeColor',
      'displayOrder',
      'status',
      'featured',
    ];
    const sampleRows = [
      [
        'Solar & Electrical',
        'CAT-0010',
        'solar-electrical',
        'Solar panels, battery storage, and wiring',
        'sun',
        '#FF9800',
        1,
        'active',
        true,
      ],
      [
        'Plumbing & Heating',
        'CAT-0011',
        'plumbing-heating',
        'Boilers, pipes, radiators, and heating repair',
        'droplet',
        '#0288D1',
        2,
        'active',
        false,
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Categories');
  } else {
    const headers = [
      'categoryCode',
      'name',
      'urlSlug',
      'code',
      'serviceType',
      'siteVisitEnabled',
      'siteVisitFee',
      'priceEnabled',
      'priceEnteredBy',
      'status',
      'featured',
    ];
    const sampleRows = [
      [
        'CAT-0010',
        'Solar Panel Installation',
        'solar-panel-installation',
        'SUB-001',
        'Installation',
        true,
        30.0,
        true,
        'CUSTOMER',
        'active',
        true,
      ],
      [
        'CAT-0010',
        'Solar Inverter Repair',
        'solar-inverter-repair',
        'SUB-002',
        'Repair',
        false,
        0,
        true,
        'CUSTOMER',
        'active',
        false,
      ],
      [
        'CAT-0011',
        'Emergency Leak Repair',
        'emergency-leak-repair',
        'SUB-003',
        'Emergency',
        true,
        40.0,
        true,
        'TRADER',
        'active',
        true,
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Subcategories');
  }

  const isCsv = format === 'csv';
  const buffer = XLSX.write(wb, {
    type: 'buffer',
    bookType: isCsv ? 'csv' : 'xlsx',
  }) as Buffer;

  const filename = `sample-${entity}-template.${isCsv ? 'csv' : 'xlsx'}`;
  const mimeType = isCsv
    ? 'text/csv; charset=utf-8'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  return { buffer, filename, mimeType };
};
