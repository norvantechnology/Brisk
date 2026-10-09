import { OfferClaimStatus, OfferStatus, OfferType, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import { buildListOrderBy, pageIdsByComputedKey, resolveSortDir, type SortDir } from '../../../utils/list-sort';
import { offerInclude, serializeOffer } from '../../offers/offers.serializers';
import { buildOfferWhere, normalizeOfferListFilters } from '../../offers/offers.query';
import {
  createOfferRecord,
  loadOffer,
  updateOfferRecord,
  writeOfferAudit,
  type OfferWriteInput,
} from '../../offers/offers.mutations';

export const getOfferStats = async () => {
  const now = new Date();
  const [total, platform, trader, active, expired, disabled, claims, used, revenue] = await Promise.all([
    prisma.offer.count(),
    prisma.offer.count({ where: { offerType: OfferType.PLATFORM } }),
    prisma.offer.count({ where: { offerType: OfferType.TRADER } }),
    prisma.offer.count({
      where: { status: OfferStatus.ACTIVE, validUntil: { gte: now } },
    }),
    prisma.offer.count({
      where: {
        OR: [
          { status: OfferStatus.EXPIRED },
          { status: OfferStatus.ACTIVE, validUntil: { lt: now } },
        ],
      },
    }),
    prisma.offer.count({ where: { status: OfferStatus.DISABLED } }),
    prisma.offerClaim.count(),
    prisma.offerClaim.count({ where: { status: OfferClaimStatus.USED } }),
    prisma.offer.aggregate({ _sum: { revenueGenerated: true } }),
  ]);

  const conversion = claims > 0 ? Number(((used / claims) * 100).toFixed(2)) : 0;

  return {
    totalOffers: total,
    platformOffers: platform,
    traderOffers: trader,
    activeOffers: active,
    expiredOffers: expired,
    disabledOffers: disabled,
    totalClaims: claims,
    usedClaims: used,
    unusedClaims: Math.max(claims - used, 0),
    revenueGenerated: Number(revenue._sum.revenueGenerated ?? 0),
    avgConversionPercent: conversion,
  };
};

const OFFER_SORT_MAP: Record<string, (dir: SortDir) => Prisma.OfferOrderByWithRelationInput> = {
  offerCode: (dir) => ({ offerCode: dir }),
  title: (dir) => ({ title: dir }),
  offerType: (dir) => ({ offerType: dir }),
  couponCode: (dir) => ({ couponCode: { sort: dir, nulls: 'last' } }),
  discountType: (dir) => ({ discountType: dir }),
  discountValue: (dir) => ({ discountValue: dir }),
  validFrom: (dir) => ({ validFrom: dir }),
  validUntil: (dir) => ({ validUntil: dir }),
  claimsCount: (dir) => ({ claims: { _count: dir } }),
  revenueGenerated: (dir) => ({ revenueGenerated: dir }),
  viewsCount: (dir) => ({ viewsCount: dir }),
  createdAt: (dir) => ({ createdAt: dir }),
  updatedAt: (dir) => ({ updatedAt: dir }),
};

/** `status` is the effective status (ACTIVE past validUntil = EXPIRED); names come from optional relations. */
const COMPUTED_OFFER_SORTS: Record<
  string,
  (row: {
    status: OfferStatus;
    validUntil: Date;
    trader: { businessName: string | null; user: { fullName: string } } | null;
    categories: { category: { name: string } }[];
  }) => unknown
> = {
  status: (r) => (r.status === OfferStatus.ACTIVE && r.validUntil < new Date() ? OfferStatus.EXPIRED : r.status),
  traderName: (r) => (r.trader ? r.trader.businessName || r.trader.user.fullName : null),
  categoryName: (r) => r.categories[0]?.category.name ?? null,
};

/** One page of offers sorted by any admin offer column (Offers screen + Trader Details → Offers). */
export const findOfferPage = async (
  where: Prisma.OfferWhereInput,
  sortBy: string | undefined,
  sortOrder: string | undefined,
  skip: number,
  take: number,
  fallbackSortOrder: SortDir = 'desc'
) => {
  const computedKey = sortBy ? COMPUTED_OFFER_SORTS[sortBy] : undefined;
  if (computedKey) {
    const candidates = await prisma.offer.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        status: true,
        validUntil: true,
        trader: { select: { businessName: true, user: { select: { fullName: true } } } },
        categories: { take: 1, select: { category: { select: { name: true } } } },
      },
    });
    const ids = pageIdsByComputedKey(candidates, computedKey, resolveSortDir(sortOrder), skip, take);
    const rows = await prisma.offer.findMany({ where: { id: { in: ids } }, include: offerInclude });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)!).filter(Boolean);
  }
  return prisma.offer.findMany({
    where,
    skip,
    take,
    orderBy: buildListOrderBy(sortBy, sortOrder, OFFER_SORT_MAP, { sortBy: 'createdAt', sortOrder: fallbackSortOrder }, { id: 'asc' }),
    include: offerInclude,
  });
};

export const listOffers = async (filters: Record<string, unknown>) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;
  const where = buildOfferWhere(normalizeOfferListFilters(filters));

  const [total, offers] = await Promise.all([
    prisma.offer.count({ where }),
    findOfferPage(where, filters.sortBy as string | undefined, filters.sortOrder as string | undefined, skip, limit),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    offers: offers.map(serializeOffer),
  };
};

export const getOfferById = async (id: string) => loadOffer(id);

export const createPlatformOffer = async (
  adminId: string,
  adminLabel: string,
  body: OfferWriteInput
) => {
  const offer = await createOfferRecord({
    offerType: OfferType.PLATFORM,
    createdById: adminId,
    traderId: body.traderId ?? null,
    body,
  });
  await writeOfferAudit(adminId, adminLabel, 'OFFER_CREATED', offer.id, `Created platform offer "${offer.title}" (${offer.offerCode}).`);
  return offer;
};

export const updateOffer = async (
  adminId: string,
  adminLabel: string,
  id: string,
  body: Partial<OfferWriteInput>
) => {
  const offer = await updateOfferRecord(id, body);
  await writeOfferAudit(adminId, adminLabel, 'OFFER_UPDATED', id, `Updated offer "${offer.title}" (${offer.offerCode}).`);
  return offer;
};

export const updateOfferStatus = async (
  adminId: string,
  adminLabel: string,
  id: string,
  status: OfferStatus
) => {
  const existing = await prisma.offer.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Offer not found.');
  }
  await prisma.offer.update({ where: { id }, data: { status } });
  await writeOfferAudit(adminId, adminLabel, 'OFFER_STATUS_UPDATED', id, `Offer ${existing.offerCode} status set to ${status}.`);
  return loadOffer(id);
};

export const getOfferAnalytics = async () => {
  const stats = await getOfferStats();
  const offers = await prisma.offer.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      ...offerInclude,
      claims: { select: { status: true } },
    },
  });

  const breakdown = offers.map((offer) => {
    const used = offer.claims.filter((claim) => claim.status === OfferClaimStatus.USED).length;
    const claims = offer.claims.length;
    const serialized = serializeOffer(offer);
    return {
      ...serialized,
      usedCount: used,
      unusedCount: Math.max(claims - used, 0),
      discountGiven:
        serialized.discountType === 'FLAT' ? Number((used * serialized.discountValue).toFixed(2)) : used,
    };
  });

  return { kpis: stats, offers: breakdown };
};
