import { DiscountType, OfferStatus, VerificationStatus } from '@prisma/client';
import { resolveCategoryIconUrl } from '../categories/categories.serializers';
import {
  discountLabelForCurrency,
  getCurrencyMeta,
  serializeDisplayMoney,
} from '../../services/currency.service';

export const offerInclude = {
  createdBy: { select: { id: true, fullName: true, email: true } },
  trader: {
    select: {
      id: true,
      businessName: true,
      traderType: true,
      avgRating: true,
      topRated: true,
      verificationStatus: true,
      profilePhotoUrl: true,
      user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
      _count: { select: { ratingsReceived: true } },
    },
  },
  categories: {
    include: {
      category: {
        select: {
          id: true,
          name: true,
          categoryCode: true,
          iconName: true,
          urlSlug: true,
        },
      },
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

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
  INR: '₹',
};

const symbolForCode = (code: string) => CURRENCY_SYMBOLS[code] ?? code;

export const discountLabel = (
  type: DiscountType,
  value: number,
  label?: string | null,
  currencySymbol = '€'
) => discountLabelForCurrency(type, value, currencySymbol, label);

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
  currencyCode?: string;
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
    avgRating: { toString(): string } | number;
    topRated: boolean;
    verificationStatus: VerificationStatus;
    profilePhotoUrl: string | null;
    user: { id: string; fullName: string; profilePhotoUrl: string | null };
    _count?: { ratingsReceived?: number };
  } | null;
  categories: Array<{
    category: {
      id: string;
      name: string;
      categoryCode: string;
      iconName: string | null;
      urlSlug: string | null;
    };
  }>;
  subcategories: Array<{ subcategory: { id: string; name: string; categoryId: string } }>;
  _count?: { claims?: number };
};

export const serializeOffer = (offer: OfferRecord) => {
  const value = Number(offer.discountValue);
  const currencyCode = offer.currencyCode ?? 'EUR';
  const currencySymbol = symbolForCode(currencyCode);
  const claims = offer._count?.claims ?? offer.claimsCount;
  const status = effectiveStatus(offer.status, offer.validUntil);

  const categories = offer.categories.map((item) => ({
    id: item.category.id,
    name: item.category.name,
    categoryCode: item.category.categoryCode,
    iconName: item.category.iconName,
    iconUrl: resolveCategoryIconUrl({
      iconName: item.category.iconName,
      urlSlug: item.category.urlSlug ?? '',
    }),
  }));

  const primaryCategory = categories[0] ?? null;

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
    currencyCode,
    discountLabel: discountLabel(offer.discountType, value, offer.discountLabel, currencySymbol),
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
          avgRating: Number(offer.trader.avgRating),
          reviewsCount: offer.trader._count?.ratingsReceived ?? 0,
          topRated: offer.trader.topRated,
          isVerified: offer.trader.verificationStatus === VerificationStatus.VERIFIED,
          profilePhotoUrl:
            offer.trader.profilePhotoUrl ?? offer.trader.user.profilePhotoUrl ?? null,
          imageUrl: offer.trader.profilePhotoUrl ?? offer.trader.user.profilePhotoUrl ?? null,
        }
      : null,
    /** Comma-separated category names for offer card subtitle. */
    categoryLabel: categories.map((c) => c.name).join(', ') || null,
    /** First linked category — use `iconUrl` for category icon on offer card. */
    primaryCategory,
    categories,
    subcategories: offer.subcategories.map((item) => item.subcategory),
  };
};

export const enrichOfferWithCurrency = async <
  T extends ReturnType<typeof serializeOffer> & { claimed?: boolean },
>(
  offer: T,
  viewerCurrency?: string | null
): Promise<T & { discountMoney?: Awaited<ReturnType<typeof serializeDisplayMoney>>; displayDiscountLabel?: string }> => {
  const meta = await getCurrencyMeta(offer.currencyCode);
  const base = {
    ...offer,
    discountLabel: offer.discountLabel
      ?? discountLabel(offer.discountType as DiscountType, offer.discountValue, null, meta.symbol),
  };

  if (offer.discountType === DiscountType.PERCENTAGE || offer.discountType === DiscountType.FREE_SERVICE) {
    return base;
  }

  const discountMoney = await serializeDisplayMoney(
    offer.discountValue,
    offer.currencyCode,
    viewerCurrency
  );

  return {
    ...base,
    discountMoney,
    displayDiscountLabel: discountMoney.displayFormatted
      ? `Fixed ${discountMoney.displayFormatted}`
      : base.discountLabel,
  };
};

export const enrichOffersWithCurrency = async (
  offers: ReturnType<typeof serializeOffer>[],
  viewerCurrency?: string | null
) => Promise.all(offers.map((o) => enrichOfferWithCurrency(o, viewerCurrency)));

export const serializeOfferWithMeta = async (offer: OfferRecord) => {
  await getCurrencyMeta(offer.currencyCode ?? 'EUR');
  return serializeOffer({ ...offer, currencyCode: offer.currencyCode ?? 'EUR' });
};
