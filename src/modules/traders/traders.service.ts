import { OfferStatus, OfferType, TraderDocumentStatus, VerificationStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../utils/errors';
import { splitE164Mobile } from '../../utils/phone';
import type { UpdateTraderProfileInput } from './traders.validation';

const COMPLETION_HINTS: Record<string, string> = {
  profile_photo: 'Add a profile photo to rank higher in search.',
  identity: 'Complete your personal / company details.',
  bank_details: 'Almost there! Update your payment info to reach 100% and rank higher in search.',
  categories: 'Select at least one trade category.',
  documents: 'Upload your remaining verification documents.',
  verification: 'Your account is pending admin verification.',
};

const buildProfileCompletion = (input: {
  hasPhoto: boolean;
  hasIdentity: boolean;
  hasBank: boolean;
  hasCategory: boolean;
  hasRequiredDocs: boolean;
  isVerified: boolean;
}) => {
  const checks: Array<{ key: string; done: boolean }> = [
    { key: 'profile_photo', done: input.hasPhoto },
    { key: 'identity', done: input.hasIdentity },
    { key: 'bank_details', done: input.hasBank },
    { key: 'categories', done: input.hasCategory },
    { key: 'documents', done: input.hasRequiredDocs },
    { key: 'verification', done: input.isVerified },
  ];
  const completed = checks.filter((item) => item.done).length;
  const missing = checks.filter((item) => !item.done).map((item) => item.key);
  const percent = Math.round((completed / checks.length) * 100);
  return {
    profileCompletionPercent: percent,
    profileCompletionHint:
      percent >= 100
        ? 'Your profile is complete.'
        : COMPLETION_HINTS[missing[0]] ?? 'Complete your profile to rank higher in search.',
    missingProfileItems: missing,
  };
};

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
          emailNotifications: true,
          smsAlerts: true,
          promoNotifications: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          categoryCode: true,
        },
      },
      categories: {
        include: {
          category: { select: { id: true, name: true, categoryCode: true, iconName: true } },
        },
      },
      documents: {
        select: { id: true, status: true, documentRule: { select: { required: true } } },
      },
      _count: {
        select: { offers: true },
      },
    },
  });

  if (!trader) {
    throw new NotFoundError('Trader profile not found.');
  }

  const profilePhotoUrl = trader.profilePhotoUrl ?? trader.user.profilePhotoUrl;
  const hasBank = Boolean(
    !trader.bankDetailsSkipped && trader.accountNumber && trader.bankName && trader.bankHolderName
  );
  const selectedCategories = trader.categories.map((item) => item.category);
  const hasIdentity = Boolean(
    trader.traderType === 'COMPANY' ? trader.businessName || trader.fullLegalName : trader.fullLegalName
  );
  const requiredDocs = trader.documents.filter((doc) => doc.documentRule.required);
  const requiredUploaded = requiredDocs.length
    ? requiredDocs.every((doc) => doc.status === TraderDocumentStatus.APPROVED || doc.status === TraderDocumentStatus.PENDING)
    : trader.documents.length > 0;
  const activeDocumentsCount = trader.documents.filter(
    (doc) => doc.status === TraderDocumentStatus.APPROVED || doc.status === TraderDocumentStatus.PENDING
  ).length;
  const mobile = splitE164Mobile(trader.user.mobileNumber);

  const activeOffersCount = await prisma.offer.count({
    where: {
      traderId: trader.id,
      offerType: OfferType.TRADER,
      status: OfferStatus.ACTIVE,
      validUntil: { gte: new Date() },
    },
  });

  const completion = buildProfileCompletion({
    hasPhoto: Boolean(profilePhotoUrl),
    hasIdentity,
    hasBank,
    hasCategory: selectedCategories.length > 0 || Boolean(trader.category),
    hasRequiredDocs: requiredUploaded,
    isVerified: trader.verificationStatus === VerificationStatus.VERIFIED,
  });

  return {
    id: trader.id,
    traderCode: trader.traderCode,
    traderType: trader.traderType,
    businessName: trader.businessName,
    bio: trader.bio,
    fullName: trader.user.fullName,
    email: trader.user.email,
    mobileCountryCode: mobile.mobileCountryCode,
    mobileNumber: mobile.mobileNumber,
    mobileNumberE164: trader.user.mobileNumber,
    profilePhotoUrl,
    coverImageUrl: trader.coverImageUrl,
    yearsExperience: trader.yearsExperience,
    jobsDoneCount: trader.jobsDoneCount,
    avgRating: Number(trader.avgRating),
    topRated: trader.topRated,
    verificationStatus: trader.verificationStatus,
    status: trader.status,
    serviceRadius: trader.serviceRadius,
    category: trader.category,
    selectedCategories,
    categoriesCount: selectedCategories.length,
    ...completion,
    bankDetails: {
      skipped: trader.bankDetailsSkipped,
      status: hasBank ? 'VERIFIED' : 'MISSING',
      verified: hasBank,
    },
    certifications: {
      activeDocumentsCount,
      totalDocumentsCount: trader.documents.length,
    },
    offers: {
      activeCount: activeOffersCount,
      totalCount: trader._count.offers,
    },
    notifications: {
      emailNotifications: trader.user.emailNotifications,
      smsAlerts: trader.user.smsAlerts,
      promoNotifications: trader.user.promoNotifications,
    },
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
