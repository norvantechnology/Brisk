import { ActorType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { getBaseCurrencyCode } from '../../services/currency.service';
import {
  PLATFORM_SETTING_DEFINITIONS,
  PLATFORM_SETTING_GROUPS,
  PlatformSettingDefinition,
  PlatformSettingGroup,
  PlatformSettingKey,
  PlatformSettingValue,
  getPlatformSettingDefinition,
  isPlatformSettingKey,
} from './platform-settings.registry';

const REFRESH_INTERVAL_MS = 60_000;

const cache = new Map<PlatformSettingKey, number | boolean | string>();
let refreshTimer: NodeJS.Timeout | null = null;

type ValidationResult =
  | { ok: true; value: number | boolean | string }
  | { ok: false; message: string };

const validateSettingValue = (
  def: PlatformSettingDefinition,
  raw: unknown
): ValidationResult => {
  switch (def.type) {
    case 'number':
    case 'integer': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return { ok: false, message: 'Must be a number.' };
      }
      if (def.type === 'integer' && !Number.isInteger(raw)) {
        return { ok: false, message: 'Must be a whole number.' };
      }
      if (def.min != null && raw < def.min) {
        return { ok: false, message: `Must be at least ${def.min}.` };
      }
      if (def.max != null && raw > def.max) {
        return { ok: false, message: `Must be at most ${def.max}.` };
      }
      return { ok: true, value: def.type === 'number' ? Math.round(raw * 100) / 100 : raw };
    }
    case 'boolean':
      return typeof raw === 'boolean'
        ? { ok: true, value: raw }
        : { ok: false, message: 'Must be true or false.' };
    case 'string': {
      if (typeof raw !== 'string') return { ok: false, message: 'Must be a string.' };
      const value = raw.trim();
      if (def.maxLength != null && value.length > def.maxLength) {
        return { ok: false, message: `Must be at most ${def.maxLength} characters.` };
      }
      return { ok: true, value };
    }
    default:
      return { ok: false, message: 'Unsupported setting type.' };
  }
};

export const loadPlatformSettings = async (): Promise<void> => {
  try {
    const rows = await prisma.platformSetting.findMany({ select: { key: true, value: true } });
    const next = new Map<PlatformSettingKey, number | boolean | string>();
    for (const row of rows) {
      if (!isPlatformSettingKey(row.key)) continue;
      const result = validateSettingValue(getPlatformSettingDefinition(row.key), row.value);
      if (result.ok) {
        next.set(row.key, result.value);
      } else {
        logger.warn(`Platform setting "${row.key}" has invalid stored value; using default.`);
      }
    }
    cache.clear();
    next.forEach((value, key) => cache.set(key, value));
  } catch (error) {
    logger.error('Failed to load platform settings; keeping previous values.', error);
  }
};

export const startPlatformSettingsSync = async (): Promise<void> => {
  await loadPlatformSettings();
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    void loadPlatformSettings();
  }, REFRESH_INTERVAL_MS);
  refreshTimer.unref();
};

/** Effective value (admin override or code default). Sync so pricing/serializer helpers can use it. */
export const getPlatformSetting = <K extends PlatformSettingKey>(key: K): PlatformSettingValue<K> =>
  (cache.has(key)
    ? cache.get(key)
    : PLATFORM_SETTING_DEFINITIONS[key].defaultValue) as PlatformSettingValue<K>;

type StoredRow = {
  key: string;
  updatedAt: Date;
  updatedBy: { id: string; fullName: string } | null;
};

const serializeSetting = (key: PlatformSettingKey, row?: StoredRow) => {
  const def = getPlatformSettingDefinition(key);
  const value = getPlatformSetting(key);
  return {
    key,
    group: def.group,
    label: def.label,
    description: def.description,
    type: def.type,
    unit: def.unit ?? null,
    min: def.min ?? null,
    max: def.max ?? null,
    maxLength: def.maxLength ?? null,
    defaultValue: def.defaultValue,
    value,
    isDefault: !cache.has(key),
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
};

const loadStoredRows = async (keys?: PlatformSettingKey[]) => {
  const rows = await prisma.platformSetting.findMany({
    where: keys ? { key: { in: keys } } : undefined,
    select: {
      key: true,
      updatedAt: true,
      updatedBy: { select: { id: true, fullName: true } },
    },
  });
  return new Map(rows.map((r) => [r.key, r]));
};

const orderedKeys = (group?: PlatformSettingGroup) =>
  (Object.keys(PLATFORM_SETTING_DEFINITIONS) as PlatformSettingKey[])
    .filter((key) => !group || PLATFORM_SETTING_DEFINITIONS[key].group === group)
    .sort((a, b) => {
      const da = getPlatformSettingDefinition(a);
      const db = getPlatformSettingDefinition(b);
      return (
        PLATFORM_SETTING_GROUPS[da.group].sortOrder - PLATFORM_SETTING_GROUPS[db.group].sortOrder ||
        da.sortOrder - db.sortOrder
      );
    });

export const listPlatformSettings = async (filters: { group?: PlatformSettingGroup } = {}) => {
  const keys = orderedKeys(filters.group);
  const [stored, currencyCode] = await Promise.all([loadStoredRows(keys), getBaseCurrencyCode()]);

  const groups = new Map<PlatformSettingGroup, ReturnType<typeof serializeSetting>[]>();
  for (const key of keys) {
    const item = serializeSetting(key, stored.get(key));
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }

  return {
    currencyCode,
    groups: [...groups.entries()].map(([group, settings]) => ({
      key: group,
      label: PLATFORM_SETTING_GROUPS[group].label,
      description: PLATFORM_SETTING_GROUPS[group].description,
      settings,
    })),
  };
};

const assertKey = (key: string): PlatformSettingKey => {
  if (!isPlatformSettingKey(key)) {
    throw new NotFoundError('Setting not found.', { code: 'SETTING_NOT_FOUND' });
  }
  return key;
};

export const getPlatformSettingDetail = async (rawKey: string) => {
  const key = assertKey(rawKey);
  const [stored, currencyCode] = await Promise.all([loadStoredRows([key]), getBaseCurrencyCode()]);
  return { currencyCode, setting: serializeSetting(key, stored.get(key)) };
};

const formatForAudit = (value: unknown) => JSON.stringify(value);

/** `null` value resets that key to its default. */
export const updatePlatformSettings = async (
  updates: Record<string, unknown>,
  admin: { id: string; fullName: string }
) => {
  const errors: Array<{ key: string; message: string }> = [];
  const upserts: Array<{ key: PlatformSettingKey; value: number | boolean | string }> = [];
  const resets: PlatformSettingKey[] = [];

  for (const [key, raw] of Object.entries(updates)) {
    if (!isPlatformSettingKey(key)) {
      errors.push({ key, message: 'Unknown setting key.' });
      continue;
    }
    if (raw === null) {
      resets.push(key);
      continue;
    }
    const result = validateSettingValue(getPlatformSettingDefinition(key), raw);
    if (result.ok) upserts.push({ key, value: result.value });
    else errors.push({ key, message: result.message });
  }

  if (errors.length) {
    throw new BadRequestError('Some settings are invalid.', {
      code: 'INVALID_SETTINGS',
      data: { errors },
    });
  }

  const auditEntries = [
    ...upserts
      .filter(({ key, value }) => getPlatformSetting(key) !== value || !cache.has(key))
      .map(({ key, value }) => ({
        key,
        description: `Updated setting "${getPlatformSettingDefinition(key).label}" (${key}) from ${formatForAudit(getPlatformSetting(key))} to ${formatForAudit(value)}.`,
      })),
    ...resets
      .filter((key) => cache.has(key))
      .map((key) => ({
        key,
        description: `Reset setting "${getPlatformSettingDefinition(key).label}" (${key}) to default ${formatForAudit(getPlatformSettingDefinition(key).defaultValue)}.`,
      })),
  ];

  await prisma.$transaction([
    ...upserts.map(({ key, value }) =>
      prisma.platformSetting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue, updatedById: admin.id },
        update: { value: value as Prisma.InputJsonValue, updatedById: admin.id },
      })
    ),
    ...(resets.length
      ? [prisma.platformSetting.deleteMany({ where: { key: { in: resets } } })]
      : []),
    ...auditEntries.map((entry) =>
      prisma.auditLog.create({
        data: {
          eventType: 'PLATFORM_SETTING_UPDATED',
          actorType: ActorType.ADMIN,
          actorId: admin.id,
          actorLabel: admin.fullName,
          subjectType: 'PlatformSetting',
          subjectId: entry.key,
          description: entry.description,
        },
      })
    ),
  ]);

  await loadPlatformSettings();
  return listPlatformSettings();
};

export const resetPlatformSetting = async (
  rawKey: string,
  admin: { id: string; fullName: string }
) => {
  const key = assertKey(rawKey);
  await updatePlatformSettings({ [key]: null }, admin);
  return getPlatformSettingDetail(key);
};
