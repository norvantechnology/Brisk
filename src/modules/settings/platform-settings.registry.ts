export type PlatformSettingType = 'number' | 'integer' | 'boolean' | 'string';
export type PlatformSettingUnit = 'CURRENCY' | 'KM' | 'DAYS';
export type PlatformSettingGroup =
  | 'SITE_VISIT'
  | 'JOBS'
  | 'PRICING_FEES'
  | 'PRICING_LOYALTY'
  | 'PRICING_VAT';

export interface PlatformSettingDefinition {
  group: PlatformSettingGroup;
  label: string;
  description: string;
  type: PlatformSettingType;
  defaultValue: number | boolean | string;
  min?: number;
  max?: number;
  maxLength?: number;
  unit?: PlatformSettingUnit;
  sortOrder: number;
}

export const PLATFORM_SETTING_GROUPS: Record<
  PlatformSettingGroup,
  { label: string; description: string; sortOrder: number }
> = {
  SITE_VISIT: {
    label: 'Site Visit',
    description: 'Site visit fee and booking configuration.',
    sortOrder: 1,
  },
  JOBS: {
    label: 'Jobs',
    description: 'Job discovery and matching defaults.',
    sortOrder: 2,
  },
  PRICING_FEES: {
    label: 'Platform Fees',
    description: 'Brisk platform commission fee configuration (percentage or fixed, EUR/GBP).',
    sortOrder: 3,
  },
  PRICING_LOYALTY: {
    label: 'Loyalty Points',
    description: 'BRISK points conversion rates earned per EUR or GBP.',
    sortOrder: 4,
  },
  PRICING_VAT: {
    label: 'VAT Tax',
    description: 'Configurable VAT rates for trader services and platform fees.',
    sortOrder: 5,
  },
};

/**
 * Every key here must be read by backend logic via getPlatformSetting().
 * Add a new admin-managed setting by adding an entry and reading it where needed.
 */
export const PLATFORM_SETTING_DEFINITIONS = {
  'site_visit.default_fee': {
    group: 'SITE_VISIT',
    label: 'Default Site Visit Fee',
    description:
      'Used for new jobs when a sub-category has site visit enabled but no site visit fee of its own. Sub-category fee always takes priority.',
    type: 'number',
    defaultValue: 0,
    min: 0,
    max: 100000,
    unit: 'CURRENCY',
    sortOrder: 1,
  },
  'site_visit.booking_window_days': {
    group: 'SITE_VISIT',
    label: 'Site Visit Booking Window',
    description: 'Number of upcoming days a trader can choose from when requesting a site visit.',
    type: 'integer',
    defaultValue: 14,
    min: 1,
    max: 90,
    unit: 'DAYS',
    sortOrder: 2,
  },
  'jobs.default_discover_radius_km': {
    group: 'JOBS',
    label: 'Default Discover Radius',
    description:
      'Radius used for Discover jobs and new-job alerts when a trader has not set their own service radius.',
    type: 'integer',
    defaultValue: 50,
    min: 1,
    max: 1000,
    unit: 'KM',
    sortOrder: 1,
  },

  // ---------------------------------------------------------------------------
  // Pricing: BRISK Platform Fees
  // ---------------------------------------------------------------------------
  'pricing.platform_fee.type': {
    group: 'PRICING_FEES',
    label: 'Platform Fee Type',
    description: 'Calculate platform fee as a percentage of trader net or as a fixed amount (PERCENTAGE | FIXED).',
    type: 'string',
    defaultValue: 'PERCENTAGE',
    sortOrder: 1,
  },
  'pricing.platform_fee.percentage': {
    group: 'PRICING_FEES',
    label: 'Platform Fee Percentage',
    description: 'Percentage of trader net charged as platform fee when type is PERCENTAGE (e.g. 10.0 for 10%).',
    type: 'number',
    defaultValue: 10.0,
    min: 0,
    max: 100,
    sortOrder: 2,
  },
  'pricing.platform_fee.fixed_eur': {
    group: 'PRICING_FEES',
    label: 'Fixed Platform Fee (EUR)',
    description: 'Fixed platform fee amount charged for EUR jobs when type is FIXED.',
    type: 'number',
    defaultValue: 10.0,
    min: 0,
    max: 100000,
    unit: 'CURRENCY',
    sortOrder: 3,
  },
  'pricing.platform_fee.fixed_gbp': {
    group: 'PRICING_FEES',
    label: 'Fixed Platform Fee (GBP)',
    description: 'Fixed platform fee amount charged for GBP jobs when type is FIXED.',
    type: 'number',
    defaultValue: 8.5,
    min: 0,
    max: 100000,
    unit: 'CURRENCY',
    sortOrder: 4,
  },

  // ---------------------------------------------------------------------------
  // Pricing: BRISK Loyalty Points
  // ---------------------------------------------------------------------------
  'pricing.loyalty.points_per_eur': {
    group: 'PRICING_LOYALTY',
    label: 'Loyalty Points Earned per EUR',
    description: 'Number of BRISK loyalty points earned per 1 EUR on completed jobs (e.g. 1 EUR = 10 points).',
    type: 'integer',
    defaultValue: 10,
    min: 0,
    max: 10000,
    sortOrder: 1,
  },
  'pricing.loyalty.points_per_gbp': {
    group: 'PRICING_LOYALTY',
    label: 'Loyalty Points Earned per GBP',
    description: 'Number of BRISK loyalty points earned per 1 GBP on completed jobs (e.g. 1 GBP = 12 points).',
    type: 'integer',
    defaultValue: 12,
    min: 0,
    max: 10000,
    sortOrder: 2,
  },

  // ---------------------------------------------------------------------------
  // Pricing: VAT Tax Configuration
  // ---------------------------------------------------------------------------
  'pricing.vat.trader_standard_rate': {
    group: 'PRICING_VAT',
    label: 'Trader Standard Reduced VAT Rate (%)',
    description: 'Standard VAT percentage applied to VAT-registered trader services in Ireland (e.g. 13.5%).',
    type: 'number',
    defaultValue: 13.5,
    min: 0,
    max: 100,
    sortOrder: 1,
  },
  'pricing.vat.trader_two_thirds_rate': {
    group: 'PRICING_VAT',
    label: 'Trader Two-Thirds Rule Standard VAT Rate (%)',
    description: 'Standard VAT percentage applied when materials exceed 2/3 of total cost in Ireland (e.g. 23.0%).',
    type: 'number',
    defaultValue: 23.0,
    min: 0,
    max: 100,
    sortOrder: 2,
  },
  'pricing.vat.platform_fee_rate': {
    group: 'PRICING_VAT',
    label: 'Platform Fee VAT Rate (%)',
    description: 'Standard VAT percentage applied to Brisk platform fee in Ireland (e.g. 23.0%).',
    type: 'number',
    defaultValue: 23.0,
    min: 0,
    max: 100,
    sortOrder: 3,
  },
  'pricing.vat.uk_standard_rate': {
    group: 'PRICING_VAT',
    label: 'UK Standard VAT Rate (%)',
    description: 'Standard VAT percentage applied to UK/GBP services and platform fees (e.g. 20.0%).',
    type: 'number',
    defaultValue: 20.0,
    min: 0,
    max: 100,
    sortOrder: 4,
  },
} as const satisfies Record<string, PlatformSettingDefinition>;

export type PlatformSettingKey = keyof typeof PLATFORM_SETTING_DEFINITIONS;

type Widen<T> = T extends number ? number : T extends boolean ? boolean : string;
export type PlatformSettingValue<K extends PlatformSettingKey> = Widen<
  (typeof PLATFORM_SETTING_DEFINITIONS)[K]['defaultValue']
>;

export const isPlatformSettingKey = (key: string): key is PlatformSettingKey =>
  Object.prototype.hasOwnProperty.call(PLATFORM_SETTING_DEFINITIONS, key);

export const getPlatformSettingDefinition = (key: PlatformSettingKey): PlatformSettingDefinition =>
  PLATFORM_SETTING_DEFINITIONS[key];
