import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import {
  SEED_SUPPLIER_CATEGORIES,
  SEED_ENERGY_SUPPLIERS,
  SEED_BROADBAND_SUPPLIERS,
  SEED_WASTE_SUPPLIERS,
  SEED_COUNTY_WASTE_COLLECTORS,
} from './property-suppliers.data';

export async function seedPropertySuppliers(prisma: PrismaClient): Promise<void> {
  try {
    logger.info('🌱 Seeding Property Listed Suppliers master data...');

    // 1. Seed Categories
    const categoryMap = new Map<string, string>(); // code -> id
    for (const cat of SEED_SUPPLIER_CATEGORIES) {
      const category = await (prisma as any).propertySupplierCategory.upsert({
        where: { code: cat.code },
        update: {
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          displayOrder: cat.displayOrder,
          isActive: true,
        },
        create: {
          name: cat.name,
          code: cat.code,
          slug: cat.slug,
          description: cat.description,
          displayOrder: cat.displayOrder,
          isActive: true,
        },
      });
      categoryMap.set(cat.code, category.id);
    }

    const energyCategoryId = categoryMap.get('ENERGY')!;
    const broadbandCategoryId = categoryMap.get('BROADBAND')!;
    const wasteCategoryId = categoryMap.get('WASTE_MANAGEMENT')!;

    // 2. Seed Energy Suppliers
    for (const s of SEED_ENERGY_SUPPLIERS) {
      await (prisma as any).propertySupplier.upsert({
        where: { slug: s.slug },
        update: {
          name: s.name,
          categoryId: energyCategoryId,
          tradingName: s.tradingName || null,
          providesElectricity: s.providesElectricity ?? false,
          providesGas: s.providesGas ?? false,
          displayOrder: s.displayOrder,
          isActive: true,
        },
        create: {
          name: s.name,
          slug: s.slug,
          categoryId: energyCategoryId,
          tradingName: s.tradingName || null,
          providesElectricity: s.providesElectricity ?? false,
          providesGas: s.providesGas ?? false,
          displayOrder: s.displayOrder,
          isActive: true,
        },
      });
    }

    // 3. Seed Broadband Suppliers
    for (const s of SEED_BROADBAND_SUPPLIERS) {
      await (prisma as any).propertySupplier.upsert({
        where: { slug: s.slug },
        update: {
          name: s.name,
          categoryId: broadbandCategoryId,
          typicalService: s.typicalService || null,
          displayOrder: s.displayOrder,
          isActive: true,
        },
        create: {
          name: s.name,
          slug: s.slug,
          categoryId: broadbandCategoryId,
          typicalService: s.typicalService || null,
          displayOrder: s.displayOrder,
          isActive: true,
        },
      });
    }

    // 4. Seed Waste Management Suppliers
    const wasteSuppliers = new Map<string, string>(); // lowercase name / slug -> id
    for (const s of SEED_WASTE_SUPPLIERS) {
      const supplier = await (prisma as any).propertySupplier.upsert({
        where: { slug: s.slug },
        update: {
          name: s.name,
          categoryId: wasteCategoryId,
          tradingName: s.tradingName || null,
          coverageSummary: s.coverageSummary || null,
          displayOrder: s.displayOrder,
          isActive: true,
        },
        create: {
          name: s.name,
          slug: s.slug,
          categoryId: wasteCategoryId,
          tradingName: s.tradingName || null,
          coverageSummary: s.coverageSummary || null,
          displayOrder: s.displayOrder,
          isActive: true,
        },
      });
      wasteSuppliers.set(s.slug, supplier.id);
      wasteSuppliers.set(s.name.toLowerCase(), supplier.id);
    }

    // 5. Seed County Waste Collector coverage mappings
    const allWasteRecords = await (prisma as any).propertySupplier.findMany({
      where: { categoryId: wasteCategoryId },
      select: { id: true, name: true, slug: true, coverageSummary: true },
    });

    const findSupplierId = (token: string): string | null => {
      const cleaned = token.trim().toLowerCase();
      if (!cleaned) return null;

      for (const w of allWasteRecords) {
        const lowerName = w.name.toLowerCase();
        if (
          lowerName.includes(cleaned) ||
          cleaned.includes(lowerName) ||
          w.slug.includes(cleaned)
        ) {
          return w.id;
        }
      }
      return null;
    };

    // A. Map from explicit county list in Sheet 3
    for (const c of SEED_COUNTY_WASTE_COLLECTORS) {
      const county = c.county.trim();
      const tokens = c.collectorsRaw
        .split(/[,.]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 1);

      for (const token of tokens) {
        const supplierId = findSupplierId(token);
        if (supplierId) {
          await (prisma as any).propertySupplierCountyCoverage.upsert({
            where: {
              supplierId_county: {
                supplierId,
                county,
              },
            },
            update: {
              isDomesticCollector: true,
            },
            create: {
              supplierId,
              county,
              isDomesticCollector: true,
            },
          });
        }
      }
    }

    // B. Also map coverageSummary mentions of counties
    const ALL_IRISH_COUNTIES = [
      'Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal', 'Dublin', 'Galway', 'Kerry',
      'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth',
      'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon', 'Sligo', 'Tipperary',
      'Waterford', 'Westmeath', 'Wexford', 'Wicklow'
    ];

    for (const w of allWasteRecords) {
      if (!w.coverageSummary) continue;
      for (const county of ALL_IRISH_COUNTIES) {
        if (new RegExp(`\\b${county}\\b`, 'i').test(w.coverageSummary)) {
          await (prisma as any).propertySupplierCountyCoverage.upsert({
            where: {
              supplierId_county: {
                supplierId: w.id,
                county,
              },
            },
            update: {},
            create: {
              supplierId: w.id,
              county,
              isDomesticCollector: true,
            },
          });
        }
      }
    }

    // 6. Setup parent-child hierarchy example (Yuno Ltd -> PrePayPower & Yuno Energy)
    const yunoParent = await (prisma as any).propertySupplier.findFirst({
      where: { name: { contains: 'PrePayPower' } },
      select: { id: true },
    });
    const yunoEnergy = await (prisma as any).propertySupplier.findFirst({
      where: { name: { contains: 'Yuno Energy' } },
      select: { id: true },
    });
    if (yunoParent && yunoEnergy && yunoParent.id !== yunoEnergy.id) {
      await (prisma as any).propertySupplier.update({
        where: { id: yunoEnergy.id },
        data: { parentId: yunoParent.id },
      });
    }

    logger.info('✅ Property Listed Suppliers seeded successfully (categories, energy, broadband, waste & county mappings).');
  } catch (err) {
    logger.warn('⚠️ Property Listed Suppliers seed error:', { err });
  }
}
