import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import { buildListOrderBy, type SortDir } from '../../../utils/list-sort';
import { numberRangeWhere } from '../../../utils/list-filters';

export type CreateLoyaltyOfferInput = {
  title: string;
  pointsRequired: number;
  description?: string;
  imageUrl?: string;
  status?: string;
};

export type UpdateLoyaltyOfferInput = Partial<CreateLoyaltyOfferInput>;

export type LoyaltyOfferListFilters = {
  page?: number | string;
  limit?: number | string;
  search?: string;
  status?: string;
  minPoints?: number;
  maxPoints?: number;
  sortBy?: string;
  sortOrder?: string;
};

const LOYALTY_OFFER_SORT_MAP: Record<string, (dir: SortDir) => Prisma.LoyaltyOfferOrderByWithRelationInput> = {
  title: (dir) => ({ title: dir }),
  pointsRequired: (dir) => ({ pointsRequired: dir }),
  status: (dir) => ({ status: dir }),
  redemptionsCount: (dir) => ({ redemptions: { _count: dir } }),
  createdAt: (dir) => ({ createdAt: dir }),
  updatedAt: (dir) => ({ updatedAt: dir }),
};

const serializeLoyaltyOffer = (offer: {
  id: string;
  title: string;
  pointsRequired: number;
  description: string | null;
  imageUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { redemptions: number };
}) => ({
  id: offer.id,
  title: offer.title,
  pointsRequired: offer.pointsRequired,
  description: offer.description,
  imageUrl: offer.imageUrl,
  status: offer.status,
  redemptionsCount: offer._count?.redemptions ?? 0,
  createdAt: offer.createdAt,
  updatedAt: offer.updatedAt,
});

export const listLoyaltyOffers = async (filters: LoyaltyOfferListFilters = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
  const skip = (page - 1) * limit;
  const where: Prisma.LoyaltyOfferWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search?.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const points = numberRangeWhere(filters.minPoints, filters.maxPoints);
  if (points) {
    where.pointsRequired = points;
  }

  const orderBy: Prisma.LoyaltyOfferOrderByWithRelationInput[] =
    filters.sortBy && LOYALTY_OFFER_SORT_MAP[filters.sortBy]
      ? buildListOrderBy(filters.sortBy, filters.sortOrder, LOYALTY_OFFER_SORT_MAP, { sortBy: 'createdAt', sortOrder: 'desc' }, { id: 'asc' })
      : [{ status: 'asc' }, { pointsRequired: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }];

  const [total, rows] = await Promise.all([
    prisma.loyaltyOffer.count({ where }),
    prisma.loyaltyOffer.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: { _count: { select: { redemptions: true } } },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    offers: rows.map(serializeLoyaltyOffer),
  };
};

export const getLoyaltyOffer = async (id: string) => {
  const offer = await prisma.loyaltyOffer.findUnique({
    where: { id },
    include: { _count: { select: { redemptions: true } } },
  });
  if (!offer) {
    throw new NotFoundError('Loyalty offer not found.');
  }
  return serializeLoyaltyOffer(offer);
};

export const createLoyaltyOffer = async (input: CreateLoyaltyOfferInput) => {
  const offer = await prisma.loyaltyOffer.create({
    data: {
      title: input.title.trim(),
      pointsRequired: input.pointsRequired,
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl ?? null,
      status: input.status ?? 'active',
    },
    include: { _count: { select: { redemptions: true } } },
  });
  return serializeLoyaltyOffer(offer);
};

export const updateLoyaltyOffer = async (id: string, input: UpdateLoyaltyOfferInput) => {
  await getLoyaltyOffer(id);

  const offer = await prisma.loyaltyOffer.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.pointsRequired !== undefined ? { pointsRequired: input.pointsRequired } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl ?? null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: { _count: { select: { redemptions: true } } },
  });

  return serializeLoyaltyOffer(offer);
};

export const deleteLoyaltyOffer = async (id: string) => {
  await getLoyaltyOffer(id);
  await prisma.loyaltyOffer.delete({ where: { id } });
};
