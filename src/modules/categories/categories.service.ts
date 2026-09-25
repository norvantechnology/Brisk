import { DocumentRuleScope } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import {
  serializeCategory,
  serializeSubcategory,
  type CategoryDocumentsExtras,
  type CategoryDocumentsStatus,
} from './categories.serializers';

const ACTIVE = 'active';

export type AppCategoryFilters = {
  featured?: string;
  includeSubcategories?: string;
};

export type AppSubcategoryFilters = {
  categoryId?: string;
  featured?: string;
};

const naDocuments = (): CategoryDocumentsExtras => ({
  documentsStatus: 'N_A',
  documentsComplete: false,
  documentUpload: false,
  requiredDocumentsCount: 0,
  uploadedRequiredDocumentsCount: 0,
});

/**
 * Per-category required-document upload status for the logged-in trader.
 * ACTIVE = all required CATEGORY-scope docs uploaded (UI can show blue).
 */
export const buildTraderCategoryDocumentsMap = async (
  userId: string
): Promise<Map<string, CategoryDocumentsExtras>> => {
  const map = new Map<string, CategoryDocumentsExtras>();

  const trader = await prisma.trader.findUnique({
    where: { userId },
    select: {
      id: true,
      traderType: true,
      categories: { select: { categoryId: true } },
      documents: { select: { documentRuleId: true } },
    },
  });

  if (!trader) return map;

  const selectedCategoryIds = trader.categories.map((c) => c.categoryId);
  const uploadedRuleIds = new Set(trader.documents.map((d) => d.documentRuleId));

  // Status for every category that has rules — upload completeness is based on
  // files on disk, not whether the trade is currently selected. Selection only
  // affects Discover matching; it must not clear documentUpload for other trades.
  const rules = await prisma.documentRule.findMany({
    where: {
      scope: DocumentRuleScope.CATEGORY,
      status: ACTIVE,
      required: true,
      categoryId: { not: null },
      OR: [{ traderType: trader.traderType }, { traderType: null }],
    },
    select: { id: true, categoryId: true },
  });

  const byCategory = new Map<string, { requiredIds: string[] }>();

  for (const rule of rules) {
    if (!rule.categoryId) continue;
    const row = byCategory.get(rule.categoryId) ?? { requiredIds: [] };
    row.requiredIds.push(rule.id);
    byCategory.set(rule.categoryId, row);
  }

  for (const [categoryId, row] of byCategory) {
    const requiredDocumentsCount = row.requiredIds.length;
    const uploadedRequiredDocumentsCount = row.requiredIds.filter((id) =>
      uploadedRuleIds.has(id)
    ).length;
    const hasAnyUpload = row.requiredIds.some((id) => uploadedRuleIds.has(id));
    const isSelected = selectedCategoryIds.includes(categoryId);

    // Unselected + no uploads → N_A (not relevant). Otherwise show real status.
    if (!isSelected && !hasAnyUpload) {
      continue;
    }

    const complete =
      requiredDocumentsCount > 0 && uploadedRequiredDocumentsCount >= requiredDocumentsCount;
    const documentsStatus: CategoryDocumentsStatus =
      requiredDocumentsCount === 0 ? 'N_A' : complete ? 'ACTIVE' : 'PENDING';

    map.set(categoryId, {
      documentsStatus,
      documentsComplete: complete,
      documentUpload: complete,
      requiredDocumentsCount,
      uploadedRequiredDocumentsCount,
    });
  }

  return map;
};

const docsFor = (
  categoryId: string,
  docsMap?: Map<string, CategoryDocumentsExtras>
): CategoryDocumentsExtras => {
  if (!docsMap) return naDocuments();
  return docsMap.get(categoryId) ?? naDocuments();
};

/**
 * Mobile / Customer / Trader — active categories only.
 * When traderUserId is set, each category includes documentsStatus (ACTIVE/PENDING/N_A).
 */
export const listActiveCategories = async (
  filters: AppCategoryFilters = {},
  options?: { traderUserId?: string | null }
) => {
  const includeSubs =
    filters.includeSubcategories === 'true' || filters.includeSubcategories === '1';

  const where: { status: string; featured?: boolean } = { status: ACTIVE };
  if (filters.featured === 'true') where.featured = true;
  if (filters.featured === 'false') where.featured = false;

  const docsMap = options?.traderUserId
    ? await buildTraderCategoryDocumentsMap(options.traderUserId)
    : undefined;

  if (includeSubs) {
    const categories = await prisma.category.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        subcategories: {
          where: { status: ACTIVE },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            subcategories: { where: { status: ACTIVE } },
            traders: true,
            jobs: true,
          },
        },
      },
    });

    return categories.map((cat) =>
      serializeCategory(cat, {
        subCategoriesCount: cat._count.subcategories,
        tradersCount: cat._count.traders,
        jobsCount: cat._count.jobs,
        documents: docsFor(cat.id, docsMap),
        subcategories: cat.subcategories.map((sub) =>
          serializeSubcategory(sub, {
            parentCategory: {
              id: cat.id,
              name: cat.name,
              categoryCode: cat.categoryCode,
            },
          })
        ),
      })
    );
  }

  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          subcategories: { where: { status: ACTIVE } },
          traders: true,
          jobs: true,
        },
      },
    },
  });

  return categories.map((cat) =>
    serializeCategory(cat, {
      subCategoriesCount: cat._count.subcategories,
      tradersCount: cat._count.traders,
      jobsCount: cat._count.jobs,
      documents: docsFor(cat.id, docsMap),
    })
  );
};

export const getActiveCategoryById = async (
  id: string,
  options?: { traderUserId?: string | null }
) => {
  const category = await prisma.category.findFirst({
    where: { id, status: ACTIVE },
    include: {
      subcategories: {
        where: { status: ACTIVE },
        orderBy: { name: 'asc' },
      },
      _count: {
        select: {
          subcategories: { where: { status: ACTIVE } },
          traders: true,
          jobs: true,
        },
      },
    },
  });

  if (!category) {
    throw new NotFoundError('Category not found.');
  }

  const docsMap = options?.traderUserId
    ? await buildTraderCategoryDocumentsMap(options.traderUserId)
    : undefined;

  return serializeCategory(category, {
    subCategoriesCount: category._count.subcategories,
    tradersCount: category._count.traders,
    jobsCount: category._count.jobs,
    documents: docsFor(category.id, docsMap),
    subcategories: category.subcategories.map((sub) =>
      serializeSubcategory(sub, {
        parentCategory: {
          id: category.id,
          name: category.name,
          categoryCode: category.categoryCode,
        },
      })
    ),
  });
};

export const getActiveCategoryBySlug = async (
  slug: string,
  options?: { traderUserId?: string | null }
) => {
  const category = await prisma.category.findFirst({
    where: { urlSlug: slug, status: ACTIVE },
    include: {
      subcategories: {
        where: { status: ACTIVE },
        orderBy: { name: 'asc' },
      },
      _count: {
        select: {
          subcategories: { where: { status: ACTIVE } },
          traders: true,
          jobs: true,
        },
      },
    },
  });

  if (!category) {
    throw new NotFoundError('Category not found.');
  }

  const docsMap = options?.traderUserId
    ? await buildTraderCategoryDocumentsMap(options.traderUserId)
    : undefined;

  return serializeCategory(category, {
    subCategoriesCount: category._count.subcategories,
    tradersCount: category._count.traders,
    jobsCount: category._count.jobs,
    documents: docsFor(category.id, docsMap),
    subcategories: category.subcategories.map((sub) =>
      serializeSubcategory(sub, {
        parentCategory: {
          id: category.id,
          name: category.name,
          categoryCode: category.categoryCode,
        },
      })
    ),
  });
};

export const listActiveSubcategories = async (filters: AppSubcategoryFilters = {}) => {
  const where: {
    status: string;
    categoryId?: string;
    featured?: boolean;
    category: { status: string };
  } = {
    status: ACTIVE,
    category: { status: ACTIVE },
  };

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }
  if (filters.featured === 'true') where.featured = true;
  if (filters.featured === 'false') where.featured = false;

  const subcategories = await prisma.subcategory.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      category: {
        select: { id: true, name: true, categoryCode: true },
      },
    },
  });

  return subcategories.map((sub) =>
    serializeSubcategory(sub, {
      parentCategory: {
        id: sub.category.id,
        name: sub.category.name,
        categoryCode: sub.category.categoryCode,
      },
    })
  );
};

export const getActiveSubcategoryById = async (id: string) => {
  const subcategory = await prisma.subcategory.findFirst({
    where: {
      id,
      status: ACTIVE,
      category: { status: ACTIVE },
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          categoryCode: true,
          urlSlug: true,
          iconName: true,
        },
      },
    },
  });

  if (!subcategory) {
    throw new NotFoundError('Sub-category not found.');
  }

  return serializeSubcategory(subcategory, {
    parentCategory: {
      id: subcategory.category.id,
      name: subcategory.category.name,
      categoryCode: subcategory.category.categoryCode,
    },
  });
};
