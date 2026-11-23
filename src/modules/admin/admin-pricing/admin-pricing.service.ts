import {
  getPlatformSetting,
  updatePlatformSettings,
} from '../../settings/platform-settings.service';
import type { UpdatePricingConfigInput } from './admin-pricing.validation';

export const getPricingConfig = async () => {
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
