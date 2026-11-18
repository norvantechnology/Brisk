import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';

const db = prisma as any;

export const listActiveCategories = async () => {
  const categories = await db.propertySupplierCategory.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          suppliers: {
            where: { isActive: true },
          },
        },
      },
    },
  });

  return (categories as any[]).map((cat) => ({
    id: cat.id,
    name: cat.name,
    code: cat.code,
    slug: cat.slug,
    description: cat.description,
    iconUrl: cat.iconUrl,
    displayOrder: cat.displayOrder,
    suppliersCount: cat._count?.suppliers ?? 0,
  }));
};

export const listActiveSuppliers = async (query: {
  categoryId?: string;
  categoryCode?: string;
  categorySlug?: string;
  county?: string;
  electricity?: boolean | string;
  gas?: boolean | string;
  search?: string;
}) => {
  const where: any = {
    isActive: true,
  };

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.categoryCode) {
    where.category = { code: query.categoryCode.toUpperCase() };
  }

  if (query.categorySlug) {
    where.category = { slug: query.categorySlug };
  }

  if (query.electricity !== undefined) {
    const isElec = query.electricity === true || query.electricity === 'true' || query.electricity === '1';
    where.providesElectricity = isElec;
  }

  if (query.gas !== undefined) {
    const isGas = query.gas === true || query.gas === 'true' || query.gas === '1';
    where.providesGas = isGas;
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

  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { tradingName: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { typicalService: { contains: search, mode: 'insensitive' } },
      { coverageSummary: { contains: search, mode: 'insensitive' } },
    ];
  }

  const suppliers = await db.propertySupplier.findMany({
    where,
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
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
        },
      },
      children: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          tradingName: true,
          logoUrl: true,
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

  return (suppliers as any[]).map((s) => ({
    ...s,
    counties: (s.countyCoverages || []).map((c: any) => c.county),
  }));
};

export const listCountiesWithSuppliers = async () => {
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
          typicalService: true,
          category: {
            select: {
              id: true,
              name: true,
              code: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: [{ county: 'asc' }, { supplier: { name: 'asc' } }],
  });

  const countyMap = new Map<
    string,
    Array<{
      id: string;
      name: string;
      slug: string;
      tradingName?: string | null;
      logoUrl?: string | null;
      typicalService?: string | null;
      category: { id: string; name: string; code: string; slug: string };
    }>
  >();

  for (const c of (coverages as any[])) {
    const list = countyMap.get(c.county) || [];
    list.push(c.supplier);
    countyMap.set(c.county, list);
  }

  return [...countyMap.entries()].map(([county, suppliers]) => ({
    county,
    suppliersCount: suppliers.length,
    suppliers,
  }));
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getSupplierDetail = async (idOrSlug: string) => {
  const isUuid = UUID_REGEX.test(idOrSlug);

  const supplier = await db.propertySupplier.findFirst({
    where: {
      ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug }),
      isActive: true,
    },
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
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          tradingName: true,
          logoUrl: true,
          typicalService: true,
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
