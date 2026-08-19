import { Prisma, TraderOnboardingStatus, VerificationStatus } from '@prisma/client';
import { prisma } from '../../../config/database';
import { NotFoundError, BadRequestError } from '../../../utils/errors';
import { getDocumentRequirementsForTrader } from '../../document-rules/document-rules.service';

export const getVerificationStats = async () => {
  const [pending, verified, rejected, submitted] = await Promise.all([
    prisma.trader.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
    prisma.trader.count({ where: { verificationStatus: VerificationStatus.VERIFIED } }),
    prisma.trader.count({ where: { verificationStatus: VerificationStatus.REJECTED } }),
    prisma.trader.count({ where: { onboardingStatus: TraderOnboardingStatus.SUBMITTED } }),
  ]);

  return { pending, verified, rejected, submitted };
};

export const listVerificationQueue = async (filters: {
  page?: string;
  limit?: string;
  status?: VerificationStatus;
  entityType?: 'SOLO' | 'COMPANY';
  search?: string;
}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.TraderWhereInput = {
    onboardingStatus: {
      in: [TraderOnboardingStatus.SUBMITTED, TraderOnboardingStatus.APPROVED, TraderOnboardingStatus.REJECTED],
    },
  };

  if (filters.status) {
    where.verificationStatus = filters.status;
  }

  if (filters.entityType) {
    where.traderType = filters.entityType;
  }

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { businessName: { contains: search, mode: 'insensitive' } },
      { fullLegalName: { contains: search, mode: 'insensitive' } },
      { traderCode: { contains: search, mode: 'insensitive' } },
      { user: { fullName: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [total, traders] = await Promise.all([
    prisma.trader.count({ where }),
    prisma.trader.findMany({
      where,
      skip,
      take: limit,
      orderBy: { onboardingSubmittedAt: 'desc' },
      include: {
        user: { select: { fullName: true, email: true, mobileNumber: true } },
        categories: {
          include: { category: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    traders: traders.map((trader) => ({
      id: trader.id,
      traderCode: trader.traderCode,
      traderType: trader.traderType,
      businessName: trader.businessName,
      fullLegalName: trader.fullLegalName,
      verificationStatus: trader.verificationStatus,
      onboardingStatus: trader.onboardingStatus,
      onboardingSubmittedAt: trader.onboardingSubmittedAt,
      categories: trader.categories.map((item) => item.category),
      user: trader.user,
    })),
  };
};

export const getTraderVerificationDetail = async (traderId: string) => {
  const trader = await prisma.trader.findUnique({
    where: { id: traderId },
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
          mobileNumber: true,
          profilePhotoUrl: true,
        },
      },
      categories: {
        include: { category: { select: { id: true, name: true, categoryCode: true } } },
      },
      documents: {
        include: {
          documentRule: true,
        },
      },
      registrations: true,
    },
  });

  if (!trader) {
    throw new NotFoundError('Trader not found.');
  }

  const categoryIds = trader.categories.map((item) => item.categoryId);
  const requirements = await getDocumentRequirementsForTrader(trader.traderType, categoryIds);

  return {
    trader: {
      id: trader.id,
      traderCode: trader.traderCode,
      traderType: trader.traderType,
      businessName: trader.businessName,
      fullLegalName: trader.fullLegalName,
      ppsNumber: trader.ppsNumber,
      croNumber: trader.croNumber,
      vatNumber: trader.vatNumber,
      directorFullName: trader.directorFullName,
      bio: trader.bio,
      yearsExperience: trader.yearsExperience,
      addressLine1: trader.addressLine1,
      addressLine2: trader.addressLine2,
      city: trader.city,
      postcode: trader.postcode,
      country: trader.country,
      bankHolderName: trader.bankHolderName,
      bankName: trader.bankName,
      accountNumber: trader.accountNumber,
      ifscCode: trader.ifscCode,
      bankDetailsSkipped: trader.bankDetailsSkipped,
      serviceRadiusKm: trader.serviceRadiusKm,
      serviceCenterLabel: trader.serviceCenterLabel,
      verificationStatus: trader.verificationStatus,
      onboardingStatus: trader.onboardingStatus,
      onboardingSubmittedAt: trader.onboardingSubmittedAt,
      rejectionReason: trader.rejectionReason,
      user: trader.user,
      categories: trader.categories.map((item) => item.category),
    },
    documents: trader.documents,
    documentRequirements: requirements,
    registration: trader.registrations[0] ?? null,
  };
};

export const reviewTraderVerification = async (
  traderId: string,
  input: { verificationStatus: 'VERIFIED' | 'REJECTED'; rejectionReason?: string }
) => {
  const trader = await prisma.trader.findUnique({ where: { id: traderId } });
  if (!trader) {
    throw new NotFoundError('Trader not found.');
  }

  if (trader.onboardingStatus !== TraderOnboardingStatus.SUBMITTED) {
    throw new BadRequestError('Only submitted onboarding applications can be reviewed.');
  }

  const onboardingStatus =
    input.verificationStatus === 'VERIFIED'
      ? TraderOnboardingStatus.APPROVED
      : TraderOnboardingStatus.REJECTED;

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.trader.update({
      where: { id: traderId },
      data: {
        verificationStatus: input.verificationStatus as VerificationStatus,
        onboardingStatus,
        rejectionReason: input.verificationStatus === 'REJECTED' ? input.rejectionReason : null,
      },
    }),
    prisma.traderRegistration.updateMany({
      where: { traderId },
      data: {
        status: input.verificationStatus === 'VERIFIED' ? 'approved' : 'rejected',
      },
    }),
  ];

  if (input.verificationStatus === 'VERIFIED') {
    ops.push(
      prisma.user.update({
        where: { id: trader.userId },
        data: { tokenVersion: { increment: 1 } },
      })
    );
  }

  await prisma.$transaction(ops);

  return getTraderVerificationDetail(traderId);
};
