import { OfferStatus, OfferType } from '@prisma/client';
import { prisma } from '../../../config/database';
import { ForbiddenError, NotFoundError } from '../../../utils/errors';
import { offerInclude, serializeOffer } from '../../offers/offers.serializers';
import { buildOfferWhere, normalizeOfferListFilters } from '../../offers/offers.query';
import { createOfferRecord, loadOffer, updateOfferRecord, type OfferWriteInput } from '../../offers/offers.mutations';

const requireTrader = async (userId: string) => {
  const trader = await prisma.trader.findUnique({
    where: { userId },
    select: { id: true, status: true, verificationStatus: true, onboardingStatus: true },
  });
  if (!trader) {
    throw new NotFoundError('Trader profile not found.');
  }
  return trader;
};

export const listMyOffers = async (userId: string, query: Record<string, unknown>) => {
  const trader = await requireTrader(userId);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
  const skip = (page - 1) * limit;
  const where = {
    AND: [
      { traderId: trader.id, offerType: OfferType.TRADER },
      buildOfferWhere(normalizeOfferListFilters(query)),
    ],
  };

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

export const getMyOffer = async (userId: string, id: string) => {
  const trader = await requireTrader(userId);
  const offer = await prisma.offer.findFirst({
    where: { id, traderId: trader.id },
    include: offerInclude,
  });
  if (!offer) {
    throw new NotFoundError('Offer not found.');
  }
  return serializeOffer(offer);
};

export const createMyOffer = async (userId: string, body: OfferWriteInput) => {
  const trader = await requireTrader(userId);
  return createOfferRecord({
    offerType: OfferType.TRADER,
    traderId: trader.id,
    body,
  });
};

export const updateMyOffer = async (userId: string, id: string, body: Partial<OfferWriteInput>) => {
  const trader = await requireTrader(userId);
  const existing = await prisma.offer.findFirst({ where: { id, traderId: trader.id } });
  if (!existing) {
    throw new NotFoundError('Offer not found.');
  }
  if (existing.offerType !== OfferType.TRADER) {
    throw new ForbiddenError('Platform offers can only be edited by admin.');
  }
  return updateOfferRecord(id, { ...body, traderId: trader.id });
};

export const updateMyOfferStatus = async (userId: string, id: string, status: OfferStatus) => {
  const trader = await requireTrader(userId);
  const existing = await prisma.offer.findFirst({ where: { id, traderId: trader.id } });
  if (!existing) {
    throw new NotFoundError('Offer not found.');
  }
  await prisma.offer.update({ where: { id }, data: { status } });
  return loadOffer(id);
};
