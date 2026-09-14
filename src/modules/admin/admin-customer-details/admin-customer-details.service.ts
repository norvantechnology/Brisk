import {
  JobStatus,
  OfferClaimStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';

const money = (value: Prisma.Decimal | number | null | undefined): number =>
  value == null ? 0 : Number(value);

const round2 = (n: number) => Math.round(n * 100) / 100;

const parsePage = (page?: string) => Math.max(1, Number(page) || 1);
const parseLimit = (limit?: string) => Math.max(1, Math.min(100, Number(limit) || 10));

const parseDateBoundary = (value: string | undefined, endOfDay: boolean) => {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const dateRangeFilter = (from?: string, to?: string, field = 'createdAt') => {
  const gte = parseDateBoundary(from, false);
  const lte = parseDateBoundary(to, true);
  if (!gte && !lte) return {};
  return {
    [field]: {
      ...(gte ? { gte } : {}),
      ...(lte ? { lte } : {}),
    },
  };
};

const assertCustomerExists = async (customerId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: customerId, role: UserRole.CUSTOMER },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobileNumber: true,
      mobileVerified: true,
      emailVerified: true,
      status: true,
      customerCode: true,
      country: true,
      city: true,
      createdAt: true,
    },
  });
  if (!user) throw new NotFoundError('Customer not found.');
  return user;
};

// ---------------------------------------------------------------------------
// Overview stats
// ---------------------------------------------------------------------------

export const getCustomerDetailsStats = async (customerId: string) => {
  await assertCustomerExists(customerId);

  const [
    totalJobs,
    completedJobs,
    totalBookings,
    paymentsAgg,
    refundsAgg,
    offersClaimed,
    offersUsed,
    reviewsAgg,
    addressesCount,
    unreadNotifications,
  ] = await Promise.all([
    prisma.job.count({ where: { customerId } }),
    prisma.job.count({ where: { customerId, status: JobStatus.COMPLETED } }),
    prisma.booking.count({ where: { customerId } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { userId: customerId, status: PaymentStatus.COMPLETED },
    }),
    prisma.refund.aggregate({
      _sum: { refundAmount: true },
      _count: true,
      where: { userId: customerId, status: RefundStatus.COMPLETED },
    }),
    prisma.offerClaim.count({ where: { userId: customerId } }),
    prisma.offerClaim.count({ where: { userId: customerId, status: OfferClaimStatus.USED } }),
    prisma.ratingReview.aggregate({
      _avg: { stars: true },
      _count: true,
      where: { customerId },
    }),
    prisma.address.count({ where: { userId: customerId } }),
    prisma.notification.count({ where: { userId: customerId, read: false } }),
  ]);

  return {
    totalJobs,
    completedJobs,
    totalBookings,
    totalSpent: round2(money(paymentsAgg._sum.amount)),
    paymentsCount: paymentsAgg._count,
    refundedAmount: round2(money(refundsAgg._sum.refundAmount)),
    refundsCount: refundsAgg._count,
    offersClaimed,
    offersUsed,
    reviewsCount: reviewsAgg._count,
    avgRatingGiven: reviewsAgg._avg.stars != null ? round2(Number(reviewsAgg._avg.stars)) : 0,
    addressesCount,
    unreadNotifications,
    currencyCode: 'EUR',
  };
};

export const getCustomerVerification = async (customerId: string) => {
  const user = await assertCustomerExists(customerId);
  const deletion = await prisma.accountDeletionRequest.findUnique({
    where: { userId: customerId },
    select: {
      id: true,
      requestRef: true,
      status: true,
      reason: true,
      requestedAt: true,
      processedAt: true,
    },
  });

  return {
    emailVerified: user.emailVerified,
    mobileVerified: user.mobileVerified,
    accountStatus: user.status,
    deletionRequest: deletion,
  };
};

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

export const listCustomerAddresses = async (
  customerId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    addressType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
) => {
  await assertCustomerExists(customerId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.AddressWhereInput = { userId: customerId };
  if (filters.addressType) where.addressType = filters.addressType;
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { label: { contains: q, mode: 'insensitive' } },
      { addressLine1: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      { eircode: { contains: q, mode: 'insensitive' } },
      { county: { contains: q, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.AddressOrderByWithRelationInput =
    filters.sortBy === 'city'
      ? { city: sortOrder }
      : filters.sortBy === 'addressType'
        ? { addressType: sortOrder }
        : { createdAt: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.address.count({ where }),
    prisma.address.findMany({ where, skip, take: limit, orderBy }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    addresses: rows.map((a) => ({
      id: a.id,
      label: a.label,
      addressType: a.addressType,
      houseNumber: a.houseNumber,
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2,
      city: a.city,
      county: a.county,
      eircode: a.eircode,
      country: a.country,
      latitude: a.latitude,
      longitude: a.longitude,
      mapImageUrl: a.mapImageUrl,
      isDefault: a.isDefault,
      isPrimary: a.isDefault,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
  };
};

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export const getCustomerJobsStats = async (customerId: string) => {
  await assertCustomerExists(customerId);

  const [total, draft, published, paymentPending, scheduled, inProgress, completed, cancelled] =
    await Promise.all([
      prisma.job.count({ where: { customerId } }),
      prisma.job.count({ where: { customerId, status: JobStatus.DRAFT } }),
      prisma.job.count({ where: { customerId, status: JobStatus.PUBLISHED } }),
      prisma.job.count({ where: { customerId, status: JobStatus.PAYMENT_PENDING } }),
      prisma.job.count({ where: { customerId, status: JobStatus.SCHEDULED } }),
      prisma.job.count({ where: { customerId, status: JobStatus.IN_PROGRESS } }),
      prisma.job.count({ where: { customerId, status: JobStatus.COMPLETED } }),
      prisma.job.count({ where: { customerId, status: JobStatus.CANCELLED } }),
    ]);

  return {
    totalJobs: total,
    draft,
    published,
    paymentPending,
    scheduled,
    inProgress,
    completed,
    cancelled,
  };
};

export const listCustomerJobs = async (
  customerId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    status?: JobStatus;
    categoryId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    from?: string;
    to?: string;
  }
) => {
  await assertCustomerExists(customerId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.JobWhereInput = {
    customerId,
    ...dateRangeFilter(filters.from, filters.to, 'createdAt'),
  };
  if (filters.status) where.status = filters.status;
  if (filters.categoryId) where.categoryId = filters.categoryId;

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { jobRef: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
      { addressLine: { contains: q, mode: 'insensitive' } },
      { category: { name: { contains: q, mode: 'insensitive' } } },
      { subcategory: { name: { contains: q, mode: 'insensitive' } } },
      { trader: { businessName: { contains: q, mode: 'insensitive' } } },
      { trader: { user: { fullName: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  const orderBy: Prisma.JobOrderByWithRelationInput =
    filters.sortBy === 'status'
      ? { status: sortOrder }
      : filters.sortBy === 'scheduledDate'
        ? { scheduledDate: sortOrder }
        : filters.sortBy === 'title'
          ? { title: sortOrder }
          : { createdAt: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
        trader: {
          select: {
            id: true,
            businessName: true,
            traderCode: true,
            user: { select: { fullName: true, profilePhotoUrl: true } },
          },
        },
        photos: { take: 1, orderBy: { createdAt: 'asc' }, select: { photoUrl: true } },
        _count: { select: { photos: true, quotes: true } },
        booking: {
          select: {
            id: true,
            bookingRef: true,
            status: true,
            invoice: { select: { id: true, totalAmount: true, status: true, currencyCode: true } },
          },
        },
      },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    jobs: rows.map((job) => ({
      id: job.id,
      jobRef: job.jobRef,
      title: job.title,
      status: job.status,
      category: job.category,
      subcategory: job.subcategory,
      addressLine: job.addressLine,
      city: job.city,
      postcode: job.postcode,
      scheduledDate: job.scheduledDate,
      createdAt: job.createdAt,
      serviceCharge: job.serviceCharge != null ? money(job.serviceCharge) : null,
      siteVisitFee: job.siteVisitFee != null ? money(job.siteVisitFee) : null,
      siteVisitRequested: job.siteVisitRequested,
      coverPhotoUrl: job.photos[0]?.photoUrl ?? null,
      photosCount: job._count.photos,
      quotesCount: job._count.quotes,
      trader: job.trader
        ? {
            id: job.trader.id,
            traderCode: job.trader.traderCode,
            businessName: job.trader.businessName,
            fullName: job.trader.user?.fullName ?? null,
            profilePhotoUrl: job.trader.user?.profilePhotoUrl ?? null,
          }
        : null,
      booking: job.booking
        ? {
            id: job.booking.id,
            bookingRef: job.booking.bookingRef,
            status: job.booking.status,
            invoiceId: job.booking.invoice?.id ?? null,
            totalAmount: job.booking.invoice ? money(job.booking.invoice.totalAmount) : null,
            invoiceStatus: job.booking.invoice?.status ?? null,
            currencyCode: job.booking.invoice?.currencyCode ?? 'EUR',
          }
        : null,
    })),
  };
};

export const getCustomerJobById = async (customerId: string, jobId: string) => {
  await assertCustomerExists(customerId);

  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId },
    include: {
      category: true,
      subcategory: true,
      trader: {
        select: {
          id: true,
          businessName: true,
          traderCode: true,
          avgRating: true,
          user: { select: { fullName: true, email: true, mobileNumber: true, profilePhotoUrl: true } },
        },
      },
      photos: { orderBy: { createdAt: 'asc' } },
      quotes: {
        orderBy: { createdAt: 'desc' },
        include: {
          trader: {
            select: {
              id: true,
              businessName: true,
              traderCode: true,
              user: { select: { fullName: true } },
            },
          },
        },
      },
      booking: {
        include: {
          invoice: { include: { payments: { orderBy: { createdAt: 'desc' } } } },
          ratingReview: true,
        },
      },
      address: true,
      offer: {
        select: {
          id: true,
          title: true,
          offerCode: true,
          discountType: true,
          discountValue: true,
          couponCode: true,
        },
      },
    },
  });

  if (!job) throw new NotFoundError('Job not found for this customer.');

  return {
    id: job.id,
    jobRef: job.jobRef,
    title: job.title,
    description: job.description,
    status: job.status,
    quoteType: job.quoteType,
    siteVisitRequested: job.siteVisitRequested,
    siteVisitFee: job.siteVisitFee != null ? money(job.siteVisitFee) : null,
    serviceCharge: job.serviceCharge != null ? money(job.serviceCharge) : null,
    minBudget: job.minBudget != null ? money(job.minBudget) : null,
    maxBudget: job.maxBudget != null ? money(job.maxBudget) : null,
    scheduledDate: job.scheduledDate,
    timeSlot: job.timeSlot,
    addressLine: job.addressLine,
    city: job.city,
    postcode: job.postcode,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    category: job.category,
    subcategory: job.subcategory,
    address: job.address,
    offer: job.offer
      ? {
          ...job.offer,
          discountValue: money(job.offer.discountValue),
        }
      : null,
    trader: job.trader
      ? {
          id: job.trader.id,
          traderCode: job.trader.traderCode,
          businessName: job.trader.businessName,
          avgRating: Number(job.trader.avgRating ?? 0),
          fullName: job.trader.user?.fullName ?? null,
          email: job.trader.user?.email ?? null,
          mobileNumber: job.trader.user?.mobileNumber ?? null,
          profilePhotoUrl: job.trader.user?.profilePhotoUrl ?? null,
        }
      : null,
    photos: job.photos.map((p) => ({
      id: p.id,
      photoUrl: p.photoUrl,
      createdAt: p.createdAt,
    })),
    quotes: job.quotes.map((q) => ({
      id: q.id,
      quotedAmount: money(q.quotedAmount),
      currencyCode: q.currencyCode,
      status: q.status,
      notes: q.notes,
      createdAt: q.createdAt,
      trader: q.trader
        ? {
            id: q.trader.id,
            traderCode: q.trader.traderCode,
            businessName: q.trader.businessName,
            fullName: q.trader.user?.fullName ?? null,
          }
        : null,
    })),
    booking: job.booking
      ? {
          id: job.booking.id,
          bookingRef: job.booking.bookingRef,
          status: job.booking.status,
          scheduledDate: job.booking.scheduledDate,
          invoice: job.booking.invoice
            ? {
                id: job.booking.invoice.id,
                invoiceNumber: job.booking.invoice.invoiceNumber,
                status: job.booking.invoice.status,
                serviceCharge: money(job.booking.invoice.serviceCharge),
                traderOfferDiscount: money(job.booking.invoice.traderOfferDiscount),
                promoDiscount: money(job.booking.invoice.promoDiscount),
                platformFee: money(job.booking.invoice.platformFee),
                tax: money(job.booking.invoice.tax),
                totalAmount: money(job.booking.invoice.totalAmount),
                currencyCode: job.booking.invoice.currencyCode,
                payments: job.booking.invoice.payments.map((p) => ({
                  id: p.id,
                  transactionRef: p.transactionRef,
                  amount: money(p.amount),
                  status: p.status,
                  method: p.method,
                  paidAt: p.paidAt,
                  createdAt: p.createdAt,
                })),
              }
            : null,
          rating: job.booking.ratingReview
            ? {
                id: job.booking.ratingReview.id,
                stars: job.booking.ratingReview.stars,
                review: job.booking.ratingReview.review,
                createdAt: job.booking.ratingReview.createdAt,
              }
            : null,
        }
      : null,
  };
};

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const getCustomerPaymentsStats = async (customerId: string) => {
  await assertCustomerExists(customerId);

  const [completed, pending, failed, refunded] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { userId: customerId, status: PaymentStatus.COMPLETED },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { userId: customerId, status: PaymentStatus.PENDING },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { userId: customerId, status: PaymentStatus.FAILED },
    }),
    prisma.refund.aggregate({
      _sum: { refundAmount: true },
      _count: true,
      where: { userId: customerId },
    }),
  ]);

  return {
    totalPaid: round2(money(completed._sum.amount)),
    paymentsCount: completed._count,
    pendingAmount: round2(money(pending._sum.amount)),
    pendingCount: pending._count,
    failedCount: failed._count,
    refundedAmount: round2(money(refunded._sum.refundAmount)),
    refundsCount: refunded._count,
    currencyCode: 'EUR',
  };
};

export const listCustomerPayments = async (
  customerId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    status?: PaymentStatus;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    from?: string;
    to?: string;
  }
) => {
  await assertCustomerExists(customerId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.PaymentWhereInput = {
    userId: customerId,
    ...dateRangeFilter(filters.from, filters.to, 'createdAt'),
  };
  if (filters.status) where.status = filters.status;

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { transactionRef: { contains: q, mode: 'insensitive' } },
      { invoice: { invoiceNumber: { contains: q, mode: 'insensitive' } } },
      { invoice: { booking: { job: { jobRef: { contains: q, mode: 'insensitive' } } } } },
      {
        invoice: {
          booking: { trader: { businessName: { contains: q, mode: 'insensitive' } } },
        },
      },
    ];
  }

  const orderBy: Prisma.PaymentOrderByWithRelationInput =
    filters.sortBy === 'amount'
      ? { amount: sortOrder }
      : filters.sortBy === 'status'
        ? { status: sortOrder }
        : filters.sortBy === 'paidAt'
          ? { paidAt: sortOrder }
          : { createdAt: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            currencyCode: true,
            status: true,
            booking: {
              select: {
                id: true,
                bookingRef: true,
                trader: {
                  select: {
                    id: true,
                    businessName: true,
                    user: { select: { fullName: true } },
                  },
                },
                job: { select: { id: true, jobRef: true, title: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    payments: rows.map((p) => ({
      id: p.id,
      transactionRef: p.transactionRef,
      amount: money(p.amount),
      status: p.status,
      method: p.method,
      billingType: p.billingType,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      currencyCode: p.invoice?.currencyCode ?? 'EUR',
      invoice: p.invoice
        ? {
            id: p.invoice.id,
            invoiceNumber: p.invoice.invoiceNumber,
            totalAmount: money(p.invoice.totalAmount),
            status: p.invoice.status,
          }
        : null,
      job: p.invoice?.booking?.job ?? null,
      trader: p.invoice?.booking?.trader
        ? {
            id: p.invoice.booking.trader.id,
            businessName: p.invoice.booking.trader.businessName,
            fullName: p.invoice.booking.trader.user?.fullName ?? null,
          }
        : null,
      bookingRef: p.invoice?.booking?.bookingRef ?? null,
    })),
  };
};

export const listCustomerRefunds = async (
  customerId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    from?: string;
    to?: string;
  }
) => {
  await assertCustomerExists(customerId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.RefundWhereInput = {
    userId: customerId,
    ...dateRangeFilter(filters.from, filters.to, 'createdAt'),
  };

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { reason: { contains: q, mode: 'insensitive' } },
      ...( /^[0-9a-f-]{36}$/i.test(q) ? [{ id: q }] : []),
    ];
  }

  const orderBy: Prisma.RefundOrderByWithRelationInput =
    filters.sortBy === 'amount'
      ? { refundAmount: sortOrder }
      : filters.sortBy === 'status'
        ? { status: sortOrder }
        : { createdAt: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.refund.count({ where }),
    prisma.refund.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        payment: {
          select: {
            id: true,
            transactionRef: true,
            amount: true,
            method: true,
          },
        },
      },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    refunds: rows.map((r) => ({
      id: r.id,
      refundRef: r.refundRef,
      amount: money(r.refundAmount),
      originalAmount: money(r.originalAmount),
      currencyCode: r.currencyCode,
      status: r.status,
      reason: r.reason,
      processedAt: r.processedAt,
      createdAt: r.createdAt,
      payment: r.payment
        ? {
            id: r.payment.id,
            transactionRef: r.payment.transactionRef,
            amount: money(r.payment.amount),
            method: r.payment.method,
          }
        : null,
    })),
  };
};

// ---------------------------------------------------------------------------
// Offers / claims
// ---------------------------------------------------------------------------

export const getCustomerOffersStats = async (customerId: string) => {
  await assertCustomerExists(customerId);

  const [claimed, used, expired, cancelled] = await Promise.all([
    prisma.offerClaim.count({ where: { userId: customerId, status: OfferClaimStatus.CLAIMED } }),
    prisma.offerClaim.count({ where: { userId: customerId, status: OfferClaimStatus.USED } }),
    prisma.offerClaim.count({ where: { userId: customerId, status: OfferClaimStatus.EXPIRED } }),
    prisma.offerClaim.count({ where: { userId: customerId, status: OfferClaimStatus.CANCELLED } }),
  ]);

  return {
    total: claimed + used + expired + cancelled,
    claimed,
    used,
    expired,
    cancelled,
  };
};

export const listCustomerOffers = async (
  customerId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    state?: string;
    status?: OfferClaimStatus;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    from?: string;
    to?: string;
  }
) => {
  await assertCustomerExists(customerId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.OfferClaimWhereInput = {
    userId: customerId,
    ...dateRangeFilter(filters.from, filters.to, 'claimedAt'),
  };

  const state = filters.state?.toUpperCase();
  if (filters.status) {
    where.status = filters.status;
  } else if (state && state !== 'ALL') {
    if (state === 'CLAIMED') where.status = OfferClaimStatus.CLAIMED;
    else if (state === 'USED') where.status = OfferClaimStatus.USED;
    else if (state === 'EXPIRED') where.status = OfferClaimStatus.EXPIRED;
    else if (state === 'CANCELLED') where.status = OfferClaimStatus.CANCELLED;
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { offer: { title: { contains: q, mode: 'insensitive' } } },
      { offer: { offerCode: { contains: q, mode: 'insensitive' } } },
      { offer: { couponCode: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const orderBy: Prisma.OfferClaimOrderByWithRelationInput =
    filters.sortBy === 'usedAt'
      ? { usedAt: sortOrder }
      : filters.sortBy === 'status'
        ? { status: sortOrder }
        : { claimedAt: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.offerClaim.count({ where }),
    prisma.offerClaim.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        offer: {
          select: {
            id: true,
            offerCode: true,
            title: true,
            couponCode: true,
            discountType: true,
            discountValue: true,
            currencyCode: true,
            offerType: true,
            status: true,
            validFrom: true,
            validUntil: true,
            trader: {
              select: {
                id: true,
                businessName: true,
                user: { select: { fullName: true } },
              },
            },
          },
        },
        job: { select: { id: true, jobRef: true, title: true } },
      },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    offers: rows.map((c) => ({
      id: c.id,
      status: c.status,
      claimedAt: c.claimedAt,
      usedAt: c.usedAt,
      job: c.job,
      offer: c.offer
        ? {
            id: c.offer.id,
            offerCode: c.offer.offerCode,
            title: c.offer.title,
            couponCode: c.offer.couponCode,
            discountType: c.offer.discountType,
            discountValue: money(c.offer.discountValue),
            currencyCode: c.offer.currencyCode,
            offerType: c.offer.offerType,
            status: c.offer.status,
            validFrom: c.offer.validFrom,
            validUntil: c.offer.validUntil,
            trader: c.offer.trader
              ? {
                  id: c.offer.trader.id,
                  businessName: c.offer.trader.businessName,
                  fullName: c.offer.trader.user?.fullName ?? null,
                }
              : null,
          }
        : null,
    })),
  };
};

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export const getCustomerReviewsStats = async (customerId: string) => {
  await assertCustomerExists(customerId);

  const reviews = await prisma.ratingReview.findMany({
    where: { customerId },
    select: { stars: true },
  });

  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let sum = 0;
  for (const r of reviews) {
    const key = String(r.stars);
    if (distribution[key] != null) distribution[key] += 1;
    sum += r.stars;
  }

  const total = reviews.length;
  return {
    average: total > 0 ? round2(sum / total) : 0,
    total,
    distribution,
  };
};

export const listCustomerReviews = async (
  customerId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    stars?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    from?: string;
    to?: string;
  }
) => {
  await assertCustomerExists(customerId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.RatingReviewWhereInput = {
    customerId,
    ...dateRangeFilter(filters.from, filters.to, 'createdAt'),
  };
  if (filters.stars) where.stars = Number(filters.stars);

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { review: { contains: q, mode: 'insensitive' } },
      { trader: { businessName: { contains: q, mode: 'insensitive' } } },
      { booking: { job: { jobRef: { contains: q, mode: 'insensitive' } } } },
      { booking: { job: { title: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  const orderBy: Prisma.RatingReviewOrderByWithRelationInput =
    filters.sortBy === 'stars' ? { stars: sortOrder } : { createdAt: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.ratingReview.count({ where }),
    prisma.ratingReview.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        trader: {
          select: {
            id: true,
            businessName: true,
            traderCode: true,
            user: { select: { fullName: true, profilePhotoUrl: true } },
          },
        },
        booking: {
          select: {
            id: true,
            bookingRef: true,
            job: {
              select: {
                id: true,
                jobRef: true,
                title: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    reviews: rows.map((r) => ({
      id: r.id,
      stars: r.stars,
      review: r.review,
      createdAt: r.createdAt,
      trader: {
        id: r.trader.id,
        traderCode: r.trader.traderCode,
        businessName: r.trader.businessName,
        fullName: r.trader.user?.fullName ?? null,
        profilePhotoUrl: r.trader.user?.profilePhotoUrl ?? null,
      },
      bookingRef: r.booking.bookingRef,
      job: r.booking.job,
    })),
  };
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const listCustomerNotifications = async (
  customerId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    read?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    from?: string;
    to?: string;
  }
) => {
  await assertCustomerExists(customerId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.NotificationWhereInput = {
    userId: customerId,
    ...dateRangeFilter(filters.from, filters.to, 'createdAt'),
  };
  if (filters.read === 'true') where.read = true;
  if (filters.read === 'false') where.read = false;
  if (filters.type) where.type = filters.type;

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [{ type: { contains: q, mode: 'insensitive' } }];
  }

  const orderBy: Prisma.NotificationOrderByWithRelationInput = { createdAt: sortOrder };

  const [total, unreadCount, rows] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: customerId, read: false } }),
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy,
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0, unreadCount },
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      payload: n.payload,
      read: n.read,
      createdAt: n.createdAt,
    })),
  };
};

export const markCustomerNotificationsRead = async (customerId: string) => {
  await assertCustomerExists(customerId);
  const result = await prisma.notification.updateMany({
    where: { userId: customerId, read: false },
    data: { read: true },
  });
  return { updatedCount: result.count };
};

// ---------------------------------------------------------------------------
// Activity (audit logs where subject is this customer)
// ---------------------------------------------------------------------------

export const listCustomerActivity = async (
  customerId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    eventType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    from?: string;
    to?: string;
  }
) => {
  await assertCustomerExists(customerId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Prisma.AuditLogWhereInput = {
    OR: [
      { subjectType: 'USER', subjectId: customerId },
      { subjectType: 'Customer', subjectId: customerId },
      { subjectType: 'customer', subjectId: customerId },
      { actorType: 'CUSTOMER', actorId: customerId },
    ],
    ...dateRangeFilter(filters.from, filters.to, 'createdAt'),
  };

  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.AND = [
      {
        OR: [
          { description: { contains: q, mode: 'insensitive' } },
          { eventType: { contains: q, mode: 'insensitive' } },
          { actorLabel: { contains: q, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: sortOrder },
    }),
  ]);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    activity: rows.map((a) => ({
      id: a.id,
      eventType: a.eventType,
      actorType: a.actorType,
      actorId: a.actorId,
      actorLabel: a.actorLabel,
      subjectType: a.subjectType,
      subjectId: a.subjectId,
      description: a.description,
      createdAt: a.createdAt,
    })),
  };
};

// ---------------------------------------------------------------------------
// Chats — conversations grouped by job involving this customer
// ---------------------------------------------------------------------------

export const listCustomerChats = async (
  customerId: string,
  filters: {
    page?: string;
    limit?: string;
    search?: string;
    sortOrder?: 'asc' | 'desc';
  }
) => {
  await assertCustomerExists(customerId);

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;

  // Jobs owned by customer that have chat messages
  const jobsWithChat = await prisma.job.findMany({
    where: {
      customerId,
      chatMessages: { some: {} },
      ...(filters.search?.trim()
        ? {
            OR: [
              { jobRef: { contains: filters.search.trim(), mode: 'insensitive' } },
              { title: { contains: filters.search.trim(), mode: 'insensitive' } },
              {
                trader: {
                  businessName: { contains: filters.search.trim(), mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      jobRef: true,
      title: true,
      status: true,
      trader: {
        select: {
          id: true,
          businessName: true,
          user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
        },
      },
      chatMessages: {
        orderBy: { sentAt: 'desc' },
        take: 1,
        select: {
          id: true,
          message: true,
          sentAt: true,
          senderId: true,
        },
      },
      _count: { select: { chatMessages: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const total = jobsWithChat.length;
  const sliced = jobsWithChat.slice(skip, skip + limit);

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    conversations: sliced.map((j) => ({
      jobId: j.id,
      jobRef: j.jobRef,
      title: j.title,
      status: j.status,
      trader: j.trader
        ? {
            id: j.trader.id,
            businessName: j.trader.businessName,
            userId: j.trader.user?.id ?? null,
            fullName: j.trader.user?.fullName ?? null,
            profilePhotoUrl: j.trader.user?.profilePhotoUrl ?? null,
          }
        : null,
      lastMessage: j.chatMessages[0]
        ? {
            id: j.chatMessages[0].id,
            message: j.chatMessages[0].message,
            sentAt: j.chatMessages[0].sentAt,
            senderId: j.chatMessages[0].senderId,
          }
        : null,
      messagesCount: j._count.chatMessages,
    })),
  };
};

export const getCustomerChatThread = async (
  customerId: string,
  jobId: string,
  filters: { page?: string; limit?: string }
) => {
  await assertCustomerExists(customerId);

  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId },
    select: {
      id: true,
      jobRef: true,
      title: true,
      trader: {
        select: {
          id: true,
          businessName: true,
          user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
        },
      },
    },
  });
  if (!job) throw new NotFoundError('Job not found for this customer.');

  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const skip = (page - 1) * limit;

  const where: Prisma.ChatMessageWhereInput = { jobId };

  const [total, rows] = await Promise.all([
    prisma.chatMessage.count({ where }),
    prisma.chatMessage.findMany({
      where,
      skip,
      take: limit,
      orderBy: { sentAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true,
            profilePhotoUrl: true,
          },
        },
      },
    }),
  ]);

  return {
    job: {
      id: job.id,
      jobRef: job.jobRef,
      title: job.title,
      trader: job.trader
        ? {
            id: job.trader.id,
            businessName: job.trader.businessName,
            userId: job.trader.user?.id ?? null,
            fullName: job.trader.user?.fullName ?? null,
            profilePhotoUrl: job.trader.user?.profilePhotoUrl ?? null,
          }
        : null,
    },
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    messages: rows.map((m) => ({
      id: m.id,
      message: m.message,
      sentAt: m.sentAt,
      sender: m.sender,
      isFromCustomer: m.senderId === customerId,
    })),
  };
};
