import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { buildPaginationMeta, parsePageLimit, PaginatedResult } from '../../utils/pagination';
import { serializeCategory, serializeSubcategory } from './categories.serializers';

const ACTIVE = 'active';

export type AppCategoryFilters = {
  featured?: string;
  includeSubcategories?: string;
  page?: string;
  limit?: string;
};

export type AppSubcategoryFilters = {
  categoryId?: string;
  featured?: string;
  page?: string;
  limit?: string;
};

/**
 * Mobile / Customer / Trader — active categories only.
 * Nested subcategories include siteVisit / price / qaFormSchema when requested.
 */
export const listActiveCategories = async (
  filters: AppCategoryFilters = {}
): Promise<PaginatedResult<ReturnType<typeof serializeCategory>>> => {
  const includeSubs =
    filters.includeSubcategories === 'true' || filters.includeSubcategories === '1';
  const { page, limit, skip } = parsePageLimit(filters, { defaultLimit: 20, maxLimit: 100 });

  const where: { status: string; featured?: boolean } = { status: ACTIVE };
  if (filters.featured === 'true') where.featured = true;
  if (filters.featured === 'false') where.featured = false;

  if (includeSubs) {
    const [total, categories] = await Promise.all([
      prisma.category.count({ where }),
      prisma.category.findMany({
        where,
        skip,
        take: limit,
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
      }),
    ]);

    return {
      items: categories.map((cat) =>
        serializeCategory(cat, {
          subCategoriesCount: cat._count.subcategories,
          tradersCount: cat._count.traders,
          jobsCount: cat._count.jobs,
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
      ),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  const [total, categories] = await Promise.all([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      skip,
      take: limit,
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
    }),
  ]);

  return {
    items: categories.map((cat) =>
      serializeCategory(cat, {
        subCategoriesCount: cat._count.subcategories,
        tradersCount: cat._count.traders,
        jobsCount: cat._count.jobs,
      })
    ),
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const getActiveCategoryById = async (id: string) => {
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

  return serializeCategory(category, {
    subCategoriesCount: category._count.subcategories,
    tradersCount: category._count.traders,
    jobsCount: category._count.jobs,
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

export const getActiveCategoryBySlug = async (slug: string) => {
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

  return serializeCategory(category, {
    subCategoriesCount: category._count.subcategories,
    tradersCount: category._count.traders,
    jobsCount: category._count.jobs,
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

export const listActiveSubcategories = async (
  filters: AppSubcategoryFilters = {}
): Promise<PaginatedResult<ReturnType<typeof serializeSubcategory>>> => {
  const { page, limit, skip } = parsePageLimit(filters, { defaultLimit: 20, maxLimit: 100 });

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

  const [total, subcategories] = await Promise.all([
    prisma.subcategory.count({ where }),
    prisma.subcategory.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        category: {
          select: { id: true, name: true, categoryCode: true },
        },
      },
    }),
  ]);

  return {
    items: subcategories.map((sub) =>
      serializeSubcategory(sub, {
        parentCategory: {
          id: sub.category.id,
          name: sub.category.name,
          categoryCode: sub.category.categoryCode,
        },
      })
    ),
    meta: buildPaginationMeta(total, page, limit),
  };
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
