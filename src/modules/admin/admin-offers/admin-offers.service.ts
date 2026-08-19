import { OfferClaimStatus, OfferStatus, OfferType } from '@prisma/client';
import { prisma } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
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

export const listOffers = async (filters: Record<string, unknown>) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;
  const where = buildOfferWhere(normalizeOfferListFilters(filters));

  const [total, offers] = await Promise.all([
    prisma.offer.count({ where }),
    prisma.offer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: offerInclude,
    }),
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
