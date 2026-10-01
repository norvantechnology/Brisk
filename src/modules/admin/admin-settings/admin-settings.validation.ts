import { z } from 'zod';
import { PLATFORM_SETTING_GROUPS, PlatformSettingGroup } from '../../settings/platform-settings.registry';

const groupKeys = Object.keys(PLATFORM_SETTING_GROUPS) as [
  PlatformSettingGroup,
  ...PlatformSettingGroup[],
];

export const listPlatformSettingsSchema = z.object({
  query: z.object({
    group: z.enum(groupKeys).optional(),
  }),
});

export const platformSettingKeyParamsSchema = z.object({
  params: z.object({ key: z.string().trim().min(1) }),
});

export const updatePlatformSettingsSchema = z.object({
  body: z.object({
    settings: z
      .record(z.string(), z.union([z.number(), z.boolean(), z.string(), z.null()]))
      .refine((s) => Object.keys(s).length > 0, { message: 'At least one setting is required.' }),
  }),
});
