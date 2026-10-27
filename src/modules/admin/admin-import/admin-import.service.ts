import * as XLSX from 'xlsx';
import { SubcategoryPriceEnteredBy, DocumentRuleScope, TraderType } from '@prisma/client';
import { prisma } from '../../../config/database';
import { ImportMode, ImportResult, RowError, SkippedRow } from './admin-import.types';
import { BadRequestError } from '../../../utils/errors';
import { getBaseCurrencyCode, invalidateRateCache } from '../../../services/currency.service';

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
 * Bulk import Document Rules (for SOLO/COMPANY traders or Categories).
 */
export const importDocumentRules = async (
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

    const documentKey = String(row['documentkey'] || row['key'] || '').trim();
    const name = String(row['name'] || row['documentname'] || row['title'] || '').trim();

    if (!documentKey) {
      errors.push({
        row: rowNum,
        field: 'documentKey',
        message: 'Document key is required.',
      });
      continue;
    }

    if (!name) {
      errors.push({
        row: rowNum,
        field: 'name',
        message: 'Document rule name is required.',
      });
      continue;
    }

    const rawScope = String(row['scope'] || '').trim().toUpperCase();
    const rawTraderType = String(row['tradertype'] || row['type'] || '').trim().toUpperCase();
    const categoryRef = String(
      row['categorycode'] || row['categoryname'] || row['categoryid'] || row['category'] || ''
    ).trim();

    let scope: DocumentRuleScope;
    let traderType: TraderType | null = null;
    let categoryId: string | null = null;

    if (rawScope === 'CATEGORY' || (categoryRef && !rawTraderType)) {
      scope = DocumentRuleScope.CATEGORY;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryRef);
      const cat = await prisma.category.findFirst({
        where: isUuid
          ? { OR: [{ id: categoryRef }, { categoryCode: categoryRef }, { urlSlug: slugify(categoryRef) }] }
          : {
              OR: [
                { categoryCode: categoryRef },
                { urlSlug: slugify(categoryRef) },
                { name: { equals: categoryRef, mode: 'insensitive' } },
              ],
            },
      });

      if (!cat) {
        errors.push({
          row: rowNum,
          field: 'categoryCode',
          message: `Category not found for identifier "${categoryRef}".`,
        });
        continue;
      }
      categoryId = cat.id;
    } else {
      scope = DocumentRuleScope.ENTITY;
      if (rawTraderType === 'COMPANY') {
        traderType = TraderType.COMPANY;
      } else {
        traderType = TraderType.SOLO;
      }
    }

    const description = row['description'] ? String(row['description']).trim() : null;
    const required = toBoolean(row['required'], true);
    const acceptedFormats = String(row['acceptedformats'] || row['formats'] || 'pdf,image').trim();
    const sortOrder = row['sortorder'] || row['order'] ? Number(row['sortorder'] || row['order']) || 0 : 0;
    const rawStatus = String(row['status'] || 'active').trim().toLowerCase();
    const status = rawStatus === 'inactive' ? 'inactive' : 'active';

    const existing = await prisma.documentRule.findFirst({
      where: {
        scope,
        traderType,
        categoryId,
        documentKey,
      },
    });

    if (existing) {
      if (mode === 'skip') {
        skipped.push({
          row: rowNum,
          identifier: documentKey,
          reason: `Document rule with key "${documentKey}" already exists for ${scope}${
            traderType ? ` (${traderType})` : ''
          } (mode=skip).`,
        });
        continue;
      }

      const updatedItem = await prisma.documentRule.update({
        where: { id: existing.id },
        data: {
          name,
          description,
          required,
          acceptedFormats,
          sortOrder,
          status,
        },
      });
      updated.push(updatedItem);
    } else {
      const createdItem = await prisma.documentRule.create({
        data: {
          scope,
          traderType,
          categoryId,
          documentKey,
          name,
          description,
          required,
          acceptedFormats,
          sortOrder,
          status,
        },
      });
      imported.push(createdItem);
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
 * Bulk import Locations (Countries & Counties).
 */
export const importLocations = async (
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

    const countryCode = String(row['countrycode'] || row['code'] || '').trim().toUpperCase();
    const countryName = String(row['countryname'] || row['country'] || '').trim();
    const countyName = String(row['countyname'] || row['county'] || '').trim();
    const countyCode = row['countycode'] ? String(row['countycode']).trim().toUpperCase() : null;

    if (!countryCode && !countryName) {
      errors.push({
        row: rowNum,
        field: 'countryCode',
        message: 'Country code or Country name is required.',
      });
      continue;
    }

    const isActive = toBoolean(row['isactive'] ?? row['active'] ?? row['status'], true);
    const sortOrder = row['sortorder'] || row['order'] ? Number(row['sortorder'] || row['order']) || 0 : 0;

    let country = await prisma.country.findFirst({
      where: countryCode
        ? {
            OR: [
              { code: countryCode },
              { name: { equals: countryName || countryCode, mode: 'insensitive' } },
            ],
          }
        : { name: { equals: countryName, mode: 'insensitive' } },
    });

    if (!country) {
      country = await prisma.country.create({
        data: {
          code: countryCode || countryName.slice(0, 2).toUpperCase(),
          name: countryName || countryCode,
          isActive,
          sortOrder,
        },
      });
      if (!countyName) {
        imported.push(country);
        continue;
      }
    } else if (!countyName) {
      if (mode === 'skip') {
        skipped.push({
          row: rowNum,
          identifier: country.code,
          reason: `Country with code "${country.code}" already exists (mode=skip).`,
        });
      } else {
        const updatedCountry = await prisma.country.update({
          where: { id: country.id },
          data: {
            name: countryName || country.name,
            isActive,
            sortOrder,
          },
        });
        updated.push(updatedCountry);
      }
      continue;
    }

    const existingCounty = await prisma.county.findFirst({
      where: {
        countryId: country.id,
        OR: [
          { name: { equals: countyName, mode: 'insensitive' } },
          ...(countyCode ? [{ code: countyCode }] : []),
        ],
      },
    });

    if (existingCounty) {
      if (mode === 'skip') {
        skipped.push({
          row: rowNum,
          identifier: `${country.code} / ${countyName}`,
          reason: `County "${countyName}" already exists under country "${country.code}" (mode=skip).`,
        });
        continue;
      }

      const updatedCounty = await prisma.county.update({
        where: { id: existingCounty.id },
        data: {
          name: countyName,
          code: countyCode || existingCounty.code,
          isActive,
          sortOrder,
        },
      });
      updated.push(updatedCounty);
    } else {
      const createdCounty = await prisma.county.create({
        data: {
          countryId: country.id,
          name: countyName,
          code: countyCode || null,
          isActive,
          sortOrder,
        },
      });
      imported.push(createdCounty);
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
 * Bulk import Currencies from parsed spreadsheet rows.
 */
export const importCurrencies = async (
  rows: Record<string, unknown>[],
  mode: ImportMode = 'skip'
): Promise<ImportResult> => {
  const imported: unknown[] = [];
  const updated: unknown[] = [];
  const skipped: SkippedRow[] = [];
  const errors: RowError[] = [];

  const baseCurrency = await getBaseCurrencyCode().catch(() => 'EUR');

  let rowNum = 1;
  for (const raw of rows) {
    rowNum++;
    const row = normalizeRow(raw);

    const code = String(row['code'] || row['currencycode'] || '').trim().toUpperCase();
    const name = String(row['name'] || row['currencyname'] || '').trim();
    const symbol = String(row['symbol'] || row['currencysymbol'] || '').trim();

    if (!code || code.length !== 3) {
      errors.push({
        row: rowNum,
        field: 'code',
        identifier: code || undefined,
        message: 'Valid 3-letter currency code is required (e.g. EUR, USD, GBP, INR).',
      });
      continue;
    }

    if (!name) {
      errors.push({
        row: rowNum,
        field: 'name',
        identifier: code,
        message: 'Currency name is required (e.g. Euro, US Dollar).',
      });
      continue;
    }

    if (!symbol) {
      errors.push({
        row: rowNum,
        field: 'symbol',
        identifier: code,
        message: 'Currency symbol is required (e.g. €, $, £, ₹).',
      });
      continue;
    }

    const rawDecimals = row['decimalplaces'] ?? row['decimals'] ?? row['decimal'];
    let decimalPlaces = 2;
    if (rawDecimals !== undefined && rawDecimals !== null && rawDecimals !== '') {
      const parsed = Number(rawDecimals);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 4) {
        decimalPlaces = parsed;
      }
    }

    const isActive = toBoolean(row['isactive'] ?? row['active'] ?? row['status'], true);
    const sortOrder = row['sortorder'] || row['order'] ? Number(row['sortorder'] || row['order']) || 0 : 0;

    const existing = await prisma.currency.findUnique({ where: { code } });

    if (existing) {
      if (mode === 'skip') {
        skipped.push({
          row: rowNum,
          identifier: code,
          reason: `Currency with code "${code}" already exists (mode=skip).`,
        });
        continue;
      }

      // mode === 'upsert'
      // If updating platform base currency, do not allow deactivating it
      const finalIsActive = code === baseCurrency && !isActive ? true : isActive;

      const updatedCurrency = await prisma.currency.update({
        where: { code },
        data: {
          name,
          symbol,
          decimalPlaces,
          isActive: finalIsActive,
          sortOrder,
        },
      });
      updated.push(updatedCurrency);
    } else {
      const createdCurrency = await prisma.currency.create({
        data: {
          code,
          name,
          symbol,
          decimalPlaces,
          isActive,
          sortOrder,
        },
      });
      imported.push(createdCurrency);
    }
  }

  if (imported.length > 0 || updated.length > 0) {
    invalidateRateCache();
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
  entity: 'categories' | 'subcategories' | 'document-rules' | 'locations' | 'currencies',
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
  } else if (entity === 'subcategories') {
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
  } else if (entity === 'document-rules') {
    const headers = [
      'scope',
      'traderType',
      'categoryCode',
      'documentKey',
      'name',
      'description',
      'required',
      'acceptedFormats',
      'sortOrder',
      'status',
    ];
    const sampleRows = [
      [
        'ENTITY',
        'SOLO',
        '',
        'driving_license',
        'Driving License',
        'Clear photo of front and back of driving license',
        true,
        'pdf,image',
        1,
        'active',
      ],
      [
        'ENTITY',
        'COMPANY',
        '',
        'certificate_of_incorporation',
        'Certificate of Incorporation',
        'Official CRO company registration document',
        true,
        'pdf,image',
        1,
        'active',
      ],
      [
        'ENTITY',
        'SOLO',
        '',
        'public_liability_insurance',
        'Public Liability Insurance',
        'Minimum €2.6m cover with Brisk indemnified',
        true,
        'pdf,image',
        2,
        'active',
      ],
      [
        'CATEGORY',
        '',
        'CAT-0010',
        'safe_pass',
        'Safe Pass Card',
        'Valid SOLAS Safe Pass registration',
        true,
        'pdf,image',
        1,
        'active',
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    XLSX.utils.book_append_sheet(wb, ws, 'DocumentRules');
  } else if (entity === 'currencies') {
    const headers = [
      'code',
      'name',
      'symbol',
      'decimalPlaces',
      'isActive',
      'sortOrder',
    ];
    const sampleRows = [
      ['EUR', 'Euro', '€', 2, true, 1],
      ['GBP', 'British Pound', '£', 2, true, 2],
      ['USD', 'US Dollar', '$', 2, true, 3],
      ['INR', 'Indian Rupee', '₹', 2, true, 4],
      ['AED', 'United Arab Emirates Dirham', 'د.إ', 2, true, 5],
      ['CAD', 'Canadian Dollar', '$', 2, true, 6],
      ['AUD', 'Australian Dollar', '$', 2, true, 7],
      ['JPY', 'Japanese Yen', '¥', 0, true, 8],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Currencies');
  } else {
    const headers = [
      'countryCode',
      'countryName',
      'countyName',
      'countyCode',
      'isActive',
      'sortOrder',
    ];
    const sampleRows = [
      ['IE', 'Ireland', 'Dublin', 'DB', true, 1],
      ['IE', 'Ireland', 'Cork', 'CK', true, 2],
      ['IE', 'Ireland', 'Galway', 'GW', true, 3],
      ['IE', 'Ireland', 'Limerick', 'LK', true, 4],
      ['GB', 'United Kingdom', 'Greater London', 'LDN', true, 1],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Locations');
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
