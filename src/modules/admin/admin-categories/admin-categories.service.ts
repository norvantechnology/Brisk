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

// ==========================================
// CATEGORY MASTER SERVICES
// ==========================================

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

  const [total, categories] = await Promise.all([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      skip,
      take: limit,
      orderBy: { displayOrder: 'asc' },
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

  const formattedCategories = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    categoryCode: cat.categoryCode,
    urlSlug: cat.urlSlug,
    description: cat.description,
    iconName: cat.iconName,
    brandThemeColor: cat.brandThemeColor,
    bannerImageUrl: cat.bannerImageUrl,
    displayOrder: cat.displayOrder,
    status: cat.status,
    featured: cat.featured,
    subCategoriesCount: cat._count.subcategories,
    tradersCount: cat._count.traders,
    jobsCount: cat._count.jobs,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
  }));

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
        },
      },
    },
  });

  if (!category) {
    throw new NotFoundError('Category not found.');
  }

  return category;
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

  return category;
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

  return updatedCategory;
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

  const [total, subcategories] = await Promise.all([
    prisma.subcategory.count({ where }),
    prisma.subcategory.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
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

  const formattedSubcategories = await Promise.all(
    subcategories.map(async (sub, index) => {
      // Calculate trader count linked to category
      const tradersCount = await prisma.trader.count({
        where: { categoryId: sub.categoryId },
      });

      return {
        rowNumber: skip + index + 1,
        id: sub.id,
        name: sub.name,
        code: sub.code,
        urlSlug: sub.urlSlug,
        serviceType: sub.serviceType,
        parentCategory: {
          id: sub.category.id,
          name: sub.category.name,
          categoryCode: sub.category.categoryCode,
        },
        tradersCount,
        jobsCount: sub._count.jobs,
        featured: sub.featured,
        status: sub.status,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      };
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
      category: true,
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

  return subcategory;
};

export const createSubcategory = async (adminId: string, adminLabel: string, input: CreateSubcategoryInput) => {
  const categoryExists = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!categoryExists) {
    throw new NotFoundError('Parent Category not found.');
  }

  const subcategory = await prisma.subcategory.create({
    data: input,
    include: {
      category: {
        select: { name: true },
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

  return subcategory;
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

  const updatedSubcategory = await prisma.subcategory.update({
    where: { id },
    data: input,
    include: {
      category: { select: { name: true } },
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

  return updatedSubcategory;
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
