import {
  BookingStatus,
  JobPhotoKind,
  JobQuoteType,
  JobStatus,
  Prisma,
  QuoteStatus,
  TraderPaymentRequestStatus,
  TraderPaymentRequestType,
  TraderSiteVisitStatus,
} from '@prisma/client';
import { prisma } from '../../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../../utils/errors';
import { buildPaginationMeta } from '../../../utils/pagination';
import { resolveCategoryIconUrl } from '../../categories/categories.serializers';

const EARTH_RADIUS_KM = 6371;
const DUBLIN_ORIGIN = { lat: 53.3498, lng: -6.2603 };
const PLATFORM_FEE = 10;
const VAT_RATE = 0.2;

type Origin = { lat: number; lng: number };
type MyJobsTab = 'ACTIVE' | 'COMPLETED' | 'OTHER';

const ACTIVE_JOB_STATUSES: JobStatus[] = [
  JobStatus.ACCEPTED,
  JobStatus.SCHEDULED,
  JobStatus.IN_PROGRESS,
];
const COMPLETED_JOB_STATUSES: JobStatus[] = [JobStatus.COMPLETED, JobStatus.PAYMENT_PENDING];
const money = (v: Prisma.Decimal | number | null | undefined): number => {
  if (v == null) return 0;
  return Number(v);
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const parsePage = (v?: string) => Math.max(1, Number.parseInt(v || '1', 10) || 1);
const parseLimit = (v?: string) => Math.min(50, Math.max(1, Number.parseInt(v || '20', 10) || 20));

const haversineKm = (a: Origin, b: Origin): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const syntheticDistanceKm = (jobId: string): number => {
  let hash = 0;
  for (let i = 0; i < jobId.length; i += 1) {
    hash = (hash * 31 + jobId.charCodeAt(i)) >>> 0;
  }
  return Math.round((0.8 + (hash % 78) / 10) * 10) / 10;
};

const resolveJobCoords = (
  job: { id: string; latitude: number | null; longitude: number | null },
  origin: Origin
): Origin => {
  if (job.latitude != null && job.longitude != null) {
    return { lat: job.latitude, lng: job.longitude };
  }
  const d = syntheticDistanceKm(job.id);
  const bearing = (job.id.charCodeAt(0) % 360) * (Math.PI / 180);
  return {
    lat: origin.lat + (d / 111) * Math.cos(bearing),
    lng: origin.lng + (d / (111 * Math.cos((origin.lat * Math.PI) / 180) || 1)) * Math.sin(bearing),
  };
};

const getTraderContext = async (userId: string) => {
  const trader = await prisma.trader.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      categoryId: true,
      serviceRadiusKm: true,
      serviceCenterLat: true,
      serviceCenterLng: true,
      categories: { select: { categoryId: true } },
    },
  });
  if (!trader) {
    throw new NotFoundError('Trader profile not found.');
  }
  return trader;
};

const resolveOrigin = (trader: {
  serviceCenterLat: Prisma.Decimal | null;
  serviceCenterLng: Prisma.Decimal | null;
}): Origin => {
  if (trader.serviceCenterLat != null && trader.serviceCenterLng != null) {
    return {
      lat: Number(trader.serviceCenterLat),
      lng: Number(trader.serviceCenterLng),
    };
  }
  return DUBLIN_ORIGIN;
};

const traderJobAccessWhere = (traderId: string): Prisma.JobWhereInput => ({
  OR: [
    { traderId },
    { siteVisitRequests: { some: { traderId, status: { not: TraderSiteVisitStatus.CANCELLED } } } },
    { quotes: { some: { traderId } } },
  ],
});

const tabStatusWhere = (tab: MyJobsTab, traderId: string): Prisma.JobWhereInput => {
  if (tab === 'ACTIVE') {
    // Only customer-confirmed / assigned running jobs — not Discover quotes or waiting requests.
    return {
      traderId,
      OR: [
        { status: { in: ACTIVE_JOB_STATUSES } },
        {
          booking: {
            traderId,
            status: { in: [BookingStatus.SCHEDULED, BookingStatus.IN_PROGRESS] },
          },
        },
      ],
    };
  }
  if (tab === 'COMPLETED') {
    return { status: { in: COMPLETED_JOB_STATUSES } };
  }
  return {
    NOT: {
      OR: [
        { status: { in: ACTIVE_JOB_STATUSES } },
        { status: { in: COMPLETED_JOB_STATUSES } },
        {
          booking: {
            traderId,
            status: { in: [BookingStatus.SCHEDULED, BookingStatus.IN_PROGRESS] },
          },
        },
      ],
    },
  };
};

const statusBadgeFor = (status: JobStatus): string => {
  if (status === JobStatus.CANCELLED) return 'Cancelled';
  if (status === JobStatus.PAYMENT_PENDING) return 'Awaiting Payout';
  if (COMPLETED_JOB_STATUSES.includes(status)) return 'Completed';
  if (ACTIVE_JOB_STATUSES.includes(status)) return 'Active';
  return 'Open';
};

const formatFullAddress = (job: {
  addressLine: string | null;
  city: string | null;
  postcode: string | null;
  address?: {
    houseNumber: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    county: string | null;
    eircode: string | null;
    country: string;
  } | null;
}): string => {
  if (job.address) {
    const a = job.address;
    return [
      [a.houseNumber, a.addressLine1].filter(Boolean).join(' '),
      a.addressLine2,
      a.city,
      a.county,
      a.eircode,
      a.country,
    ]
      .filter((p) => p && String(p).trim())
      .join(', ');
  }
  return [job.addressLine, job.city, job.postcode].filter(Boolean).join(', ') || 'Address TBD';
};

/** Ensure job is accessible to this trader (assigned, site visit, or quote). */
const assertMyJob = async (traderId: string, jobId: string) => {
  const job = await prisma.job.findFirst({
    where: { id: jobId, ...traderJobAccessWhere(traderId) },
    include: {
      address: true,
      booking: true,
      customer: {
        select: {
          id: true,
          fullName: true,
          profilePhotoUrl: true,
          mobileVerified: true,
          emailVerified: true,
          mobileNumber: true,
          _count: { select: { jobs: true } },
        },
      },
      category: { select: { id: true, name: true, iconName: true, urlSlug: true } },
      subcategory: { select: { id: true, name: true, urlSlug: true } },
      photos: { orderBy: { createdAt: 'asc' } },
      materials: {
        where: { traderId },
        orderBy: { createdAt: 'desc' },
      },
      quotes: {
        where: { traderId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      siteVisitRequests: {
        where: { traderId, status: { not: TraderSiteVisitStatus.CANCELLED } },
        take: 1,
      },
      paymentRequests: {
        where: { traderId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
  if (!job) {
    throw new NotFoundError('Job not found or not available for this trader.');
  }
  return job;
};

/**
 * Quote from Discover Job Details OR My Jobs.
 * Open marketplace (PUBLISHED + unassigned) is allowed; already-linked jobs too.
 */
const assertJobForQuote = async (traderId: string, jobId: string) => {
  const linked = await prisma.job.findFirst({
    where: { id: jobId, ...traderJobAccessWhere(traderId) },
    select: { id: true, status: true, traderId: true },
  });
  if (linked) {
    if (linked.traderId && linked.traderId !== traderId) {
      throw new ConflictError('Job is already assigned to another trader.');
    }
    return linked;
  }

  const open = await prisma.job.findFirst({
    where: { id: jobId, status: JobStatus.PUBLISHED, traderId: null },
    select: { id: true, status: true, traderId: true },
  });
  if (!open) {
    throw new NotFoundError('Job not found or no longer available for quoting.');
  }
  return open;
};

type MyJobRow = Awaited<ReturnType<typeof assertMyJob>>;

const materialsSummary = (materials: { price: Prisma.Decimal }[]) => {
  const total = round2(materials.reduce((s, m) => s + money(m.price), 0));
  return {
    count: materials.length,
    total,
  };
};

const resolveQuotePrice = (job: MyJobRow): number | null => {
  const q = job.quotes[0];
  if (q) return money(q.quotedAmount);
  if (job.serviceCharge != null) return money(job.serviceCharge);
  return null;
};

const buildActions = (job: MyJobRow, traderId: string) => {
  const visit = job.siteVisitRequests[0] ?? null;
  const booking = job.booking;
  const assignedToThis = job.traderId === traderId;

  const hasActiveVisit =
    visit &&
    visit.status !== TraderSiteVisitStatus.CANCELLED &&
    visit.status !== TraderSiteVisitStatus.COMPLETED;
  const visitCompleted = visit?.status === TraderSiteVisitStatus.COMPLETED;
  const bookingArrived = Boolean(booking?.arrivedAt);
  const bookingFinished = Boolean(booking?.finishedAt);
  const isInProgress =
    job.status === JobStatus.IN_PROGRESS || booking?.status === BookingStatus.IN_PROGRESS;
  const canArrive =
    Boolean(booking) &&
    booking?.traderId === traderId &&
    !bookingArrived &&
    !bookingFinished &&
    (job.status === JobStatus.ACCEPTED ||
      job.status === JobStatus.SCHEDULED ||
      job.status === JobStatus.IN_PROGRESS);
  const canFinish =
    Boolean(booking) &&
    booking?.traderId === traderId &&
    bookingArrived &&
    !bookingFinished &&
    isInProgress;
  const canAddMaterials =
    assignedToThis &&
    (job.status === JobStatus.ACCEPTED ||
      job.status === JobStatus.SCHEDULED ||
      job.status === JobStatus.IN_PROGRESS);
  const canSubmitQuote =
    (!job.quotes[0] || job.quotes[0].status === QuoteStatus.PENDING) &&
    (job.status === JobStatus.PUBLISHED ||
      job.status === JobStatus.QUOTED ||
      job.status === JobStatus.ACCEPTED ||
      Boolean(visit));
  const canAcceptJob =
    (!job.traderId || job.traderId === traderId) &&
    (job.status === JobStatus.PUBLISHED ||
      job.status === JobStatus.QUOTED ||
      (Boolean(visit) && !assignedToThis));
  const canRequestPayment =
    assignedToThis &&
    job.status !== JobStatus.PAYMENT_PENDING &&
    (job.status === JobStatus.COMPLETED || Boolean(bookingFinished));
  const canCompleteSiteVisit = Boolean(hasActiveVisit) && !visitCompleted;
  const canRequestSiteVisitPayment =
    Boolean(visitCompleted) &&
    !job.paymentRequests.some(
      (p) =>
        p.type === TraderPaymentRequestType.SITE_VISIT_FEE &&
        p.status !== TraderPaymentRequestStatus.CANCELLED
    );

  return {
    canArrive,
    canFinish,
    canAddMaterials,
    canSubmitQuote,
    canAcceptJob,
    canRequestPayment,
    canCompleteSiteVisit,
    canRequestSiteVisitPayment,
  };
};

const resolvePrimaryAction = (
  actions: ReturnType<typeof buildActions>,
  job: MyJobRow
): { primaryAction: string } => {
  if (actions.canArrive) return { primaryAction: 'ARRIVE' };
  if (actions.canFinish) return { primaryAction: 'FINISH' };
  if (actions.canCompleteSiteVisit) return { primaryAction: 'COMPLETE_SITE_VISIT' };
  if (actions.canRequestSiteVisitPayment) return { primaryAction: 'REQUEST_SITE_VISIT_PAYMENT' };
  if (actions.canRequestPayment) return { primaryAction: 'REQUEST_PAYMENT' };
  if (actions.canAcceptJob) return { primaryAction: 'ACCEPT_JOB' };
  if (actions.canSubmitQuote) return { primaryAction: 'SUBMIT_QUOTE' };
  if (actions.canAddMaterials) return { primaryAction: 'ADD_MATERIALS' };
  if (job.status === JobStatus.PAYMENT_PENDING) return { primaryAction: 'AWAITING_PAYOUT' };
  return { primaryAction: 'VIEW_DETAILS' };
};

const siteVisitBlock = (job: MyJobRow) => {
  const visit = job.siteVisitRequests[0] ?? null;
  const fee = money(job.siteVisitFee);
  if (!visit && !job.siteVisitRequested) {
    return {
      status: 'NONE' as const,
      fee: null as number | null,
    };
  }

  return {
    status: visit?.status ?? 'NONE',
    fee: fee > 0 ? fee : null,
  };
};

const arrivalStatus = (job: MyJobRow): 'ARRIVING_SOON' | 'ARRIVED' | null => {
  const booking = job.booking;
  if (!booking) return null;
  if (booking.arrivedAt) return 'ARRIVED';
  if (
    booking.status === BookingStatus.SCHEDULED ||
    booking.status === BookingStatus.IN_PROGRESS
  ) {
    return 'ARRIVING_SOON';
  }
  return null;
};

const computePaymentBreakdown = (job: MyJobRow, opts?: { siteVisitOnly?: boolean }) => {
  const materialsTotal = round2(job.materials.reduce((s, m) => s + money(m.price), 0));
  const siteVisitFee = money(job.siteVisitFee);
  const quotePrice = resolveQuotePrice(job) ?? 0;

  if (opts?.siteVisitOnly) {
    const subtotal = siteVisitFee;
    const platformFee = 0;
    const vatAmount = round2(subtotal * VAT_RATE);
    const totalAmount = round2(subtotal + vatAmount);
    return {
      serviceCharge: 0,
      materialsTotal: 0,
      siteVisitFee,
      platformFee,
      vatRate: VAT_RATE,
      vatAmount,
      totalAmount,
    };
  }

  const serviceCharge = quotePrice;
  const platformFee = PLATFORM_FEE;
  const subtotal = round2(serviceCharge + materialsTotal + siteVisitFee + platformFee);
  const vatAmount = round2(subtotal * VAT_RATE);
  const totalAmount = round2(subtotal + vatAmount);

  return {
    serviceCharge,
    materialsTotal,
    siteVisitFee,
    platformFee,
    vatRate: VAT_RATE,
    vatAmount,
    totalAmount,
  };
};

export const listMyJobs = async (
  userId: string,
  query: { tab?: string; page?: string; limit?: string }
) => {
  const trader = await getTraderContext(userId);
  const tab = (query.tab || 'ACTIVE') as MyJobsTab;
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);

  const where: Prisma.JobWhereInput = {
    AND: [traderJobAccessWhere(trader.id), tabStatusWhere(tab, trader.id)],
  };

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      select: {
        id: true,
        jobRef: true,
        title: true,
        status: true,
        traderId: true,
        city: true,
        postcode: true,
        latitude: true,
        longitude: true,
        serviceCharge: true,
        scheduledDate: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { fullName: true, profilePhotoUrl: true } },
        address: { select: { city: true, county: true, latitude: true, longitude: true } },
        quotes: {
          where: { traderId: trader.id },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { quotedAmount: true, status: true },
        },
        siteVisitRequests: {
          where: { traderId: trader.id, status: { not: TraderSiteVisitStatus.CANCELLED } },
          select: { status: true },
          take: 1,
        },
        booking: { select: { status: true, traderId: true, arrivedAt: true, finishedAt: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const origin = resolveOrigin(trader);

  const items = jobs.map((job) => {
    const visit = job.siteVisitRequests[0];
    const siteVisitedBadge =
      visit?.status === TraderSiteVisitStatus.COMPLETED ||
      visit?.status === TraderSiteVisitStatus.CONFIRMED;
    const coords = resolveJobCoords(
      {
        id: job.id,
        latitude: job.latitude ?? job.address?.latitude ?? null,
        longitude: job.longitude ?? job.address?.longitude ?? null,
      },
      origin
    );
    const distanceKm = Math.round(haversineKm(origin, coords) * 10) / 10;
    const quotePrice =
      (job.quotes[0] ? money(job.quotes[0].quotedAmount) : null) ||
      (job.serviceCharge != null ? money(job.serviceCharge) : null);
    const areaName =
      job.city?.trim() ||
      job.address?.city?.trim() ||
      job.address?.county?.trim() ||
      job.postcode?.trim() ||
      'Nearby';

    let primaryAction = 'VIEW_DETAILS';
    if (job.booking && !job.booking.arrivedAt && !job.booking.finishedAt) {
      primaryAction = 'ARRIVE';
    } else if (job.booking?.arrivedAt && !job.booking.finishedAt) {
      primaryAction = 'FINISH';
    } else if (job.status === JobStatus.PAYMENT_PENDING) {
      primaryAction = 'AWAITING_PAYOUT';
    } else if (COMPLETED_JOB_STATUSES.includes(job.status)) {
      primaryAction = 'VIEW_DETAILS';
    }

    return {
      id: job.id,
      jobRef: job.jobRef,
      title: job.title,
      status: job.status,
      statusBadge: statusBadgeFor(job.status),
      siteVisitedBadge: Boolean(siteVisitedBadge),
      customerName: job.customer.fullName,
      customerProfilePhotoUrl: job.customer.profilePhotoUrl,
      areaName,
      distanceKm,
      quotePrice,
      scheduledDate: job.scheduledDate,
      createdAt: job.createdAt,
      primaryAction,
    };
  });

  return {
    tab,
    items,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const getMyJobDetail = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const origin = resolveOrigin(trader);
  const job = await assertMyJob(trader.id, jobId);

  const coords = resolveJobCoords(
    {
      id: job.id,
      latitude: job.latitude ?? job.address?.latitude ?? null,
      longitude: job.longitude ?? job.address?.longitude ?? null,
    },
    origin
  );
  const distanceKm = Math.round(haversineKm(origin, coords) * 10) / 10;
  const quotePrice = resolveQuotePrice(job);
  const materials = materialsSummary(job.materials);
  const actions = buildActions(job, trader.id);
  const primary = resolvePrimaryAction(actions, job);
  const customerVerified = Boolean(job.customer.mobileVerified || job.customer.emailVerified);

  const customerPhotos = job.photos.filter((p) => p.kind === JobPhotoKind.CUSTOMER);
  const proofPhotos = job.photos.filter((p) => p.kind === JobPhotoKind.PROOF);

  const messages = await prisma.chatMessage.findMany({
    where: { jobId: job.id },
    orderBy: { sentAt: 'desc' },
    take: 5,
    include: {
      sender: { select: { id: true, fullName: true, role: true } },
    },
  });

  const negotiationMessages = messages.reverse().map((m) => ({
    id: m.id,
    senderRole: m.sender.role,
    senderName: m.sender.fullName,
    message: m.message,
    sentAt: m.sentAt,
    isMine: m.senderId === trader.userId,
  }));

  const categoryIconUrl = job.category
    ? resolveCategoryIconUrl({
        iconName: job.category.iconName,
        urlSlug: job.category.urlSlug,
      })
    : null;
  const subcategoryIconUrl = job.subcategory
    ? resolveCategoryIconUrl({
        iconName: null,
        urlSlug: job.subcategory.urlSlug,
      })
    : null;

  const tags = [
    job.category
      ? {
          label: job.category.name,
          icon: categoryIconUrl,
          iconUrl: categoryIconUrl,
          iconName: job.category.iconName,
        }
      : null,
    job.subcategory
      ? {
          label: job.subcategory.name,
          icon: subcategoryIconUrl,
          iconUrl: subcategoryIconUrl,
          iconName: null as string | null,
        }
      : null,
  ].filter(Boolean);

  const estimatedEarnings =
    quotePrice ?? (job.serviceCharge != null ? money(job.serviceCharge) : null);

  return {
    id: job.id,
    title: job.title,
    createdAt: job.createdAt,
    jobRef: job.jobRef,
    description: job.description,
    status: job.status,
    photos: customerPhotos.map((p) => p.photoUrl),
    proofPhotos: proofPhotos.map((p) => ({ id: p.id, photoUrl: p.photoUrl })),
    tags,
    location: {
      fullAddress: formatFullAddress(job),
      areaName: job.city || job.address?.city || job.postcode || 'Nearby',
      distanceKm,
      latitude: coords.lat,
      longitude: coords.lng,
    },
    distanceKm,
    quotePrice,
    customer: {
      fullName: job.customer.fullName,
      profilePhotoUrl: job.customer.profilePhotoUrl,
      isVerified: customerVerified,
      phoneNumber: job.phoneNumber || job.customer.mobileNumber || null,
      rating: null as number | null,
      jobsPosted: job.customer._count.jobs,
    },
    siteVisit: siteVisitBlock(job),
    materials,
    negotiationMessages,
    ...actions,
    ...primary,
    estimatedEarnings,
    durationLabel: job.durationLabel,
    arrivalStatus: arrivalStatus(job),
  };
};

export const arriveAtJob = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);

  if (!job.booking || job.booking.traderId !== trader.id) {
    throw new BadRequestError('No booking found for this job.');
  }
  if (job.booking.arrivedAt) {
    throw new ConflictError('Already marked as arrived.');
  }
  if (job.booking.finishedAt) {
    throw new ConflictError('Job already finished.');
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.booking.update({
      where: { id: job.booking.id },
      data: { arrivedAt: now, status: BookingStatus.IN_PROGRESS },
    }),
    prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.IN_PROGRESS },
    }),
  ]);

  return getMyJobDetail(userId, jobId);
};

export const finishJob = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);

  if (!job.booking || job.booking.traderId !== trader.id) {
    throw new BadRequestError('No booking found for this job.');
  }
  if (!job.booking.arrivedAt) {
    throw new BadRequestError('Mark arrival before finishing the job.');
  }
  if (job.booking.finishedAt) {
    throw new ConflictError('Job already finished.');
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.booking.update({
      where: { id: job.booking.id },
      data: { finishedAt: now, status: BookingStatus.COMPLETED },
    }),
    prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.COMPLETED },
    }),
  ]);

  return getMyJobDetail(userId, jobId);
};

export const upsertQuote = async (
  userId: string,
  jobId: string,
  body: { amount: number; notes?: string }
) => {
  const trader = await getTraderContext(userId);
  await assertJobForQuote(trader.id, jobId);

  const existing = await prisma.quote.findFirst({
    where: { jobId, traderId: trader.id },
    orderBy: { createdAt: 'desc' },
  });

  const quote = existing
    ? await prisma.quote.update({
        where: { id: existing.id },
        data: {
          quotedAmount: body.amount,
          notes: body.notes ?? existing.notes,
          status: QuoteStatus.PENDING,
        },
      })
    : await prisma.quote.create({
        data: {
          jobId,
          traderId: trader.id,
          quotedAmount: body.amount,
          notes: body.notes,
          status: QuoteStatus.PENDING,
        },
      });

  // Keep job PUBLISHED on Discover until customer confirms the trader.
  const isJobRequested = Boolean(quote.requestedAt);
  const isWaitingForCustomerConfirmation = isJobRequested; // open marketplace only at this point
  return {
    id: quote.id,
    jobId,
    amount: money(quote.quotedAmount),
    notes: quote.notes,
    status: quote.status,
    jobStatus: JobStatus.PUBLISHED,
    assignmentStatus: isWaitingForCustomerConfirmation
      ? 'WAITING_FOR_CUSTOMER'
      : 'QUOTED',
    hasSubmittedQuote: true,
    canUpdateQuote: true,
    canSubmitQuote: false,
    isJobRequested,
    isWaitingForCustomerConfirmation,
  };
};

/**
 * Request / Accept Job from Discover — waiting for customer confirmation.
 * Does NOT assign traderId. Job stays PUBLISHED on Discover.
 */
export const requestJob = async (
  userId: string,
  jobId: string,
  body?: { amount?: number; notes?: string }
) => {
  const trader = await getTraderContext(userId);

  const job = await prisma.job.findFirst({
    where: { id: jobId, status: { in: [JobStatus.PUBLISHED, JobStatus.QUOTED] }, traderId: null },
    select: {
      id: true,
      serviceCharge: true,
      siteVisitRequested: true,
      quoteType: true,
      siteVisitFee: true,
    },
  });
  if (!job) {
    throw new NotFoundError('Job not found or no longer available.');
  }

  const existingQuote = await prisma.quote.findFirst({
    where: { jobId, traderId: trader.id },
    orderBy: { createdAt: 'desc' },
  });

  const visit = await prisma.traderSiteVisitRequest.findFirst({
    where: {
      jobId,
      traderId: trader.id,
      status: { not: TraderSiteVisitStatus.CANCELLED },
    },
    select: { id: true },
  });

  const isSiteVisit =
    job.siteVisitRequested || job.quoteType === JobQuoteType.ONSITE;
  if (isSiteVisit && !visit) {
    throw new BadRequestError('Submit preferred site visit date/time before requesting this job.');
  }

  const amount =
    body?.amount ??
    (existingQuote ? money(existingQuote.quotedAmount) : null) ??
    money(job.serviceCharge) ??
    money(job.siteVisitFee);

  if (amount == null || amount <= 0) {
    throw new BadRequestError('Submit a quotation (amount) before requesting this job.');
  }

  if (existingQuote?.requestedAt) {
    return {
      jobId,
      quoteId: existingQuote.id,
      amount: money(existingQuote.quotedAmount),
      jobStatus: JobStatus.PUBLISHED,
      assignmentStatus: 'WAITING_FOR_CUSTOMER' as const,
      hasSubmittedQuote: true,
      isJobRequested: true,
      isWaitingForCustomerConfirmation: true,
    };
  }

  const quote = existingQuote
    ? await prisma.quote.update({
        where: { id: existingQuote.id },
        data: {
          quotedAmount: amount,
          notes: body?.notes ?? existingQuote.notes,
          status: QuoteStatus.PENDING,
          requestedAt: new Date(),
        },
      })
    : await prisma.quote.create({
        data: {
          jobId,
          traderId: trader.id,
          quotedAmount: amount,
          notes: body?.notes,
          status: QuoteStatus.PENDING,
          requestedAt: new Date(),
        },
      });

  return {
    jobId,
    quoteId: quote.id,
    amount: money(quote.quotedAmount),
    jobStatus: JobStatus.PUBLISHED,
    assignmentStatus: 'WAITING_FOR_CUSTOMER' as const,
    hasSubmittedQuote: true,
    isJobRequested: true,
    isWaitingForCustomerConfirmation: true,
  };
};

export const acceptJob = async (
  userId: string,
  jobId: string,
  body?: { amount?: number }
) => {
  const trader = await getTraderContext(userId);

  // Marketplace open job: Request only (may not be in My Jobs yet).
  const open = await prisma.job.findFirst({
    where: {
      id: jobId,
      traderId: null,
      status: { in: [JobStatus.PUBLISHED, JobStatus.QUOTED] },
    },
    select: { id: true },
  });
  if (open) {
    await requestJob(userId, jobId, body);
    return {
      id: jobId,
      isJobRequested: true,
      isWaitingForCustomerConfirmation: true,
      assignmentStatus: 'WAITING_FOR_CUSTOMER',
      jobStatus: JobStatus.PUBLISHED,
      primaryAction: 'WAITING_FOR_CUSTOMER',
    };
  }

  const job = await assertMyJob(trader.id, jobId);

  if (job.traderId && job.traderId !== trader.id) {
    throw new ConflictError('Job is already assigned to another trader.');
  }

  // Already assigned to this trader (e.g. Direct Trader) — ensure booking exists.
  let quoteAmount = body?.amount;
  if (quoteAmount == null) {
    const q = job.quotes[0];
    quoteAmount = q ? money(q.quotedAmount) : money(job.serviceCharge) || undefined;
  }
  if (quoteAmount == null || quoteAmount <= 0) {
    throw new BadRequestError('Provide amount or submit a quote before accepting.');
  }

  const scheduledDate = job.scheduledDate ?? new Date();

  await prisma.$transaction(async (tx) => {
    if (job.quotes[0]) {
      await tx.quote.update({
        where: { id: job.quotes[0].id },
        data: {
          quotedAmount: quoteAmount!,
          status: QuoteStatus.ACCEPTED,
          requestedAt: job.quotes[0].requestedAt ?? new Date(),
        },
      });
    } else {
      await tx.quote.create({
        data: {
          jobId,
          traderId: trader.id,
          quotedAmount: quoteAmount!,
          status: QuoteStatus.ACCEPTED,
          requestedAt: new Date(),
        },
      });
    }

    await tx.job.update({
      where: { id: jobId },
      data: {
        traderId: trader.id,
        status: job.scheduledDate ? JobStatus.SCHEDULED : JobStatus.ACCEPTED,
        serviceCharge: quoteAmount!,
      },
    });

    if (!job.booking) {
      await tx.booking.create({
        data: {
          jobId,
          traderId: trader.id,
          customerId: job.customerId,
          scheduledDate,
          status: BookingStatus.SCHEDULED,
        },
      });
    } else if (job.booking.traderId !== trader.id) {
      throw new ConflictError('Booking exists for another trader.');
    }
  });

  return getMyJobDetail(userId, jobId);
};

/**
 * Customer confirms a trader quote → assign job, create booking, move to My Jobs running.
 */
export const confirmQuoteAssignment = async (params: {
  customerId: string;
  jobId: string;
  quoteId: string;
}) => {
  const job = await prisma.job.findFirst({
    where: { id: params.jobId, customerId: params.customerId },
    include: {
      booking: true,
      quotes: { where: { id: params.quoteId }, take: 1 },
    },
  });
  if (!job) {
    throw new NotFoundError('Job not found.');
  }
  if (job.traderId) {
    throw new ConflictError('A trader is already confirmed for this job.');
  }
  if (job.status !== JobStatus.PUBLISHED && job.status !== JobStatus.QUOTED) {
    throw new BadRequestError('Job is not open for trader confirmation.');
  }

  const quote = job.quotes[0];
  if (!quote || quote.status === QuoteStatus.REJECTED || quote.status === QuoteStatus.EXPIRED) {
    throw new NotFoundError('Quote not found or no longer available.');
  }

  const scheduledDate = job.scheduledDate ?? new Date();
  const amount = money(quote.quotedAmount);

  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quote.id },
      data: { status: QuoteStatus.ACCEPTED },
    });
    await tx.quote.updateMany({
      where: {
        jobId: job.id,
        id: { not: quote.id },
        status: QuoteStatus.PENDING,
      },
      data: { status: QuoteStatus.REJECTED },
    });

    await tx.job.update({
      where: { id: job.id },
      data: {
        traderId: quote.traderId,
        status: job.scheduledDate ? JobStatus.SCHEDULED : JobStatus.ACCEPTED,
        serviceCharge: amount,
      },
    });

    await tx.traderSiteVisitRequest.updateMany({
      where: {
        jobId: job.id,
        traderId: quote.traderId,
        status: TraderSiteVisitStatus.PENDING,
      },
      data: { status: TraderSiteVisitStatus.CONFIRMED },
    });

    if (!job.booking) {
      await tx.booking.create({
        data: {
          jobId: job.id,
          traderId: quote.traderId,
          customerId: job.customerId,
          scheduledDate,
          status: BookingStatus.SCHEDULED,
        },
      });
    }
  });

  return {
    jobId: job.id,
    traderId: quote.traderId,
    quoteId: quote.id,
    status: job.scheduledDate ? JobStatus.SCHEDULED : JobStatus.ACCEPTED,
    amount,
  };
};

export const listMaterials = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);

  const items = job.materials.map((m) => ({
    id: m.id,
    name: m.name,
    detail: m.detail,
    price: money(m.price),
    photoUrl: m.photoUrl,
  }));
  const total = round2(items.reduce((s, i) => s + i.price, 0));
  const last = job.materials[0]?.updatedAt ?? job.materials[0]?.createdAt ?? null;

  return {
    items,
    count: items.length,
    total,
    lastUpdatedAt: last,
  };
};

export const addMaterial = async (
  userId: string,
  jobId: string,
  body: { name: string; detail?: string; price: number; photoUrl?: string }
) => {
  const trader = await getTraderContext(userId);
  await assertMyJob(trader.id, jobId);

  await prisma.jobMaterial.create({
    data: {
      jobId,
      traderId: trader.id,
      name: body.name,
      detail: body.detail,
      price: body.price,
      photoUrl: body.photoUrl,
    },
  });

  return listMaterials(userId, jobId);
};

export const deleteMaterial = async (userId: string, jobId: string, materialId: string) => {
  const trader = await getTraderContext(userId);
  await assertMyJob(trader.id, jobId);

  const material = await prisma.jobMaterial.findFirst({
    where: { id: materialId, jobId, traderId: trader.id },
  });
  if (!material) {
    throw new NotFoundError('Material not found.');
  }

  await prisma.jobMaterial.delete({ where: { id: materialId } });
  return listMaterials(userId, jobId);
};

export const addProofPhoto = async (userId: string, jobId: string, photoUrl: string) => {
  const trader = await getTraderContext(userId);
  await assertMyJob(trader.id, jobId);

  const photo = await prisma.jobPhoto.create({
    data: {
      jobId,
      photoUrl,
      kind: JobPhotoKind.PROOF,
      uploadedById: userId,
    },
  });

  return { id: photo.id, photoUrl: photo.photoUrl, kind: photo.kind };
};

export const listMessages = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  await assertMyJob(trader.id, jobId);

  const messages = await prisma.chatMessage.findMany({
    where: { jobId },
    orderBy: { sentAt: 'asc' },
    include: {
      sender: { select: { id: true, fullName: true, role: true } },
    },
  });

  return {
    items: messages.map((m) => ({
      id: m.id,
      senderRole: m.sender.role,
      senderName: m.sender.fullName,
      message: m.message,
      sentAt: m.sentAt,
      isMine: m.senderId === trader.userId,
    })),
  };
};

export const sendMessage = async (userId: string, jobId: string, message: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);

  const created = await prisma.chatMessage.create({
    data: {
      jobId,
      bookingId: job.booking?.id ?? null,
      senderId: userId,
      message,
    },
    include: {
      sender: { select: { id: true, fullName: true, role: true } },
    },
  });

  return {
    id: created.id,
    senderRole: created.sender.role,
    senderName: created.sender.fullName,
    message: created.message,
    sentAt: created.sentAt,
    isMine: true,
  };
};

export const getPaymentSummary = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);
  const breakdown = computePaymentBreakdown(job);

  return {
    ...breakdown,
    jobRef: job.jobRef,
    completedDate: job.booking?.finishedAt ?? job.updatedAt,
    address: formatFullAddress(job),
  };
};

export const requestPayment = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);

  if (job.status === JobStatus.PAYMENT_PENDING) {
    throw new ConflictError('Payment already requested for this job.');
  }
  if (job.status !== JobStatus.COMPLETED && !job.booking?.finishedAt) {
    throw new BadRequestError('Finish the job before requesting payment.');
  }

  const breakdown = computePaymentBreakdown(job);

  const paymentRequest = await prisma.$transaction(async (tx) => {
    const pr = await tx.traderPaymentRequest.create({
      data: {
        jobId,
        traderId: trader.id,
        customerId: job.customerId,
        type: TraderPaymentRequestType.FULL_JOB,
        status: TraderPaymentRequestStatus.SENT,
        serviceCharge: breakdown.serviceCharge,
        materialsTotal: breakdown.materialsTotal,
        siteVisitFee: breakdown.siteVisitFee,
        platformFee: breakdown.platformFee,
        vatRate: breakdown.vatRate,
        vatAmount: breakdown.vatAmount,
        totalAmount: breakdown.totalAmount,
      },
    });
    await tx.job.update({
      where: { id: jobId },
      data: { status: JobStatus.PAYMENT_PENDING },
    });
    return pr;
  });

  return {
    paymentRequestId: paymentRequest.id,
    jobRef: job.jobRef,
    ...breakdown,
    status: 'SENT',
  };
};

export const completeSiteVisit = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);
  const visit = job.siteVisitRequests[0];

  if (!visit) {
    throw new BadRequestError('No site visit request found for this job.');
  }
  if (visit.status === TraderSiteVisitStatus.COMPLETED) {
    throw new ConflictError('Site visit already completed.');
  }
  if (visit.status === TraderSiteVisitStatus.CANCELLED) {
    throw new BadRequestError('Site visit was cancelled.');
  }

  const now = new Date();
  const start = visit.arrivedAt ?? visit.createdAt;
  const durationMinutes = Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000));

  const updated = await prisma.traderSiteVisitRequest.update({
    where: { id: visit.id },
    data: {
      status: TraderSiteVisitStatus.COMPLETED,
      completedAt: now,
      arrivedAt: visit.arrivedAt ?? now,
      durationMinutes,
    },
  });

  const fee = money(job.siteVisitFee);

  return {
    visitId: updated.id,
    status: updated.status,
    completedAt: updated.completedAt,
    durationMinutes: updated.durationMinutes,
    siteVisitFee: fee,
    canRequestSiteVisitPayment: true,
    primaryAction: 'REQUEST_SITE_VISIT_PAYMENT',
  };
};

export const requestSiteVisitPayment = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);
  const visit = job.siteVisitRequests[0];

  if (!visit || visit.status !== TraderSiteVisitStatus.COMPLETED) {
    throw new BadRequestError('Complete the site visit before requesting the fee.');
  }

  const existing = job.paymentRequests.find(
    (p) =>
      p.type === TraderPaymentRequestType.SITE_VISIT_FEE &&
      p.status !== TraderPaymentRequestStatus.CANCELLED
  );
  if (existing) {
    throw new ConflictError('Site visit payment already requested.');
  }

  const breakdown = computePaymentBreakdown(job, { siteVisitOnly: true });
  if (breakdown.siteVisitFee <= 0) {
    throw new BadRequestError('This job has no site visit fee.');
  }

  const paymentRequest = await prisma.traderPaymentRequest.create({
    data: {
      jobId,
      traderId: trader.id,
      customerId: job.customerId,
      type: TraderPaymentRequestType.SITE_VISIT_FEE,
      status: TraderPaymentRequestStatus.SENT,
      serviceCharge: 0,
      materialsTotal: 0,
      siteVisitFee: breakdown.siteVisitFee,
      platformFee: 0,
      vatRate: breakdown.vatRate,
      vatAmount: breakdown.vatAmount,
      totalAmount: breakdown.totalAmount,
    },
  });

  return {
    paymentRequestId: paymentRequest.id,
    type: TraderPaymentRequestType.SITE_VISIT_FEE,
    jobRef: job.jobRef,
    siteVisitFee: breakdown.siteVisitFee,
    vatAmount: breakdown.vatAmount,
    totalAmount: breakdown.totalAmount,
    status: 'SENT',
  };
};

/** Latest open marketplace job near trader (map sheet). Optional / soft. */
export const getIncomingLatest = async (userId: string) => {
  const trader = await getTraderContext(userId);
  const origin = resolveOrigin(trader);

  const job = await prisma.job.findFirst({
    where: {
      status: JobStatus.PUBLISHED,
      traderId: null,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      jobRef: true,
      title: true,
      description: true,
      city: true,
      postcode: true,
      latitude: true,
      longitude: true,
      siteVisitRequested: true,
      siteVisitFee: true,
      minBudget: true,
      maxBudget: true,
      serviceCharge: true,
      createdAt: true,
      customer: { select: { fullName: true, profilePhotoUrl: true } },
      address: { select: { city: true, county: true, latitude: true, longitude: true } },
    },
  });

  if (!job) {
    return null;
  }

  const coords = resolveJobCoords(
    {
      id: job.id,
      latitude: job.latitude ?? job.address?.latitude ?? null,
      longitude: job.longitude ?? job.address?.longitude ?? null,
    },
    origin
  );
  const distanceKm = Math.round(haversineKm(origin, coords) * 10) / 10;
  const fee = money(job.siteVisitFee);

  return {
    id: job.id,
    jobRef: job.jobRef,
    title: job.title,
    description: job.description,
    customerName: job.customer.fullName,
    customerPhotoUrl: job.customer.profilePhotoUrl,
    areaName: job.city || job.address?.city || job.postcode || 'Nearby',
    distanceKm,
    isSiteVisit: job.siteVisitRequested,
    price:
      job.siteVisitRequested && fee > 0
        ? fee
        : job.serviceCharge != null
          ? money(job.serviceCharge)
          : null,
    createdAt: job.createdAt,
    latitude: coords.lat,
    longitude: coords.lng,
    actions: {
      canAccept: true,
      canDecline: true,
    },
  };
};

export const acceptIncomingJob = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);

  const job = await prisma.job.findFirst({
    where: { id: jobId, status: JobStatus.PUBLISHED, traderId: null },
    select: {
      id: true,
      siteVisitRequested: true,
      quoteType: true,
      serviceCharge: true,
      minBudget: true,
    },
  });
  if (!job) {
    throw new NotFoundError('Incoming job not found or no longer available.');
  }

  const isSiteVisit = job.siteVisitRequested || job.quoteType === JobQuoteType.ONSITE;

  if (isSiteVisit) {
    await prisma.traderSiteVisitRequest.upsert({
      where: { jobId_traderId: { jobId, traderId: trader.id } },
      create: {
        jobId,
        traderId: trader.id,
        status: TraderSiteVisitStatus.CONFIRMED,
      },
      update: {
        status: TraderSiteVisitStatus.CONFIRMED,
      },
    });
    return {
      jobId,
      path: 'SITE_VISIT',
      nextStep: 'SELECT_DATE_TIME',
      redirectHint: `/traders/jobs/discover/${jobId}/site-visit/slots`,
    };
  }

  const stubAmount = money(job.serviceCharge) || money(job.minBudget) || 0;
  if (stubAmount > 0) {
    const existing = await prisma.quote.findFirst({
      where: { jobId, traderId: trader.id },
    });
    if (existing) {
      await prisma.quote.update({
        where: { id: existing.id },
        data: { status: QuoteStatus.PENDING, quotedAmount: stubAmount },
      });
    } else {
      await prisma.quote.create({
        data: {
          jobId,
          traderId: trader.id,
          quotedAmount: stubAmount,
          status: QuoteStatus.PENDING,
        },
      });
    }
  }

  return {
    jobId,
    path: 'QUOTE',
    nextStep: 'SUBMIT_QUOTE',
    redirectHint: `/traders/jobs/mine/${jobId}`,
  };
};

export const declineIncomingJob = async (userId: string, jobId: string) => {
  await getTraderContext(userId);
  // Soft ignore — no persistence required for MVP map sheet decline.
  return {
    jobId,
    declined: true,
  };
};
