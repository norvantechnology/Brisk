import { prisma } from '../../../config/database';
import { NotFoundError, ConflictError, BadRequestError } from '../../../utils/errors';
import {
  CreatePropertySupplierCategoryInput,
  UpdatePropertySupplierCategoryInput,
  CreatePropertySupplierInput,
  UpdatePropertySupplierInput,
  ListPropertySuppliersQuery,
  CountyCoverageOverviewItem,
} from './admin-property-suppliers.types';
import {
  syncSingleSupplierToUtilityProviders,
  deactivateSupplierInUtilityProviders,
} from '../../property/property-supplier-sync.service';

const db = prisma as any;

export const toSlug = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const toCode = (text: string): string =>
  text
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const ensureUniqueSupplierSlug = async (slug: string, excludeId?: string): Promise<string> => {
  let candidate = slug;
  let counter = 1;
  while (true) {
    const existing = await db.propertySupplier.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) {
      return candidate;
    }
    candidate = `${slug}-${counter}`;
    counter++;
  }
};

const ensureUniqueCategorySlug = async (slug: string, excludeId?: string): Promise<string> => {
  let candidate = slug;
  let counter = 1;
  while (true) {
    const existing = await db.propertySupplierCategory.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) {
      return candidate;
    }
    candidate = `${slug}-${counter}`;
    counter++;
  }
};

// ============================================================================
// CATEGORIES
// ============================================================================

export const listCategories = async (query: {
  search?: string;
  status?: 'active' | 'inactive';
  sortBy?: 'displayOrder' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}) => {
  const where: any = {};

  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (query.status === 'active') {
    where.isActive = true;
  } else if (query.status === 'inactive') {
    where.isActive = false;
  }

  const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
  let orderBy: any[];

  switch (query.sortBy) {
    case 'name':
      orderBy = [{ name: sortOrder }, { displayOrder: 'asc' }];
      break;
    case 'createdAt':
      orderBy = [{ createdAt: sortOrder }];
      break;
    case 'displayOrder':
    default:
      orderBy = [{ displayOrder: sortOrder }, { name: 'asc' }];
      break;
  }

  const [categories, total] = await Promise.all([
    db.propertySupplierCategory.findMany({
      where,
      orderBy,
      include: {
        _count: {
          select: { suppliers: true },
        },
      },
    }),
    db.propertySupplierCategory.count({ where }),
  ]);

  return {
    meta: {
      total,
    },
    categories: (categories as any[]).map((cat) => ({
      id: cat.id,
      name: cat.name,
      code: cat.code,
      slug: cat.slug,
      description: cat.description,
      iconUrl: cat.iconUrl,
      displayOrder: cat.displayOrder,
      isActive: cat.isActive,
      suppliersCount: cat._count?.suppliers ?? 0,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    })),
  };
};

export const getCategoryById = async (id: string) => {
  const category = await db.propertySupplierCategory.findUnique({
    where: { id },
    include: {
      _count: {
        select: { suppliers: true },
      },
      suppliers: {
        take: 10,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          tradingName: true,
          logoUrl: true,
          iconUrl: true,
          isActive: true,
        },
      },
    },
  });

  if (!category) {
    throw new NotFoundError('Property supplier category not found.');
  }

  return {
    ...category,
    suppliersCount: category._count?.suppliers ?? 0,
  };
};

export const createCategory = async (input: CreatePropertySupplierCategoryInput) => {
  const code = input.code?.trim() ? toCode(input.code) : toCode(input.name);
  const baseSlug = input.slug?.trim() ? toSlug(input.slug) : toSlug(input.name);
  const slug = await ensureUniqueCategorySlug(baseSlug);

  const existingCode = await db.propertySupplierCategory.findUnique({
    where: { code },
  });
  if (existingCode) {
    throw new ConflictError(`Category code '${code}' already exists.`);
  }

  const category = await db.propertySupplierCategory.create({
    data: {
      name: input.name.trim(),
      code,
      slug,
      description: input.description?.trim() || null,
      iconUrl: input.iconUrl?.trim() || null,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });

  return category;
};

export const updateCategory = async (id: string, input: UpdatePropertySupplierCategoryInput) => {
  const category = await db.propertySupplierCategory.findUnique({
    where: { id },
  });
  if (!category) {
    throw new NotFoundError('Property supplier category not found.');
  }

  const data: any = {};

  if (input.name !== undefined) {
    data.name = input.name.trim();
  }

  if (input.code !== undefined) {
    const code = toCode(input.code);
    if (code !== category.code) {
      const existingCode = await db.propertySupplierCategory.findUnique({
        where: { code },
      });
      if (existingCode) {
        throw new ConflictError(`Category code '${code}' already exists.`);
      }
      data.code = code;
    }
  }

  if (input.slug !== undefined) {
    const baseSlug = toSlug(input.slug);
    if (baseSlug !== category.slug) {
      data.slug = await ensureUniqueCategorySlug(baseSlug, id);
    }
  }

  if (input.description !== undefined) {
    data.description = input.description ? input.description.trim() : null;
  }
  if (input.iconUrl !== undefined) {
    data.iconUrl = input.iconUrl ? input.iconUrl.trim() : null;
  }
  if (input.displayOrder !== undefined) {
    data.displayOrder = input.displayOrder;
  }
  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  return db.propertySupplierCategory.update({
    where: { id },
    data,
  });
};

export const deleteCategory = async (id: string) => {
  const category = await db.propertySupplierCategory.findUnique({
    where: { id },
    include: {
      _count: {
        select: { suppliers: true },
      },
    },
  });

  if (!category) {
    throw new NotFoundError('Property supplier category not found.');
  }

  if (category._count?.suppliers > 0) {
    throw new BadRequestError(
      `Cannot delete category '${category.name}' because it contains ${category._count.suppliers} supplier(s). Please delete or reassign them first.`
    );
  }

  await db.propertySupplierCategory.delete({
    where: { id },
  });

  return { message: 'Category deleted successfully.' };
};

// ============================================================================
// SUPPLIERS
// ============================================================================

export const listSuppliers = async (query: ListPropertySuppliersQuery) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { tradingName: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { typicalService: { contains: search, mode: 'insensitive' } },
      { coverageSummary: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.categorySlug) {
    where.category = { slug: query.categorySlug };
  }

  if (query.categoryCode) {
    where.category = { code: query.categoryCode.toUpperCase() };
  }

  if (query.parentId) {
    where.parentId = query.parentId;
  }

  if (query.status === 'active') {
    where.isActive = true;
  } else if (query.status === 'inactive') {
    where.isActive = false;
  }

  if (query.providesElectricity !== undefined) {
    const val = query.providesElectricity === true || query.providesElectricity === 'true' || query.providesElectricity === '1';
    where.providesElectricity = val;
  }

  if (query.providesGas !== undefined) {
    const val = query.providesGas === true || query.providesGas === 'true' || query.providesGas === '1';
    where.providesGas = val;
  }

  if (query.county?.trim()) {
    const county = query.county.trim();
    where.countyCoverages = {
      some: {
        county: {
          equals: county,
          mode: 'insensitive',
        },
      },
    };
  }

  const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
  let orderBy: any[];

  switch (query.sortBy) {
    case 'name':
      orderBy = [{ name: sortOrder }, { displayOrder: 'asc' }];
      break;
    case 'createdAt':
      orderBy = [{ createdAt: sortOrder }];
      break;
    case 'updatedAt':
      orderBy = [{ updatedAt: sortOrder }];
      break;
    case 'displayOrder':
    default:
      orderBy = [{ displayOrder: sortOrder }, { name: 'asc' }];
      break;
  }

  const [suppliers, total] = await Promise.all([
    db.propertySupplier.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            code: true,
            slug: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            tradingName: true,
          },
        },
        countyCoverages: {
          orderBy: { county: 'asc' },
          select: {
            county: true,
            isDomesticCollector: true,
          },
        },
      },
    }),
    db.propertySupplier.count({ where }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    suppliers: (suppliers as any[]).map((s) => ({
      ...s,
      counties: (s.countyCoverages || []).map((c: any) => c.county),
    })),
  };
};

export const getSupplierById = async (id: string) => {
  const supplier = await db.propertySupplier.findUnique({
    where: { id },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          code: true,
          slug: true,
          iconUrl: true,
        },
      },
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
          tradingName: true,
          logoUrl: true,
        },
      },
      children: {
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          tradingName: true,
          logoUrl: true,
          typicalService: true,
          isActive: true,
        },
      },
      countyCoverages: {
        orderBy: { county: 'asc' },
        select: {
          county: true,
          isDomesticCollector: true,
        },
      },
    },
  });

  if (!supplier) {
    throw new NotFoundError('Property supplier not found.');
  }

  return {
    ...supplier,
    counties: (supplier.countyCoverages || []).map((c: any) => c.county),
  };
};

export const createSupplier = async (input: CreatePropertySupplierInput) => {
  const category = await db.propertySupplierCategory.findUnique({
    where: { id: input.categoryId },
  });
  if (!category) {
    throw new NotFoundError(`Category with ID '${input.categoryId}' does not exist.`);
  }

  if (input.parentId) {
    const parent = await db.propertySupplier.findUnique({
      where: { id: input.parentId },
    });
    if (!parent) {
      throw new NotFoundError(`Parent supplier with ID '${input.parentId}' does not exist.`);
    }
  }

  const baseSlug = input.slug?.trim() ? toSlug(input.slug) : toSlug(input.name);
  const slug = await ensureUniqueSupplierSlug(baseSlug);

  const supplier = await db.propertySupplier.create({
    data: {
      categoryId: input.categoryId,
      parentId: input.parentId || null,
      name: input.name.trim(),
      slug,
      tradingName: input.tradingName?.trim() || null,
      logoUrl: input.logoUrl?.trim() || null,
      iconUrl: input.iconUrl?.trim() || null,
      websiteUrl: input.websiteUrl?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      description: input.description?.trim() || null,
      typicalService: input.typicalService?.trim() || null,
      coverageSummary: input.coverageSummary?.trim() || null,
      providesElectricity: Boolean(input.providesElectricity),
      providesGas: Boolean(input.providesGas),
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
      metadata: input.metadata ?? null,
      countyCoverages: input.counties?.length
        ? {
            create: input.counties.map((c) => ({
              county: c.trim(),
              isDomesticCollector: true,
            })),
          }
        : undefined,
    },
    include: {
      category: {
        select: { id: true, name: true, code: true, slug: true },
      },
      parent: {
        select: { id: true, name: true, slug: true },
      },
      countyCoverages: {
        select: { county: true, isDomesticCollector: true },
      },
    },
  });

  // Automatically sync newly created supplier to utility providers
  await syncSingleSupplierToUtilityProviders(supplier.id).catch(() => {});

  return {
    ...supplier,
    counties: (supplier.countyCoverages || []).map((c: any) => c.county),
  };
};

export const updateSupplier = async (id: string, input: UpdatePropertySupplierInput) => {
  const supplier = await db.propertySupplier.findUnique({
    where: { id },
  });
  if (!supplier) {
    throw new NotFoundError('Property supplier not found.');
  }

  if (input.categoryId && input.categoryId !== supplier.categoryId) {
    const category = await db.propertySupplierCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) {
      throw new NotFoundError(`Category with ID '${input.categoryId}' does not exist.`);
    }
  }

  if (input.parentId !== undefined) {
    if (input.parentId === id) {
      throw new BadRequestError('A supplier cannot be its own parent.');
    }
    if (input.parentId) {
      const parent = await db.propertySupplier.findUnique({
        where: { id: input.parentId },
      });
      if (!parent) {
        throw new NotFoundError(`Parent supplier with ID '${input.parentId}' does not exist.`);
      }
    }
  }

  let slug = supplier.slug;
  if (input.slug !== undefined) {
    const baseSlug = toSlug(input.slug);
    if (baseSlug !== supplier.slug) {
      slug = await ensureUniqueSupplierSlug(baseSlug, id);
    }
  }

  const data: any = {
    slug,
  };

  if (input.categoryId !== undefined) data.category = { connect: { id: input.categoryId } };
  if (input.parentId !== undefined) {
    data.parent = input.parentId ? { connect: { id: input.parentId } } : { disconnect: true };
  }
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.tradingName !== undefined) data.tradingName = input.tradingName ? input.tradingName.trim() : null;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl ? input.logoUrl.trim() : null;
  if (input.iconUrl !== undefined) data.iconUrl = input.iconUrl ? input.iconUrl.trim() : null;
  if (input.websiteUrl !== undefined) data.websiteUrl = input.websiteUrl ? input.websiteUrl.trim() : null;
  if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone ? input.contactPhone.trim() : null;
  if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail ? input.contactEmail.trim() : null;
  if (input.description !== undefined) data.description = input.description ? input.description.trim() : null;
  if (input.typicalService !== undefined) data.typicalService = input.typicalService ? input.typicalService.trim() : null;
  if (input.coverageSummary !== undefined) data.coverageSummary = input.coverageSummary ? input.coverageSummary.trim() : null;
  if (input.providesElectricity !== undefined) data.providesElectricity = input.providesElectricity;
  if (input.providesGas !== undefined) data.providesGas = input.providesGas;
  if (input.displayOrder !== undefined) data.displayOrder = input.displayOrder;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.metadata !== undefined) data.metadata = input.metadata ?? null;

  if (input.counties !== undefined) {
    await prisma.$transaction(async (tx: any) => {
      await tx.propertySupplierCountyCoverage.deleteMany({
        where: { supplierId: id },
      });
      if (input.counties && input.counties.length > 0) {
        await tx.propertySupplierCountyCoverage.createMany({
          data: input.counties.map((c) => ({
            supplierId: id,
            county: c.trim(),
            isDomesticCollector: true,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  const updated = await db.propertySupplier.update({
    where: { id },
    data,
    include: {
      category: {
        select: { id: true, name: true, code: true, slug: true },
      },
      parent: {
        select: { id: true, name: true, slug: true },
      },
      children: {
        select: { id: true, name: true, slug: true, tradingName: true },
      },
      countyCoverages: {
        orderBy: { county: 'asc' },
        select: { county: true, isDomesticCollector: true },
      },
    },
  });

  // Automatically sync updated supplier to utility providers
  await syncSingleSupplierToUtilityProviders(updated.id).catch(() => {});

  return {
    ...updated,
    counties: (updated.countyCoverages || []).map((c: any) => c.county),
  };
};

export const deleteSupplier = async (id: string) => {
  const supplier = await db.propertySupplier.findUnique({
    where: { id },
    include: {
      children: { select: { id: true } },
    },
  });

  if (!supplier) {
    throw new NotFoundError('Property supplier not found.');
  }

  await prisma.$transaction(async (tx: any) => {
    // Unlink any children
    if (supplier.children && supplier.children.length > 0) {
      await tx.propertySupplier.updateMany({
        where: { parentId: id },
        data: { parentId: null },
      });
    }
    // Delete county coverages
    await tx.propertySupplierCountyCoverage.deleteMany({
      where: { supplierId: id },
    });
    // Delete supplier
    await tx.propertySupplier.delete({
      where: { id },
    });
  });

  // Deactivate corresponding utility providers
  await deactivateSupplierInUtilityProviders(id).catch(() => {});

  return { message: 'Property supplier deleted successfully.' };
};

// ============================================================================
// COUNTY COVERAGES
// ============================================================================

export const getCountyCoverageOverview = async (): Promise<CountyCoverageOverviewItem[]> => {
  const coverages = await db.propertySupplierCountyCoverage.findMany({
    where: {
      supplier: {
        isActive: true,
      },
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          slug: true,
          tradingName: true,
          logoUrl: true,
        },
      },
    },
    orderBy: [{ county: 'asc' }, { supplier: { name: 'asc' } }],
  });

  const countyMap = new Map<
    string,
    Array<{ id: string; name: string; slug: string; tradingName?: string | null; logoUrl?: string | null }>
  >();

  for (const c of (coverages as any[])) {
    const list = countyMap.get(c.county) || [];
    list.push(c.supplier);
    countyMap.set(c.county, list);
  }

  return [...countyMap.entries()].map(([county, collectors]) => ({
    county,
    collectorsCount: collectors.length,
    collectors,
  }));
};

export const assignCountiesToSupplier = async (
  supplierId: string,
  counties: string[],
  isDomesticCollector = true
) => {
  const supplier = await db.propertySupplier.findUnique({
    where: { id: supplierId },
  });
  if (!supplier) {
    throw new NotFoundError('Property supplier not found.');
  }

  const cleaned = [...new Set(counties.map((c) => c.trim()).filter(Boolean))];

  await db.propertySupplierCountyCoverage.createMany({
    data: cleaned.map((county) => ({
      supplierId,
      county,
      isDomesticCollector,
    })),
    skipDuplicates: true,
  });

  return getSupplierById(supplierId);
};

export const removeCountyFromSupplier = async (supplierId: string, county: string) => {
  const supplier = await db.propertySupplier.findUnique({
    where: { id: supplierId },
  });
  if (!supplier) {
    throw new NotFoundError('Property supplier not found.');
  }

  await db.propertySupplierCountyCoverage.deleteMany({
    where: {
      supplierId,
      county: { equals: county.trim(), mode: 'insensitive' },
    },
  });

  return { message: `County '${county}' removed from supplier coverage.` };
};
