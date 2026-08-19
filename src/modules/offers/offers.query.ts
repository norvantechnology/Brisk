import { DiscountType, OfferStatus, OfferType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export const nextOfferCode = async () => {
  const count = await prisma.offer.count();
  return `OFF-${(count + 1001).toString()}`;
};

export const parseIdList = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => parseIdList(item));
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export const dateRangeBounds = (filters: {
  dateRange?: string;
  from?: string;
  to?: string;
}) => {
  const now = new Date();
  const startOfDay = (date: Date) => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };
  const endOfDay = (date: Date) => {
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy;
  };

  if (!filters.dateRange) return null;

  if (filters.dateRange === 'today') {
    return { start: startOfDay(now), end: endOfDay(now) };
  }
  if (filters.dateRange === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
  }
  if (filters.dateRange === 'last_7_days') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { start: startOfDay(start), end: endOfDay(now) };
  }
  if (filters.dateRange === 'last_30_days') {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    return { start: startOfDay(start), end: endOfDay(now) };
  }
  if (filters.dateRange === 'custom' && filters.from && filters.to) {
    return { start: startOfDay(new Date(filters.from)), end: endOfDay(new Date(filters.to)) };
  }
  return null;
};

/** Maps Brisk.md filter modal params (snake_case) plus admin camelCase aliases. */
export const normalizeOfferListFilters = (
  query: Record<string, unknown>,
  options?: { forceOfferType?: OfferType; publicOnly?: boolean }
) => {
  const dateRange = (query.dateRange ?? query.date_range) as string | undefined;
  const traderId = (query.traderId ?? query.trader_id ?? query.traderIds ?? query.trader_ids) as
    | string
    | string[]
    | undefined;
  const categoryId = (query.categoryId ?? query.category_id) as string | string[] | undefined;
  const subcategoryId = (query.subcategoryId ?? query.subcategory_id) as string | string[] | undefined;
  const rawDiscount =
    query.discountType ??
    query.offer_type ??
    (options?.publicOnly ? query.offerType : undefined);

  let discountType: string | undefined;
  if (typeof rawDiscount === 'string') {
    discountType = rawDiscount;
  }

  const adminType = query.offerType;
  const offerType =
    options?.forceOfferType ??
    (adminType === 'PLATFORM' || adminType === 'TRADER' ? (adminType as OfferType) : undefined);

  return {
    search: typeof query.search === 'string' ? query.search : undefined,
    offerType,
    status: typeof query.status === 'string' ? query.status : undefined,
    categoryId,
    subcategoryId,
    traderId,
    discountType,
    dateRange,
    from: (query.from as string | undefined) ?? undefined,
    to: (query.to as string | undefined) ?? undefined,
    publicOnly: options?.publicOnly,
  };
};

export const buildOfferWhere = (filters: {
  search?: string;
  offerType?: string;
  status?: string;
  categoryId?: string | string[];
  subcategoryId?: string | string[];
  traderId?: string | string[];
  discountType?: string;
  dateRange?: string;
  from?: string;
  to?: string;
  publicOnly?: boolean;
}): Prisma.OfferWhereInput => {
  const and: Prisma.OfferWhereInput[] = [];

  if (filters.search) {
    const search = filters.search.trim();
    and.push({
      OR: [
        { offerCode: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { couponCode: { contains: search, mode: 'insensitive' } },
        { trader: { businessName: { contains: search, mode: 'insensitive' } } },
        { trader: { user: { fullName: { contains: search, mode: 'insensitive' } } } },
      ],
    });
  }

  if (filters.offerType === 'PLATFORM' || filters.offerType === 'TRADER') {
    and.push({ offerType: filters.offerType as OfferType });
  }

  if (filters.publicOnly) {
    and.push({ status: OfferStatus.ACTIVE });
    and.push({ validFrom: { lte: new Date() } });
    and.push({ validUntil: { gte: new Date() } });
  } else if (filters.status === 'DISABLED') {
    and.push({ status: OfferStatus.DISABLED });
  } else if (filters.status === 'EXPIRED') {
    and.push({
      OR: [
        { status: OfferStatus.EXPIRED },
        { status: OfferStatus.ACTIVE, validUntil: { lt: new Date() } },
      ],
    });
  } else if (filters.status === 'ACTIVE') {
    and.push({ status: OfferStatus.ACTIVE });
    and.push({ validUntil: { gte: new Date() } });
  }

  if (filters.discountType === 'percentage' || filters.discountType === 'PERCENTAGE') {
    and.push({ discountType: DiscountType.PERCENTAGE });
  }
  if (filters.discountType === 'flat_amount' || filters.discountType === 'FLAT') {
    and.push({ discountType: DiscountType.FLAT });
  }
  if (filters.discountType === 'FREE_SERVICE' || filters.discountType === 'free_visit') {
    and.push({ discountType: DiscountType.FREE_SERVICE });
  }

  const categoryIds = parseIdList(filters.categoryId);
  if (categoryIds.length) {
    and.push({ categories: { some: { categoryId: { in: categoryIds } } } });
  }

  const subcategoryIds = parseIdList(filters.subcategoryId);
  if (subcategoryIds.length) {
    and.push({ subcategories: { some: { subcategoryId: { in: subcategoryIds } } } });
  }

  const traderIds = parseIdList(filters.traderId);
  if (traderIds.length) {
    and.push({ traderId: { in: traderIds } });
  }

  const range = dateRangeBounds(filters);
  if (range) {
    and.push({ validFrom: { lte: range.end } });
    and.push({ validUntil: { gte: range.start } });
  }

  return and.length ? { AND: and } : {};
};
