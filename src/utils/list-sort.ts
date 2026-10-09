import { z } from 'zod';

export type SortDir = 'asc' | 'desc';

/** `sortOrder=asc|desc` (case-insensitive). */
export const sortOrderParam = z.string().trim().toLowerCase().pipe(z.enum(['asc', 'desc'])).optional();

/** `sortBy=<one of fields>`; unknown values are rejected with the allowed list. */
export const sortByParam = <T extends readonly [string, ...string[]]>(fields: T) =>
  z
    .string()
    .trim()
    .pipe(
      z.enum(fields as unknown as [T[number], ...T[number][]], {
        errorMap: () => ({ message: `sortBy must be one of: ${fields.join(', ')}` }),
      })
    )
    .optional();

export const resolveSortDir = (sortOrder?: string, fallback: SortDir = 'desc'): SortDir =>
  sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : fallback;

/**
 * Whitelisted `sortBy` → Prisma `orderBy[]`. Always ends with `tiebreak` (a unique column)
 * so offset pagination never repeats or skips rows when sort values are equal.
 */
export const buildListOrderBy = <O>(
  sortBy: string | undefined,
  sortOrder: string | undefined,
  map: Record<string, (dir: SortDir) => O | O[]>,
  fallback: { sortBy: string; sortOrder: SortDir },
  tiebreak: O
): O[] => {
  const key = sortBy && map[sortBy] ? sortBy : fallback.sortBy;
  const dir = sortBy && map[sortBy] ? resolveSortDir(sortOrder) : fallback.sortOrder;
  const primary = map[key](dir);
  return [...(Array.isArray(primary) ? primary : [primary]), tiebreak];
};

/** Compare helper for in-memory sorts of computed columns (nulls always last). */
export const compareValues = (a: unknown, b: unknown, dir: SortDir): number => {
  const aNull = a === null || a === undefined || a === '';
  const bNull = b === null || b === undefined || b === '';
  if (aNull || bNull) return aNull === bNull ? 0 : aNull ? 1 : -1;
  const result =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
  return dir === 'asc' ? result : -result;
};

/**
 * Ids of one page, ranked on a computed column (newest first, then id, on ties).
 * For columns Prisma cannot ORDER BY (COALESCE, optional relations, derived values).
 */
export const pageIdsByComputedKey = <R extends { id: string; createdAt: Date }>(
  rows: R[],
  keyOf: (row: R) => unknown,
  dir: SortDir,
  skip: number,
  take: number
): string[] =>
  rows
    .map((row) => ({ row, key: keyOf(row) }))
    .sort(
      (a, b) =>
        compareValues(a.key, b.key, dir) ||
        b.row.createdAt.getTime() - a.row.createdAt.getTime() ||
        a.row.id.localeCompare(b.row.id)
    )
    .slice(skip, skip + take)
    .map(({ row }) => row.id);
