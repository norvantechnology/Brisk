import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

export async function seedCategories(prisma: PrismaClient): Promise<void> {
  const categoryData = [
    {
      name: 'Plumbing Services',
      categoryCode: 'CAT-PLUMB',
      urlSlug: 'plumbing-services',
      description: 'Professional plumbing, pipe installation, leak repairs, and heating maintenance.',
      iconName: 'Wrench',
      brandThemeColor: '#0EA5E9',
      displayOrder: 1,
      featured: true,
      subcategories: [
        { name: 'Pipe Fitting & Installation', serviceType: 'Installation', code: 'PLUMB-PIPE', urlSlug: 'pipe-fitting-installation', featured: true },
        { name: 'Drainage & Sewer Unblocking', serviceType: 'Repair', code: 'PLUMB-DRAIN', urlSlug: 'drainage-sewer-unblocking', featured: true },
        { name: 'Boiler & Heating Repair', serviceType: 'Maintenance', code: 'PLUMB-BOILER', urlSlug: 'boiler-heating-repair', featured: false },
      ],
    },
    {
      name: 'Electrical & Wiring',
      categoryCode: 'CAT-ELECT',
      urlSlug: 'electrical-wiring',
      description: 'Licensed electrician services, full house rewiring, fuse board upgrades, and lighting.',
      iconName: 'Zap',
      brandThemeColor: '#F59E0B',
      displayOrder: 2,
      featured: true,
      subcategories: [
        { name: 'House Rewiring', serviceType: 'Installation', code: 'ELECT-HWIR', urlSlug: 'house-rewiring', featured: true },
        { name: 'EV Charger Installation', serviceType: 'Installation', code: 'ELECT-EVCH', urlSlug: 'ev-charger-installation', featured: true },
        { name: 'Fuse Board & Panel Upgrade', serviceType: 'Upgrade', code: 'ELECT-FUSE', urlSlug: 'fuse-board-panel-upgrade', featured: false },
      ],
    },
    {
      name: 'Carpentry & Woodwork',
      categoryCode: 'CAT-CARP',
      urlSlug: 'carpentry-woodwork',
      description: 'Custom furniture, bespoke cabinetry, flooring installation, and structural woodwork.',
      iconName: 'Hammer',
      brandThemeColor: '#8B5CF6',
      displayOrder: 3,
      featured: true,
      subcategories: [
        { name: 'Bespoke Furniture Making', serviceType: 'Custom Craft', code: 'CARP-FURN', urlSlug: 'bespoke-furniture-making', featured: true },
        { name: 'Hardwood & Laminate Flooring', serviceType: 'Installation', code: 'CARP-FLOOR', urlSlug: 'hardwood-laminate-flooring', featured: false },
      ],
    },
    {
      name: 'Painting & Decorating',
      categoryCode: 'CAT-PAINT',
      urlSlug: 'painting-decorating',
      description: 'Interior and exterior house painting, wallpaper installation, and plastering.',
      iconName: 'Paintbrush',
      brandThemeColor: '#EC4899',
      displayOrder: 4,
      featured: true,
      subcategories: [
        { name: 'Interior Painting', serviceType: 'Decorating', code: 'PAINT-INT', urlSlug: 'interior-painting', featured: true },
        { name: 'Exterior Wall Coating', serviceType: 'Protection', code: 'PAINT-EXT', urlSlug: 'exterior-wall-coating', featured: false },
      ],
    },
    {
      name: 'Cleaning & Sanitation',
      categoryCode: 'CAT-CLEAN',
      urlSlug: 'cleaning-sanitation',
      description: 'Home deep cleaning, tenancy end cleaning, window washing, and carpet sanitization.',
      iconName: 'Sparkles',
      brandThemeColor: '#10B981',
      displayOrder: 5,
      featured: true,
      subcategories: [
        { name: 'Home Deep Cleaning', serviceType: 'Deep Clean', code: 'CLEAN-HOME', urlSlug: 'home-deep-cleaning', featured: true },
        { name: 'End of Tenancy Cleaning', serviceType: 'Sanitization', code: 'CLEAN-EOT', urlSlug: 'end-of-tenancy-cleaning', featured: false },
      ],
    },
    {
      name: 'Interior Design & Fit-Out',
      categoryCode: 'CAT-INTER',
      urlSlug: 'interior-design-fitout',
      description: 'Space planning, interior layout design, and full commercial/residential fit-outs.',
      iconName: 'Layout',
      brandThemeColor: '#6366F1',
      displayOrder: 6,
      featured: true,
      subcategories: [
        { name: 'Space Planning & Layout Design', serviceType: 'Consultation', code: 'INTER-PLAN', urlSlug: 'space-planning-layout-design', featured: true },
      ],
    },
    {
      name: 'HVAC & AC Repair',
      categoryCode: 'CAT-HVAC',
      urlSlug: 'hvac-ac-repair',
      description: 'Air conditioning installation, ventilation system repairs, and duct cleaning.',
      iconName: 'Wind',
      brandThemeColor: '#3B82F6',
      displayOrder: 7,
      featured: false,
      subcategories: [
        { name: 'Air Conditioning Installation', serviceType: 'Installation', code: 'HVAC-ACIN', urlSlug: 'air-conditioning-installation', featured: true },
      ],
    },
    {
      name: 'CCTV & Security Systems',
      categoryCode: 'CAT-CCTV',
      urlSlug: 'cctv-security-systems',
      description: 'CCTV camera installation, smart alarm systems, access control, and intercoms.',
      iconName: 'ShieldCheck',
      brandThemeColor: '#EF4444',
      displayOrder: 8,
      featured: true,
      subcategories: [
        { name: 'CCTV Surveillance Installation', serviceType: 'Security', code: 'CCTV-SURV', urlSlug: 'cctv-surveillance-installation', featured: true },
      ],
    },
    {
      name: 'Solar Energy & EV Chargers',
      categoryCode: 'CAT-SOLAR',
      urlSlug: 'solar-energy-ev',
      description: 'Solar PV panel installation, battery storage units, and green energy solutions.',
      iconName: 'Sun',
      brandThemeColor: '#10B981',
      displayOrder: 9,
      featured: true,
      subcategories: [
        { name: 'Solar PV Panel Installation', serviceType: 'Green Energy', code: 'SOLAR-PV', urlSlug: 'solar-pv-panel-installation', featured: true },
      ],
    },
    {
      name: 'Roofing & Guttering',
      categoryCode: 'CAT-ROOF',
      urlSlug: 'roofing-guttering',
      description: 'Roof tile repairs, chimney leadwork, flat roofing, and PVC gutter replacement.',
      iconName: 'Home',
      brandThemeColor: '#D97706',
      displayOrder: 10,
      featured: false,
      subcategories: [
        { name: 'Roof Tile Repair & Replacement', serviceType: 'Roofing', code: 'ROOF-TILE', urlSlug: 'roof-tile-repair-replacement', featured: true },
      ],
    },
  ];

  for (const cat of categoryData) {
    const existing = await prisma.category.findUnique({
      where: { categoryCode: cat.categoryCode },
    });

    let categoryId = existing?.id;

    if (!existing) {
      const created = await prisma.category.create({
        data: {
          name: cat.name,
          categoryCode: cat.categoryCode,
          urlSlug: cat.urlSlug,
          description: cat.description,
          iconName: cat.iconName,
          brandThemeColor: cat.brandThemeColor,
          displayOrder: cat.displayOrder,
          featured: cat.featured,
          status: 'active',
        },
      });
      categoryId = created.id;
      logger.info(`✅ Category seeded: ${cat.name} (${cat.categoryCode})`);
    }

    if (categoryId && cat.subcategories) {
      for (const sub of cat.subcategories) {
        const existingSub = await prisma.subcategory.findFirst({
          where: { categoryId, name: sub.name },
        });

        if (!existingSub) {
          await prisma.subcategory.create({
            data: {
              categoryId,
              name: sub.name,
              serviceType: sub.serviceType,
              code: sub.code,
              urlSlug: sub.urlSlug,
              featured: sub.featured,
              status: 'active',
            },
          });
          logger.info(`  ↳ Subcategory seeded: ${sub.name} (${sub.code})`);
        }
      }
    }
  }
}
