import { prisma } from '../../../config/database';
import { NotFoundError, ConflictError, BadRequestError } from '../../../utils/errors';
import {
  CategoryQueryFilters,
  SubcategoryQueryFilters,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateSubcategoryInput,
  UpdateSubcategoryInput,
} from './admin-categories.types';
import { ActorType, Prisma } from '@prisma/client';
import { serializeCategory, serializeSubcategory } from '../../categories/categories.serializers';

// ==========================================
// CATEGORY MASTER SERVICES
// ==========================================

const CATEGORY_SORT_FIELDS: Record<string, string> = {
  name: 'name',
  categoryCode: 'categoryCode',
  displayOrder: 'displayOrder',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

const SUBCATEGORY_SORT_FIELDS: Record<string, string> = {
  name: 'name',
  code: 'code',
  urlSlug: 'urlSlug',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

export const listCategories = async (filters: CategoryQueryFilters) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.CategoryWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { categoryCode: { contains: search, mode: 'insensitive' } },
      { urlSlug: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.featured !== undefined) {
    where.featured = String(filters.featured) === 'true';
  }

  const sortField = CATEGORY_SORT_FIELDS[filters.sortBy ?? ''] ?? 'createdAt';
  const sortDir: 'asc' | 'desc' = filters.sortOrder === 'asc' ? 'asc' : 'desc';
  const orderBy = { [sortField]: sortDir } as Prisma.CategoryOrderByWithRelationInput;

  const [total, categories] = await Promise.all([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        _count: {
          select: {
            subcategories: true,
            traders: true,
            jobs: true,
          },
        },
      },
    }),
  ]);

  const formattedCategories = categories.map((cat) =>
    serializeCategory(cat, {
      subCategoriesCount: cat._count.subcategories,
      tradersCount: cat._count.traders,
      jobsCount: cat._count.jobs,
    })
  );

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    categories: formattedCategories,
  };
};

export const getCategoryById = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      subcategories: {
        orderBy: { name: 'asc' },
      },
      _count: {
        select: {
          traders: true,
          jobs: true,
          subcategories: true,
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

export const createCategory = async (adminId: string, adminLabel: string, input: CreateCategoryInput) => {
  const existingCode = await prisma.category.findUnique({
    where: { categoryCode: input.categoryCode },
  });
  if (existingCode) {
    throw new ConflictError('Category code already exists.');
  }

  const existingSlug = await prisma.category.findUnique({
    where: { urlSlug: input.urlSlug },
  });
  if (existingSlug) {
    throw new ConflictError('URL slug already exists.');
  }

  const category = await prisma.category.create({
    data: input,
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'CATEGORY_CREATED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'Category',
      subjectId: category.id,
      description: `Created Master Category: "${category.name}" (${category.categoryCode}).`,
    },
  });

  return serializeCategory(category);
};

export const updateCategory = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateCategoryInput
) => {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Category not found.');
  }

  if (input.categoryCode && input.categoryCode !== existing.categoryCode) {
    const codeConflict = await prisma.category.findUnique({ where: { categoryCode: input.categoryCode } });
    if (codeConflict) throw new ConflictError('Category code already in use.');
  }

  if (input.urlSlug && input.urlSlug !== existing.urlSlug) {
    const slugConflict = await prisma.category.findUnique({ where: { urlSlug: input.urlSlug } });
    if (slugConflict) throw new ConflictError('URL slug already in use.');
  }

  const updatedCategory = await prisma.category.update({
    where: { id },
    data: input,
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'CATEGORY_UPDATED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'Category',
      subjectId: id,
      description: `Updated Master Category: "${updatedCategory.name}".`,
    },
  });

  return serializeCategory(updatedCategory);
};

export const deleteCategory = async (adminId: string, adminLabel: string, id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          subcategories: true,
          jobs: true,
        },
      },
    },
  });

  if (!category) {
    throw new NotFoundError('Category not found.');
  }

  if (category._count.subcategories > 0) {
    throw new BadRequestError(`Cannot delete category: it has ${category._count.subcategories} dependent sub-categories.`);
  }

  if (category._count.jobs > 0) {
    throw new BadRequestError(`Cannot delete category: it has ${category._count.jobs} associated jobs.`);
  }

  await prisma.category.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      eventType: 'CATEGORY_DELETED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'Category',
      subjectId: id,
      description: `Deleted Master Category: "${category.name}".`,
    },
  });
};

// ==========================================
// SUB-CATEGORY MASTER SERVICES (Screenshot 4)
// ==========================================

export const listSubcategories = async (filters: SubcategoryQueryFilters) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.SubcategoryWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { urlSlug: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.featured !== undefined) {
    where.featured = String(filters.featured) === 'true';
  }

  const subSortField = SUBCATEGORY_SORT_FIELDS[filters.sortBy ?? ''] ?? 'createdAt';
  const subSortDir: 'asc' | 'desc' = filters.sortOrder === 'asc' ? 'asc' : 'desc';
  const subOrderBy = { [subSortField]: subSortDir } as Prisma.SubcategoryOrderByWithRelationInput;

  const [total, subcategories] = await Promise.all([
    prisma.subcategory.count({ where }),
    prisma.subcategory.findMany({
      where,
      skip,
      take: limit,
      orderBy: subOrderBy,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            categoryCode: true,
          },
        },
        _count: {
          select: {
            jobs: true,
          },
        },
      },
    }),
  ]);

  const formattedSubcategories = subcategories.map((sub, index) =>
    serializeSubcategory(sub, {
      rowNumber: skip + index + 1,
      parentCategory: {
        id: sub.category.id,
        name: sub.category.name,
        categoryCode: sub.category.categoryCode,
      },
      jobsCount: sub._count.jobs,
    })
  );

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    subcategories: formattedSubcategories,
  };
};

export const getSubcategoryById = async (id: string) => {
  const subcategory = await prisma.subcategory.findUnique({
    where: { id },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          categoryCode: true,
          urlSlug: true,
        },
      },
      _count: {
        select: {
          jobs: true,
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
    jobsCount: subcategory._count.jobs,
  });
};

export const createSubcategory = async (adminId: string, adminLabel: string, input: CreateSubcategoryInput) => {
  const categoryExists = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!categoryExists) {
    throw new NotFoundError('Parent Category not found.');
  }

  const { qaFormSchema, ...rest } = input;

  const subcategory = await prisma.subcategory.create({
    data: {
      ...rest,
      qaFormSchema: qaFormSchema === null ? Prisma.JsonNull : qaFormSchema ?? undefined,
    },
    include: {
      category: {
        select: { id: true, name: true, categoryCode: true },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'SUBCATEGORY_CREATED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'Subcategory',
      subjectId: subcategory.id,
      description: `Created Sub-Category: "${subcategory.name}" under "${subcategory.category.name}".`,
    },
  });

  return serializeSubcategory(subcategory, {
    parentCategory: {
      id: subcategory.category.id,
      name: subcategory.category.name,
      categoryCode: subcategory.category.categoryCode,
    },
  });
};

export const updateSubcategory = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateSubcategoryInput
) => {
  const existing = await prisma.subcategory.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Sub-category not found.');
  }

  if (input.categoryId && input.categoryId !== existing.categoryId) {
    const parentCategory = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!parentCategory) throw new NotFoundError('Parent Category not found.');
  }

  const { qaFormSchema, ...rest } = input;

  const updatedSubcategory = await prisma.subcategory.update({
    where: { id },
    data: {
      ...rest,
      ...(qaFormSchema !== undefined
        ? { qaFormSchema: qaFormSchema === null ? Prisma.JsonNull : qaFormSchema }
        : {}),
    },
    include: {
      category: { select: { id: true, name: true, categoryCode: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'SUBCATEGORY_UPDATED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'Subcategory',
      subjectId: id,
      description: `Updated Sub-Category: "${updatedSubcategory.name}".`,
    },
  });

  return serializeSubcategory(updatedSubcategory, {
    parentCategory: {
      id: updatedSubcategory.category.id,
      name: updatedSubcategory.category.name,
      categoryCode: updatedSubcategory.category.categoryCode,
    },
  });
};

// ==========================================
// DROPDOWN HELPERS (no pagination, alphabetic)
// ==========================================

export const listCategoriesDropdown = async () => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      categoryCode: true,
      status: true,
    },
  });
  return categories;
};

export const listSubcategoriesDropdown = async (categoryId?: string) => {
  const subcategories = await prisma.subcategory.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      categoryId: true,
      category: {
        select: { id: true, name: true, categoryCode: true },
      },
    },
  });
  return subcategories;
};

export const deleteSubcategory = async (adminId: string, adminLabel: string, id: string) => {
  const subcategory = await prisma.subcategory.findUnique({
    where: { id },
    include: {
      _count: {
        select: { jobs: true },
      },
    },
  });

  if (!subcategory) {
    throw new NotFoundError('Sub-category not found.');
  }

  if (subcategory._count.jobs > 0) {
    throw new BadRequestError(`Cannot delete sub-category: it has ${subcategory._count.jobs} associated jobs.`);
  }

  await prisma.subcategory.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      eventType: 'SUBCATEGORY_DELETED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'Subcategory',
      subjectId: id,
      description: `Deleted Sub-Category: "${subcategory.name}".`,
    },
  });
};
