import { prisma } from '../../config/database';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../utils/errors';
import type { UpdateTraderProfileInput } from './traders.validation';

export const getTraderProfile = async (userId: string) => {
  const trader = await prisma.trader.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          mobileNumber: true,
          profilePhotoUrl: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          categoryCode: true,
        },
      },
    },
  });

  if (!trader) {
    throw new NotFoundError('Trader profile not found.');
  }

  return {
    id: trader.id,
    traderCode: trader.traderCode,
    traderType: trader.traderType,
    businessName: trader.businessName,
    bio: trader.bio,
    profilePhotoUrl: trader.profilePhotoUrl ?? trader.user.profilePhotoUrl,
    coverImageUrl: trader.coverImageUrl,
    yearsExperience: trader.yearsExperience,
    jobsDoneCount: trader.jobsDoneCount,
    avgRating: Number(trader.avgRating),
    topRated: trader.topRated,
    verificationStatus: trader.verificationStatus,
    status: trader.status,
    serviceRadius: trader.serviceRadius,
    category: trader.category,
    user: trader.user,
  };
};

export const updateTraderProfile = async (userId: string, input: UpdateTraderProfileInput) => {
  const trader = await prisma.trader.findUnique({ where: { userId } });
  if (!trader) {
    throw new NotFoundError('Trader profile not found.');
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      throw new BadRequestError('Selected category does not exist.');
    }
  }

  const updatedTrader = await prisma.trader.update({
    where: { userId },
    data: {
      traderType: input.traderType,
      businessName: input.traderType === 'SOLO' ? null : input.businessName,
      bio: input.bio,
      profilePhotoUrl: input.profilePhotoUrl,
      coverImageUrl: input.coverImageUrl,
      yearsExperience: input.yearsExperience,
      serviceRadius: input.serviceRadius,
      categoryId: input.categoryId,
    },
    include: {
      category: {
        select: { id: true, name: true, categoryCode: true },
      },
    },
  });

  return updatedTrader;
};

export const ensureTraderProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'TRADER') {
    throw new ForbiddenError('Trader profile is only available for trader accounts.');
  }
};
