import { z } from 'zod';

/** ISO date (`2026-09-01`) or datetime. Date-only `to` is treated as end of that UTC day. */
export const isoDateParam = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), {
    message: 'Must be a valid ISO date or datetime (e.g. 2026-09-01 or 2026-09-01T00:00:00.000Z).',
  })
  .optional();

/** `true` / `false` query flag. */
export const boolParam = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === true || v === 'true'));

export const amountParam = z.coerce.number().min(0).optional();

const boundary = (value: string | undefined, endOfDay: boolean): Date | undefined => {
  if (!value?.trim()) return undefined;
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(endOfDay ? `${raw}T23:59:59.999Z` : `${raw}T00:00:00.000Z`);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/** Inclusive Prisma DateTime filter, or undefined when neither bound is set. */
export const dateRangeWhere = (from?: string, to?: string) => {
  const gte = boundary(from, false);
  const lte = boundary(to, true);
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
};

/** Inclusive numeric range filter, or undefined when neither bound is set. */
export const numberRangeWhere = (min?: number, max?: number) => {
  if (min === undefined && max === undefined) return undefined;
  return { ...(min !== undefined ? { gte: min } : {}), ...(max !== undefined ? { lte: max } : {}) };
};

/** Zod refinement: `min` must not exceed `max`. */
export const minLteMax =
  (minKey: string, maxKey: string) =>
  (q: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const min = q[minKey];
    const max = q[maxKey];
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${minKey} cannot be greater than ${maxKey}.`, path: [minKey] });
    }
  };
