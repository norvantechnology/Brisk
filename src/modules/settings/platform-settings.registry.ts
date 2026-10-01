export type PlatformSettingType = 'number' | 'integer' | 'boolean' | 'string';
export type PlatformSettingUnit = 'CURRENCY' | 'KM' | 'DAYS';
export type PlatformSettingGroup = 'SITE_VISIT' | 'JOBS';

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
