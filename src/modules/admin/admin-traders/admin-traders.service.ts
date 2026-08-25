import {
  ActorType,
  Prisma,
  TraderOnboardingStatus,
  TraderType,
  UserRole,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../config/database';
import { ConflictError, NotFoundError } from '../../../utils/errors';
import {
  CreateTraderInput,
  TraderAccountStatus,
  TraderListFilters,
  UpdateTraderInput,
  UpdateTraderStatusInput,
  UpdateTraderVerificationInput,
} from './admin-traders.types';

const toDbTraderStatus = (status: TraderAccountStatus): string => {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'INACTIVE':
      return 'inactive';
    case 'SUSPENDED':
      return 'suspended';
    case 'PENDING':
      return 'pending';
    default:
      return 'active';
  }
};

const toApiTraderStatus = (traderStatus: string, userStatus: UserStatus): TraderAccountStatus => {
  const normalized = traderStatus.toLowerCase();
  if (normalized === 'suspended' || userStatus === UserStatus.SUSPENDED) return 'SUSPENDED';
  if (normalized === 'inactive' || userStatus === UserStatus.INACTIVE || userStatus === UserStatus.BLOCKED) {
    return 'INACTIVE';
  }
  if (normalized === 'pending' || userStatus === UserStatus.PENDING) return 'PENDING';
  return 'ACTIVE';
};

const toUserStatus = (status: TraderAccountStatus): UserStatus => {
  switch (status) {
    case 'ACTIVE':
      return UserStatus.ACTIVE;
    case 'INACTIVE':
      return UserStatus.INACTIVE;
    case 'SUSPENDED':
      return UserStatus.SUSPENDED;
    case 'PENDING':
      return UserStatus.PENDING;
    default:
      return UserStatus.ACTIVE;
  }
};

const businessTypeLabel = (traderType: TraderType) =>
  traderType === TraderType.COMPANY ? 'Business' : 'Individual';

const getTraderRevenue = async (traderId: string): Promise<number> => {
  const result = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      status: 'COMPLETED',
      invoice: {
        booking: { traderId },
      },
    },
  });
  return result._sum.amount ? Number(result._sum.amount) : 0;
};

const formatTraderRow = async (trader: {
  id: string;
  traderCode: string | null;
  traderType: TraderType;
  businessName: string | null;
  fullLegalName: string | null;
  status: string;
  verificationStatus: VerificationStatus;
  onboardingStatus: TraderOnboardingStatus;
  avgRating: Prisma.Decimal;
  jobsDoneCount: number;
  country: string | null;
  city: string | null;
  createdAt: Date;
  user: {
    id: string;
    fullName: string;
    email: string;
    mobileNumber: string;
    profilePhotoUrl: string | null;
    status: UserStatus;
    country: string | null;
    city: string | null;
  };
  categories: Array<{ category: { id: string; name: string; categoryCode: string | null } }>;
  _count: { offers: number; ratingsReceived: number; bookings: number };
}) => {
  const revenue = await getTraderRevenue(trader.id);
  const displayName =
    trader.businessName?.trim() ||
    trader.fullLegalName?.trim() ||
    trader.user.fullName;

  return {
    id: trader.id,
    traderCode: trader.traderCode,
    businessName: displayName,
    businessType: businessTypeLabel(trader.traderType),
    traderType: trader.traderType,
    contact: {
      email: trader.user.email,
      mobileNumber: trader.user.mobileNumber,
      fullName: trader.user.fullName,
    },
    listingsCount: trader._count.offers,
    bookingsCount: trader._count.bookings,
    jobsDoneCount: trader.jobsDoneCount,
    revenue,
    rating: {
      average: Number(trader.avgRating),
      reviewsCount: trader._count.ratingsReceived,
    },
    status: toApiTraderStatus(trader.status, trader.user.status),
    verificationStatus: trader.verificationStatus,
    onboardingStatus: trader.onboardingStatus,
    country: trader.country || trader.user.country || null,
    city: trader.city || trader.user.city || null,
    categories: trader.categories.map((item) => item.category),
    profilePhotoUrl: trader.user.profilePhotoUrl,
    joinedAt: trader.createdAt,
  };
};

export const getTraderDirectoryStats = async () => {
  const [totalTraders, activeTraders, suspendedTraders, pendingVerification, ratingAgg] =
    await Promise.all([
      prisma.trader.count(),
      prisma.trader.count({
        where: {
          status: 'active',
          user: { status: UserStatus.ACTIVE },
        },
      }),
      prisma.trader.count({
        where: {
          OR: [{ status: 'suspended' }, { user: { status: UserStatus.SUSPENDED } }],
        },
      }),
      prisma.trader.count({
        where: { verificationStatus: VerificationStatus.PENDING },
      }),
      prisma.trader.aggregate({
        _avg: { avgRating: true },
      }),
    ]);

  const totalRevenueAgg = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      status: 'COMPLETED',
      invoice: { is: { booking: { is: {} } } },
    },
  });

  return {
    totalTraders,
    activeTraders,
    suspendedTraders,
    pendingVerification,
    totalRevenue: totalRevenueAgg._sum.amount ? Number(totalRevenueAgg._sum.amount) : 0,
    avgRating: ratingAgg._avg.avgRating ? Number(ratingAgg._avg.avgRating) : 0,
  };
};

export const listTraders = async (filters: TraderListFilters) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.TraderWhereInput = {};

  if (filters.search?.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { businessName: { contains: search, mode: 'insensitive' } },
      { fullLegalName: { contains: search, mode: 'insensitive' } },
      { traderCode: { contains: search, mode: 'insensitive' } },
      { user: { fullName: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { mobileNumber: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (filters.status) {
    const statusClause: Prisma.TraderWhereInput =
      filters.status === 'SUSPENDED'
        ? { OR: [{ status: 'suspended' }, { user: { status: UserStatus.SUSPENDED } }] }
        : filters.status === 'PENDING'
          ? { OR: [{ status: 'pending' }, { user: { status: UserStatus.PENDING } }] }
          : {
              status: toDbTraderStatus(filters.status),
              user: { status: toUserStatus(filters.status) },
            };

    if (where.OR) {
      where.AND = [{ OR: where.OR }, statusClause];
      delete where.OR;
    } else {
      Object.assign(where, statusClause);
    }
  }

  if (filters.verification) {
    where.verificationStatus = filters.verification;
  }

  if (filters.categoryId) {
    where.categories = { some: { categoryId: filters.categoryId } };
  }

  if (filters.country?.trim()) {
    const country = filters.country.trim();
    where.AND = [
      ...((where.AND as Prisma.TraderWhereInput[]) || []),
      {
        OR: [
          { country: { contains: country, mode: 'insensitive' } },
          { user: { country: { contains: country, mode: 'insensitive' } } },
        ],
      },
    ];
  }

  const include = {
    user: {
      select: {
        id: true,
        fullName: true,
        email: true,
        mobileNumber: true,
        profilePhotoUrl: true,
        status: true,
        country: true,
        city: true,
      },
    },
    categories: {
      include: {
        category: { select: { id: true, name: true, categoryCode: true } },
      },
    },
    _count: {
      select: {
        offers: true,
        ratingsReceived: true,
        bookings: true,
      },
    },
  } as const;

  const [total, traders] = await Promise.all([
    prisma.trader.count({ where }),
    prisma.trader.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include,
    }),
  ]);

  const rows = await Promise.all(traders.map((trader) => formatTraderRow(trader)));

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    },
    traders: rows,
  };
};

export const getTraderById = async (id: string) => {
  const trader = await prisma.trader.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          mobileNumber: true,
          alternatePhone: true,
          profilePhotoUrl: true,
          status: true,
          mobileVerified: true,
          emailVerified: true,
          country: true,
          city: true,
          createdAt: true,
        },
      },
      categories: {
        include: {
          category: { select: { id: true, name: true, categoryCode: true, urlSlug: true } },
        },
      },
      _count: {
        select: {
          offers: true,
          ratingsReceived: true,
          bookings: true,
          documents: true,
        },
      },
    },
  });

  if (!trader) {
    throw new NotFoundError('Trader not found.');
  }

  const revenue = await getTraderRevenue(trader.id);
  const listShape = await formatTraderRow(trader);

  return {
    ...listShape,
    profile: {
      fullLegalName: trader.fullLegalName,
      businessName: trader.businessName,
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
      serviceRadiusKm: trader.serviceRadiusKm,
      serviceCenterLabel: trader.serviceCenterLabel,
    },
    bankDetails: {
      bankHolderName: trader.bankHolderName,
      bankName: trader.bankName,
      accountNumber: trader.accountNumber,
      ifscCode: trader.ifscCode,
      bankDetailsSkipped: trader.bankDetailsSkipped,
    },
    user: trader.user,
    documentsCount: trader._count.documents,
    revenue,
    rejectionReason: trader.rejectionReason,
    onboardingSubmittedAt: trader.onboardingSubmittedAt,
  };
};

const assertUniqueUserContact = async (
  email: string,
  mobileNumber: string,
  excludeUserId?: string
) => {
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail && existingEmail.id !== excludeUserId) {
    throw new ConflictError('Email already exists.');
  }
  const existingMobile = await prisma.user.findUnique({ where: { mobileNumber } });
  if (existingMobile && existingMobile.id !== excludeUserId) {
    throw new ConflictError('Mobile number already exists.');
  }
};

const syncCategories = async (traderId: string, categoryIds: string[]) => {
  if (!categoryIds.length) {
    await prisma.traderCategory.deleteMany({ where: { traderId } });
    return;
  }
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });
  if (categories.length !== categoryIds.length) {
    throw new NotFoundError('One or more categoryIds are invalid.');
  }
  await prisma.traderCategory.deleteMany({ where: { traderId } });
  await prisma.traderCategory.createMany({
    data: categoryIds.map((categoryId) => ({ traderId, categoryId })),
  });
};

export const createTrader = async (
  adminId: string,
  adminLabel: string,
  input: CreateTraderInput
) => {
  await assertUniqueUserContact(input.email, input.mobileNumber);

  const passwordHash = await bcrypt.hash('Password1!', 10);
  const count = await prisma.trader.count();
  const traderCode = `TRD-${(count + 1001).toString()}`;
  const accountStatus = input.status || 'ACTIVE';

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        mobileNumber: input.mobileNumber,
        passwordHash,
        role: UserRole.TRADER,
        status: toUserStatus(accountStatus),
        country: input.country || 'Ireland',
        city: input.city,
        profilePhotoUrl: input.profilePhotoUrl,
        mobileVerified: true,
        emailVerified: true,
      },
    });

    const trader = await tx.trader.create({
      data: {
        userId: user.id,
        traderCode,
        traderType: (input.traderType || 'SOLO') as TraderType,
        businessName: input.businessName || null,
        fullLegalName: input.fullLegalName || input.fullName,
        country: input.country || 'Ireland',
        city: input.city || null,
        status: toDbTraderStatus(accountStatus),
        verificationStatus: (input.verificationStatus ||
          VerificationStatus.PENDING) as VerificationStatus,
        yearsExperience: input.yearsExperience ?? 0,
        bio: input.bio || null,
        onboardingStatus: TraderOnboardingStatus.APPROVED,
      },
    });

    if (input.categoryIds?.length) {
      const categories = await tx.category.findMany({
        where: { id: { in: input.categoryIds } },
        select: { id: true },
      });
      if (categories.length !== input.categoryIds.length) {
        throw new NotFoundError('One or more categoryIds are invalid.');
      }
      await tx.traderCategory.createMany({
        data: input.categoryIds.map((categoryId) => ({
          traderId: trader.id,
          categoryId,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        eventType: 'TRADER_CREATED',
        actorType: ActorType.ADMIN,
        actorId: adminId,
        actorLabel: adminLabel,
        subjectType: 'Trader',
        subjectId: trader.id,
        description: `Created trader "${input.fullName}" (${traderCode}).`,
      },
    });

    return trader.id;
  });

  return getTraderById(created);
};

export const updateTrader = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateTraderInput
) => {
  const existing = await prisma.trader.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!existing) {
    throw new NotFoundError('Trader not found.');
  }

  if (input.email || input.mobileNumber) {
    await assertUniqueUserContact(
      input.email || existing.user.email,
      input.mobileNumber || existing.user.mobileNumber,
      existing.userId
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: {
        fullName: input.fullName,
        email: input.email?.toLowerCase(),
        mobileNumber: input.mobileNumber,
        profilePhotoUrl: input.profilePhotoUrl === undefined ? undefined : input.profilePhotoUrl,
        country: input.country === undefined ? undefined : input.country,
        city: input.city === undefined ? undefined : input.city,
        ...(input.status ? { status: toUserStatus(input.status) } : {}),
      },
    });

    await tx.trader.update({
      where: { id },
      data: {
        traderType: input.traderType as TraderType | undefined,
        businessName: input.businessName === undefined ? undefined : input.businessName,
        fullLegalName: input.fullLegalName === undefined ? undefined : input.fullLegalName,
        country: input.country === undefined ? undefined : input.country,
        city: input.city === undefined ? undefined : input.city,
        addressLine1: input.addressLine1 === undefined ? undefined : input.addressLine1,
        addressLine2: input.addressLine2 === undefined ? undefined : input.addressLine2,
        postcode: input.postcode === undefined ? undefined : input.postcode,
        bio: input.bio === undefined ? undefined : input.bio,
        yearsExperience: input.yearsExperience,
        serviceRadiusKm: input.serviceRadiusKm === undefined ? undefined : input.serviceRadiusKm,
        ...(input.status ? { status: toDbTraderStatus(input.status) } : {}),
        ...(input.verificationStatus
          ? { verificationStatus: input.verificationStatus as VerificationStatus }
          : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        eventType: 'TRADER_UPDATED',
        actorType: ActorType.ADMIN,
        actorId: adminId,
        actorLabel: adminLabel,
        subjectType: 'Trader',
        subjectId: id,
        description: `Updated trader profile ${existing.traderCode || id}.`,
      },
    });
  });

  if (input.categoryIds) {
    await syncCategories(id, input.categoryIds);
  }

  return getTraderById(id);
};

export const updateTraderStatus = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateTraderStatusInput
) => {
  const existing = await prisma.trader.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Trader not found.');
  }

  await prisma.$transaction([
    prisma.trader.update({
      where: { id },
      data: { status: toDbTraderStatus(input.status) },
    }),
    prisma.user.update({
      where: { id: existing.userId },
      data: { status: toUserStatus(input.status) },
    }),
    prisma.auditLog.create({
      data: {
        eventType: 'TRADER_STATUS_UPDATED',
        actorType: ActorType.ADMIN,
        actorId: adminId,
        actorLabel: adminLabel,
        subjectType: 'Trader',
        subjectId: id,
        description: `Set trader status to ${input.status}.`,
      },
    }),
  ]);

  return getTraderById(id);
};

export const updateTraderVerification = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateTraderVerificationInput
) => {
  const existing = await prisma.trader.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Trader not found.');
  }

  const onboardingStatus =
    input.verificationStatus === 'VERIFIED'
      ? TraderOnboardingStatus.APPROVED
      : input.verificationStatus === 'REJECTED'
        ? TraderOnboardingStatus.REJECTED
        : existing.onboardingStatus;

  await prisma.$transaction(async (tx) => {
    await tx.trader.update({
      where: { id },
      data: {
        verificationStatus: input.verificationStatus as VerificationStatus,
        onboardingStatus,
        rejectionReason:
          input.verificationStatus === 'REJECTED' ? input.rejectionReason || null : null,
      },
    });

    if (input.verificationStatus === 'VERIFIED' || input.verificationStatus === 'REJECTED') {
      await tx.traderRegistration.updateMany({
        where: { traderId: id },
        data: {
          status: input.verificationStatus === 'VERIFIED' ? 'approved' : 'rejected',
        },
      });
    }

    if (input.verificationStatus === 'VERIFIED') {
      await tx.user.update({
        where: { id: existing.userId },
        data: { tokenVersion: { increment: 1 } },
      });
    }

    await tx.auditLog.create({
      data: {
        eventType: 'TRADER_VERIFICATION_UPDATED',
        actorType: ActorType.ADMIN,
        actorId: adminId,
        actorLabel: adminLabel,
        subjectType: 'Trader',
        subjectId: id,
        description: `Set verificationStatus to ${input.verificationStatus}.`,
      },
    });
  });

  return getTraderById(id);
};

export const deleteTrader = async (adminId: string, adminLabel: string, id: string) => {
  const trader = await prisma.trader.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!trader) {
    throw new NotFoundError('Trader not found.');
  }

  await prisma.user.delete({ where: { id: trader.userId } });

  await prisma.auditLog.create({
    data: {
      eventType: 'TRADER_DELETED',
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'Trader',
      subjectId: id,
      description: `Deleted trader "${trader.user.fullName}" (${trader.traderCode || id}).`,
    },
  });
};
