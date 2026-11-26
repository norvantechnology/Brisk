import { prisma } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import { ActorType } from '@prisma/client';
import {
  getPlatformSetting,
  updatePlatformSettings,
} from '../../settings/platform-settings.service';
import type {
  UpdatePricingConfigInput,
  CustomPricingBodyInput,
  ListCustomPricingQueryInput,
} from './admin-pricing.validation';
import {
  getGlobalDefaultPricingRule,
  resolvePricingRuleForJob,
} from './pricing-resolver.service';

export const getPricingConfig = async () => {
  const [customCategoriesCount, customSubcategoriesCount] = await Promise.all([
    prisma.category.count({ where: { customPricingEnabled: true } }),
    prisma.subcategory.count({ where: { customPricingEnabled: true } }),
  ]);

  return {
    platformFee: {
      type: getPlatformSetting('pricing.platform_fee.type') as 'PERCENTAGE' | 'FIXED',
      percentage: Number(getPlatformSetting('pricing.platform_fee.percentage')),
      fixedEur: Number(getPlatformSetting('pricing.platform_fee.fixed_eur')),
      fixedGbp: Number(getPlatformSetting('pricing.platform_fee.fixed_gbp')),
    },
    loyaltyPoints: {
      pointsPerEur: Number(getPlatformSetting('pricing.loyalty.points_per_eur')),
      pointsPerGbp: Number(getPlatformSetting('pricing.loyalty.points_per_gbp')),
    },
    vatTax: {
      traderStandardRate: Number(getPlatformSetting('pricing.vat.trader_standard_rate')),
      traderTwoThirdsRate: Number(getPlatformSetting('pricing.vat.trader_two_thirds_rate')),
      platformFeeRate: Number(getPlatformSetting('pricing.vat.platform_fee_rate')),
      ukStandardRate: Number(getPlatformSetting('pricing.vat.uk_standard_rate')),
    },
    customPricingStats: {
      categoriesWithCustomPricing: customCategoriesCount,
      subcategoriesWithCustomPricing: customSubcategoriesCount,
      priorityOrder: ['SUBCATEGORY', 'CATEGORY', 'GLOBAL_DEFAULT'],
    },
  };
};

export const updatePricingConfig = async (
  input: UpdatePricingConfigInput,
  admin: { id: string; fullName: string }
) => {
  const updates: Record<string, unknown> = {};

  if (input.platformFee) {
    if (input.platformFee.type !== undefined) {
      updates['pricing.platform_fee.type'] = input.platformFee.type;
    }
    if (input.platformFee.percentage !== undefined) {
      updates['pricing.platform_fee.percentage'] = input.platformFee.percentage;
    }
    if (input.platformFee.fixedEur !== undefined) {
      updates['pricing.platform_fee.fixed_eur'] = input.platformFee.fixedEur;
    }
    if (input.platformFee.fixedGbp !== undefined) {
      updates['pricing.platform_fee.fixed_gbp'] = input.platformFee.fixedGbp;
    }
  }

  if (input.loyaltyPoints) {
    if (input.loyaltyPoints.pointsPerEur !== undefined) {
      updates['pricing.loyalty.points_per_eur'] = input.loyaltyPoints.pointsPerEur;
    }
    if (input.loyaltyPoints.pointsPerGbp !== undefined) {
      updates['pricing.loyalty.points_per_gbp'] = input.loyaltyPoints.pointsPerGbp;
    }
  }

  if (input.vatTax) {
    if (input.vatTax.traderStandardRate !== undefined) {
      updates['pricing.vat.trader_standard_rate'] = input.vatTax.traderStandardRate;
    }
    if (input.vatTax.traderTwoThirdsRate !== undefined) {
      updates['pricing.vat.trader_two_thirds_rate'] = input.vatTax.traderTwoThirdsRate;
    }
    if (input.vatTax.platformFeeRate !== undefined) {
      updates['pricing.vat.platform_fee_rate'] = input.vatTax.platformFeeRate;
    }
    if (input.vatTax.ukStandardRate !== undefined) {
      updates['pricing.vat.uk_standard_rate'] = input.vatTax.ukStandardRate;
    }
  }

  if (Object.keys(updates).length > 0) {
    await updatePlatformSettings(updates, admin);
  }

  return getPricingConfig();
};

const formatCustomPricing = (entity: {
  customPricingEnabled?: boolean | null;
  customPricingType?: string | null;
  customPricingPercentage?: any;
  customPricingFixedEur?: any;
  customPricingFixedGbp?: any;
}) => ({
  enabled: entity.customPricingEnabled ?? false,
  type: (entity.customPricingType as 'PERCENTAGE' | 'FIXED') || 'PERCENTAGE',
  percentage:
    entity.customPricingPercentage != null ? Number(entity.customPricingPercentage) : null,
  fixedEur: entity.customPricingFixedEur != null ? Number(entity.customPricingFixedEur) : null,
  fixedGbp: entity.customPricingFixedGbp != null ? Number(entity.customPricingFixedGbp) : null,
});

/**
 * Overview of all active custom pricing rules across categories and subcategories.
 */
export const getAllCustomPricingOverview = async () => {
  const defaultRule = getGlobalDefaultPricingRule();

  const [categories, subcategories] = await Promise.all([
    prisma.category.findMany({
      where: { customPricingEnabled: true },
      select: {
        id: true,
        name: true,
        categoryCode: true,
        customPricingEnabled: true,
        customPricingType: true,
        customPricingPercentage: true,
        customPricingFixedEur: true,
        customPricingFixedGbp: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.subcategory.findMany({
      where: { customPricingEnabled: true },
      select: {
        id: true,
        name: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
        customPricingEnabled: true,
        customPricingType: true,
        customPricingPercentage: true,
        customPricingFixedEur: true,
        customPricingFixedGbp: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    defaultRule,
    priorityOrder: ['SUBCATEGORY', 'CATEGORY', 'GLOBAL_DEFAULT'],
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      categoryCode: c.categoryCode,
      customPricing: formatCustomPricing(c),
    })),
    subcategories: subcategories.map((s) => ({
      id: s.id,
      name: s.name,
      categoryId: s.categoryId,
      categoryName: s.category.name,
      customPricing: formatCustomPricing(s),
    })),
  };
};

/**
 * List categories with custom pricing information.
 */
export const listCategoriesPricing = async (query: ListCustomPricingQueryInput) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (query.customOnly) {
    where.customPricingEnabled = true;
  }
  if (query.search) {
    where.name = { contains: query.search.trim(), mode: 'insensitive' };
  }

  const [total, items] = await Promise.all([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        categoryCode: true,
        customPricingEnabled: true,
        customPricingType: true,
        customPricingPercentage: true,
        customPricingFixedEur: true,
        customPricingFixedGbp: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const defaultRule = getGlobalDefaultPricingRule();

  return {
    items: items.map((c) => {
      const customPricing = formatCustomPricing(c);
      return {
        id: c.id,
        name: c.name,
        categoryCode: c.categoryCode,
        customPricing,
        effectivePricing: customPricing.enabled
          ? {
              level: 'CATEGORY' as const,
              type: customPricing.type,
              percentage: customPricing.type === 'PERCENTAGE' ? customPricing.percentage ?? 10 : 10,
              fixedEur: customPricing.type === 'FIXED' ? customPricing.fixedEur ?? 10 : 10,
              fixedGbp: customPricing.type === 'FIXED' ? customPricing.fixedGbp ?? 8.5 : 8.5,
            }
          : defaultRule,
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get pricing config for a specific category.
 */
export const getCategoryPricing = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      categoryCode: true,
      customPricingEnabled: true,
      customPricingType: true,
      customPricingPercentage: true,
      customPricingFixedEur: true,
      customPricingFixedGbp: true,
    },
  });

  if (!category) {
    throw new NotFoundError('Category not found.');
  }

  const customPricing = formatCustomPricing(category);
  const defaultRule = getGlobalDefaultPricingRule();

  return {
    id: category.id,
    name: category.name,
    categoryCode: category.categoryCode,
    customPricing,
    effectivePricing: customPricing.enabled
      ? {
          level: 'CATEGORY' as const,
          type: customPricing.type,
          percentage: customPricing.type === 'PERCENTAGE' ? customPricing.percentage ?? 10 : 10,
          fixedEur: customPricing.type === 'FIXED' ? customPricing.fixedEur ?? 10 : 10,
          fixedGbp: customPricing.type === 'FIXED' ? customPricing.fixedGbp ?? 8.5 : 8.5,
        }
      : defaultRule,
  };
};

/**
 * Update custom pricing for a category.
 */
export const updateCategoryPricing = async (
  id: string,
  input: CustomPricingBodyInput,
  admin: { id: string; fullName: string }
) => {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw new NotFoundError('Category not found.');
  }

  const enabled = Boolean(input.enabled);
  const type = input.type || 'PERCENTAGE';

  const updated = await prisma.category.update({
    where: { id },
    data: {
      customPricingEnabled: enabled,
      customPricingType: enabled ? type : null,
      customPricingPercentage:
        enabled && type === 'PERCENTAGE' && input.percentage != null ? input.percentage : null,
      customPricingFixedEur:
        enabled && type === 'FIXED' && input.fixedEur != null ? input.fixedEur : null,
      customPricingFixedGbp:
        enabled && type === 'FIXED' && input.fixedGbp != null ? input.fixedGbp : null,
    },
    select: {
      id: true,
      name: true,
      categoryCode: true,
      customPricingEnabled: true,
      customPricingType: true,
      customPricingPercentage: true,
      customPricingFixedEur: true,
      customPricingFixedGbp: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'CATEGORY_PRICING_UPDATED',
      actorType: ActorType.ADMIN,
      actorId: admin.id,
      actorLabel: admin.fullName,
      subjectType: 'Category',
      subjectId: updated.id,
      description: enabled
        ? `Configured custom pricing for Category "${updated.name}": ${type} (${type === 'FIXED' ? `EUR ${input.fixedEur}, GBP ${input.fixedGbp}` : `${input.percentage}%`}).`
        : `Disabled custom pricing for Category "${updated.name}", reverting to default 10%.`,
    },
  });

  return getCategoryPricing(id);
};

/**
 * List subcategories with custom pricing information.
 */
export const listSubcategoriesPricing = async (query: ListCustomPricingQueryInput) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }
  if (query.customOnly) {
    where.customPricingEnabled = true;
  }
  if (query.search) {
    where.name = { contains: query.search.trim(), mode: 'insensitive' };
  }

  const [total, items] = await Promise.all([
    prisma.subcategory.count({ where }),
    prisma.subcategory.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
            customPricingEnabled: true,
            customPricingType: true,
            customPricingPercentage: true,
            customPricingFixedEur: true,
            customPricingFixedGbp: true,
          },
        },
        customPricingEnabled: true,
        customPricingType: true,
        customPricingPercentage: true,
        customPricingFixedEur: true,
        customPricingFixedGbp: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const defaultRule = getGlobalDefaultPricingRule();

  const formattedItems = items.map((s) => {
    const subPricing = formatCustomPricing(s);
    const catPricing = formatCustomPricing(s.category);

    let effectivePricing: any;
    if (subPricing.enabled) {
      effectivePricing = {
        level: 'SUBCATEGORY',
        type: subPricing.type,
        percentage: subPricing.type === 'PERCENTAGE' ? subPricing.percentage ?? 10 : 10,
        fixedEur: subPricing.type === 'FIXED' ? subPricing.fixedEur ?? 10 : 10,
        fixedGbp: subPricing.type === 'FIXED' ? subPricing.fixedGbp ?? 8.5 : 8.5,
        sourceName: s.name,
      };
    } else if (catPricing.enabled) {
      effectivePricing = {
        level: 'CATEGORY',
        type: catPricing.type,
        percentage: catPricing.type === 'PERCENTAGE' ? catPricing.percentage ?? 10 : 10,
        fixedEur: catPricing.type === 'FIXED' ? catPricing.fixedEur ?? 10 : 10,
        fixedGbp: catPricing.type === 'FIXED' ? catPricing.fixedGbp ?? 8.5 : 8.5,
        sourceName: s.category.name,
      };
    } else {
      effectivePricing = defaultRule;
    }

    return {
      id: s.id,
      name: s.name,
      categoryId: s.categoryId,
      categoryName: s.category.name,
      customPricing: subPricing,
      categoryPricing: catPricing,
      effectivePricing,
    };
  });

  return {
    items: formattedItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get custom pricing for a specific subcategory.
 */
export const getSubcategoryPricing = async (id: string) => {
  const subcategory = await prisma.subcategory.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          customPricingEnabled: true,
          customPricingType: true,
          customPricingPercentage: true,
          customPricingFixedEur: true,
          customPricingFixedGbp: true,
        },
      },
      customPricingEnabled: true,
      customPricingType: true,
      customPricingPercentage: true,
      customPricingFixedEur: true,
      customPricingFixedGbp: true,
    },
  });

  if (!subcategory) {
    throw new NotFoundError('Subcategory not found.');
  }

  const subPricing = formatCustomPricing(subcategory);
  const catPricing = formatCustomPricing(subcategory.category);
  const effectivePricing = await resolvePricingRuleForJob({ subcategoryId: id });

  return {
    id: subcategory.id,
    name: subcategory.name,
    categoryId: subcategory.categoryId,
    categoryName: subcategory.category.name,
    customPricing: subPricing,
    categoryPricing: catPricing,
    effectivePricing,
  };
};

/**
 * Update custom pricing for a subcategory.
 */
export const updateSubcategoryPricing = async (
  id: string,
  input: CustomPricingBodyInput,
  admin: { id: string; fullName: string }
) => {
  const subcategory = await prisma.subcategory.findUnique({ where: { id } });
  if (!subcategory) {
    throw new NotFoundError('Subcategory not found.');
  }

  const enabled = Boolean(input.enabled);
  const type = input.type || 'PERCENTAGE';

  const updated = await prisma.subcategory.update({
    where: { id },
    data: {
      customPricingEnabled: enabled,
      customPricingType: enabled ? type : null,
      customPricingPercentage:
        enabled && type === 'PERCENTAGE' && input.percentage != null ? input.percentage : null,
      customPricingFixedEur:
        enabled && type === 'FIXED' && input.fixedEur != null ? input.fixedEur : null,
      customPricingFixedGbp:
        enabled && type === 'FIXED' && input.fixedGbp != null ? input.fixedGbp : null,
    },
    select: {
      id: true,
      name: true,
      categoryId: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      eventType: 'SUBCATEGORY_PRICING_UPDATED',
      actorType: ActorType.ADMIN,
      actorId: admin.id,
      actorLabel: admin.fullName,
      subjectType: 'Subcategory',
      subjectId: updated.id,
      description: enabled
        ? `Configured custom pricing for Subcategory "${updated.name}": ${type} (${type === 'FIXED' ? `EUR ${input.fixedEur}, GBP ${input.fixedGbp}` : `${input.percentage}%`}).`
        : `Disabled custom pricing for Subcategory "${updated.name}", reverting to Category/Global rule.`,
    },
  });

  return getSubcategoryPricing(id);
};
