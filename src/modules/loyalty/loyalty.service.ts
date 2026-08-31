import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';

const REDEEM_VALID_DAYS = 30;

const generateRedeemCode = () => {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BRC-${Date.now().toString(36).toUpperCase()}-${suffix}`;
};

export const getOrCreateAccount = async (userId: string) => {
  const existing = await prisma.loyaltyAccount.findUnique({
    where: { userId },
  });

  if (existing) return existing;

  return prisma.loyaltyAccount.create({
    data: { userId, pointsBalance: 0 },
  });
};

export const getAccount = async (userId: string) => {
  const account = await getOrCreateAccount(userId);
  return {
    pointsBalance: account.pointsBalance,
    accountId: account.id,
  };
};

export const listLoyaltyOffers = async (userId: string) => {
  const account = await getOrCreateAccount(userId);

  const [offers, redemptions] = await Promise.all([
    prisma.loyaltyOffer.findMany({ orderBy: { pointsRequired: 'asc' } }),
    prisma.loyaltyRedemption.findMany({
      where: {
        loyaltyAccountId: account.id,
        status: { in: ['claimed', 'used'] },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const redemptionByOfferId = new Map(
    redemptions.map((row) => [row.loyaltyOfferId, row])
  );

  return {
    pointsBalance: account.pointsBalance,
    offers: offers.map((offer) => {
      const redemption = redemptionByOfferId.get(offer.id);
      return {
        id: offer.id,
        title: offer.title,
        description: offer.description,
        pointsRequired: offer.pointsRequired,
        claimed: Boolean(redemption),
        redeemCode: redemption?.redeemCode ?? null,
        validUntil: redemption?.validUntil ?? null,
        redemptionStatus: redemption?.status ?? null,
      };
    }),
  };
};

export const redeemLoyaltyOffer = async (userId: string, offerId: string) => {
  const account = await getOrCreateAccount(userId);

  const offer = await prisma.loyaltyOffer.findUnique({ where: { id: offerId } });
  if (!offer) {
    throw new NotFoundError('Loyalty offer not found.');
  }

  const existing = await prisma.loyaltyRedemption.findFirst({
    where: {
      loyaltyAccountId: account.id,
      loyaltyOfferId: offerId,
      status: { in: ['claimed', 'used'] },
    },
  });
  if (existing) {
    throw new ConflictError('You have already redeemed this loyalty offer.');
  }

  if (account.pointsBalance < offer.pointsRequired) {
    throw new BadRequestError('Insufficient BRP points for this redemption.');
  }

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + REDEEM_VALID_DAYS);
  const redeemCode = generateRedeemCode();

  const result = await prisma.$transaction(async (tx) => {
    const updatedAccount = await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: { pointsBalance: { decrement: offer.pointsRequired } },
    });

    await tx.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        pointsChange: -offer.pointsRequired,
        reason: `Redeemed loyalty offer: ${offer.title}`,
      },
    });

    const redemption = await tx.loyaltyRedemption.create({
      data: {
        loyaltyAccountId: account.id,
        loyaltyOfferId: offer.id,
        redeemCode,
        pointsSpent: offer.pointsRequired,
        validUntil,
        status: 'claimed',
      },
    });

    return { updatedAccount, redemption };
  });

  return {
    redeemCode: result.redemption.redeemCode,
    validUntil: result.redemption.validUntil,
    pointsRedeemed: offer.pointsRequired,
    pointsBalance: result.updatedAccount.pointsBalance,
    offer: {
      id: offer.id,
      title: offer.title,
      description: offer.description,
      pointsRequired: offer.pointsRequired,
    },
  };
};

export const listRedemptions = async (userId: string) => {
  const account = await getOrCreateAccount(userId);

  const redemptions = await prisma.loyaltyRedemption.findMany({
    where: { loyaltyAccountId: account.id },
    orderBy: { createdAt: 'desc' },
    include: { loyaltyOffer: true },
  });

  return {
    pointsBalance: account.pointsBalance,
    redemptions: redemptions.map((row) => ({
      id: row.id,
      redeemCode: row.redeemCode,
      pointsSpent: row.pointsSpent,
      validUntil: row.validUntil,
      status: row.status,
      claimedAt: row.createdAt,
      offer: {
        id: row.loyaltyOffer.id,
        title: row.loyaltyOffer.title,
        description: row.loyaltyOffer.description,
        pointsRequired: row.loyaltyOffer.pointsRequired,
      },
    })),
  };
};
