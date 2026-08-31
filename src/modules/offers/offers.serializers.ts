import { DiscountType, OfferStatus } from '@prisma/client';

export const offerInclude = {
  createdBy: { select: { id: true, fullName: true, email: true } },
  trader: {
    select: {
      id: true,
      businessName: true,
      traderType: true,
      profilePhotoUrl: true,
      user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
    },
  },
  categories: {
    include: {
      category: { select: { id: true, name: true, categoryCode: true, iconName: true } },
    },
  },
  subcategories: {
    include: {
      subcategory: { select: { id: true, name: true, categoryId: true } },
    },
  },
  _count: {
    select: {
      claims: true,
    },
  },
} as const;

export const discountLabel = (type: DiscountType, value: number, label?: string | null) => {
  if (label) return label;
  if (type === DiscountType.PERCENTAGE) return `${value}%`;
  if (type === DiscountType.FREE_SERVICE) return 'Free Visit';
  return `Fixed €${value}`;
};

export const effectiveStatus = (status: OfferStatus, validUntil: Date) => {
  if (status === OfferStatus.DISABLED) return OfferStatus.DISABLED;
  if (validUntil.getTime() < Date.now()) return OfferStatus.EXPIRED;
  return status;
};

type OfferRecord = {
  id: string;
  offerCode: string;
  offerType: string;
  title: string;
  badgeTag: string | null;
  couponCode: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  bannerImageUrl: string | null;
  discountType: DiscountType;
  discountValue: { toString(): string } | number;
  discountLabel: string | null;
  validFrom: Date;
  validUntil: Date;
  status: OfferStatus;
  claimsCount: number;
  revenueGenerated: { toString(): string } | number;
  viewsCount: number;
  ctaLabel?: string | null;
  ctaAction?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { id: string; fullName: string; email: string } | null;
  trader?: {
    id: string;
    businessName: string | null;
    traderType: string;
    profilePhotoUrl: string | null;
    user: { id: string; fullName: string; profilePhotoUrl: string | null };
  } | null;
  categories: Array<{ category: { id: string; name: string; categoryCode: string; iconName: string | null } }>;
  subcategories: Array<{ subcategory: { id: string; name: string; categoryId: string } }>;
  _count?: { claims?: number };
};

export const serializeOffer = (offer: OfferRecord) => {
  const value = Number(offer.discountValue);
  const claims = offer._count?.claims ?? offer.claimsCount;
  const status = effectiveStatus(offer.status, offer.validUntil);

  return {
    id: offer.id,
    offerCode: offer.offerCode,
    offerType: offer.offerType,
    title: offer.title,
    badgeTag: offer.badgeTag,
    couponCode: offer.couponCode,
    shortDescription: offer.shortDescription,
    fullDescription: offer.fullDescription,
    /** Same as fullDescription — use for "Description & Terms" on mobile. */
    description: offer.fullDescription,
    bannerImageUrl: offer.bannerImageUrl,
    discountType: offer.discountType,
    discountValue: value,
    discountLabel: discountLabel(offer.discountType, value, offer.discountLabel),
    validFrom: offer.validFrom,
    validUntil: offer.validUntil,
    status,
    storedStatus: offer.status,
    claimsCount: claims,
    revenueGenerated: Number(offer.revenueGenerated),
    viewsCount: offer.viewsCount,
    ctaLabel: offer.ctaLabel ?? (offer.ctaAction === 'BOOK_INSPECTION' ? 'Book Inspection' : 'Claim Offer'),
    ctaAction: offer.ctaAction ?? 'CLAIM',
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    createdBy: offer.createdBy
      ? { id: offer.createdBy.id, fullName: offer.createdBy.fullName, email: offer.createdBy.email }
      : null,
    trader: offer.trader
      ? {
          id: offer.trader.id,
          businessName: offer.trader.businessName,
          traderType: offer.trader.traderType,
          fullName: offer.trader.user.fullName,
          /** Trader avatar for customer offer cards (trader photo, else user photo). */
          profilePhotoUrl:
            offer.trader.profilePhotoUrl ?? offer.trader.user.profilePhotoUrl ?? null,
          imageUrl: offer.trader.profilePhotoUrl ?? offer.trader.user.profilePhotoUrl ?? null,
        }
      : null,
    categories: offer.categories.map((item) => item.category),
    subcategories: offer.subcategories.map((item) => item.subcategory),
  };
};
