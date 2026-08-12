export type PaginationQuery = {
  page?: string | number;
  limit?: string | number;
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  items: T[];
  meta: PaginationMeta;
};

export const parsePageLimit = (
  query: PaginationQuery,
  options: { defaultLimit?: number; maxLimit?: number } = {}
): { page: number; limit: number; skip: number } => {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 100;

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(maxLimit, Number(query.limit) || defaultLimit));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number
): PaginationMeta => ({
  total,
  page,
  limit,
  totalPages: total === 0 ? 0 : Math.ceil(total / limit),
});
