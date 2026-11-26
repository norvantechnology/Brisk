import { prisma } from '../../../config/database';
import { getPlatformSetting } from '../../settings/platform-settings.service';

export interface ResolvedPlatformFeeRule {
  level: 'SUBCATEGORY' | 'CATEGORY' | 'GLOBAL';
  type: 'PERCENTAGE' | 'FIXED';
  percentage: number;
  fixedEur: number;
  fixedGbp: number;
  sourceId: string | null;
  sourceName: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const getGlobalDefaultPricingRule = (): ResolvedPlatformFeeRule => {
  const type = ((getPlatformSetting('pricing.platform_fee.type') as string) || 'PERCENTAGE') as
    | 'PERCENTAGE'
    | 'FIXED';
  const percentage = Number(getPlatformSetting('pricing.platform_fee.percentage') ?? 10);
  const fixedEur = Number(getPlatformSetting('pricing.platform_fee.fixed_eur') ?? 10);
  const fixedGbp = Number(getPlatformSetting('pricing.platform_fee.fixed_gbp') ?? 8.5);

  return {
    level: 'GLOBAL',
    type,
    percentage: isNaN(percentage) ? 10 : percentage,
    fixedEur: isNaN(fixedEur) ? 10 : fixedEur,
    fixedGbp: isNaN(fixedGbp) ? 8.5 : fixedGbp,
    sourceId: null,
    sourceName: 'Global Default (10%)',
  };
};

/**
 * Resolves the effective pricing rule using the priority hierarchy:
 * 1. Subcategory custom pricing (Priority 1)
 * 2. Category custom pricing (Priority 2)
 * 3. Global platform fee default (Priority 3)
 */
export const resolvePricingRuleForJob = async (input: {
  subcategoryId?: string | null;
  categoryId?: string | null;
}): Promise<ResolvedPlatformFeeRule> => {
  const { subcategoryId, categoryId } = input;

  // Priority 1: Subcategory Level
  if (subcategoryId) {
    const subcategory = await prisma.subcategory.findUnique({
      where: { id: subcategoryId },
      select: {
        id: true,
        name: true,
        categoryId: true,
        customPricingEnabled: true,
        customPricingType: true,
        customPricingPercentage: true,
        customPricingFixedEur: true,
        customPricingFixedGbp: true,
      },
    });

    if (subcategory && subcategory.customPricingEnabled) {
      const type = (subcategory.customPricingType as 'PERCENTAGE' | 'FIXED') || 'PERCENTAGE';
      return {
        level: 'SUBCATEGORY',
        type,
        percentage:
          subcategory.customPricingPercentage != null
            ? Number(subcategory.customPricingPercentage)
            : 10,
        fixedEur:
          subcategory.customPricingFixedEur != null ? Number(subcategory.customPricingFixedEur) : 10,
        fixedGbp:
          subcategory.customPricingFixedGbp != null ? Number(subcategory.customPricingFixedGbp) : 8.5,
        sourceId: subcategory.id,
        sourceName: subcategory.name,
      };
    }

    // If subcategory has no custom rule, use its parent categoryId if categoryId wasn't explicitly passed
    if (!categoryId && subcategory?.categoryId) {
      input.categoryId = subcategory.categoryId;
    }
  }

  // Priority 2: Category Level
  const effectiveCatId = input.categoryId;
  if (effectiveCatId) {
    const category = await prisma.category.findUnique({
      where: { id: effectiveCatId },
      select: {
        id: true,
        name: true,
        customPricingEnabled: true,
        customPricingType: true,
        customPricingPercentage: true,
        customPricingFixedEur: true,
        customPricingFixedGbp: true,
      },
    });

    if (category && category.customPricingEnabled) {
      const type = (category.customPricingType as 'PERCENTAGE' | 'FIXED') || 'PERCENTAGE';
      return {
        level: 'CATEGORY',
        type,
        percentage:
          category.customPricingPercentage != null ? Number(category.customPricingPercentage) : 10,
        fixedEur:
          category.customPricingFixedEur != null ? Number(category.customPricingFixedEur) : 10,
        fixedGbp:
          category.customPricingFixedGbp != null ? Number(category.customPricingFixedGbp) : 8.5,
        sourceId: category.id,
        sourceName: category.name,
      };
    }
  }

  // Priority 3: Fallback to Global Platform Setting
  return getGlobalDefaultPricingRule();
};

/**
 * Computes platform fee (excl. VAT) based on the resolved rule, net trader amount, and currency.
 */
export const computePlatformFeeAmount = (
  rule: ResolvedPlatformFeeRule,
  traderNet: number,
  currencyCode: string = 'EUR'
): number => {
  const isGbp = currencyCode.toUpperCase() === 'GBP';

  if (rule.type === 'FIXED') {
    return round2(isGbp ? rule.fixedGbp : rule.fixedEur);
  }

  return round2(traderNet * (rule.percentage / 100));
};
