import {
  JobQuoteType,
  JobStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../../config/database';
import { BadRequestError, NotFoundError } from '../../../utils/errors';

const EARTH_RADIUS_KM = 6371;
const DEFAULT_RADIUS_KM = 50;
const URGENT_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Dublin city centre — used when trader has no service center / job missing coords (testing + demo). */
const DUBLIN_ORIGIN: Origin = { lat: 53.3498, lng: -6.2603 };

type Origin = { lat: number; lng: number };

const money = (v: Prisma.Decimal | number | null | undefined): number | null => {
  if (v == null) return null;
  return Number(v);
};

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

const formatEuro = (amount: number): string =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);

const buildPriceLabel = (job: {
  siteVisitRequested: boolean;
  siteVisitFee: Prisma.Decimal | number | null;
  minBudget: Prisma.Decimal | number | null;
  maxBudget: Prisma.Decimal | number | null;
  serviceCharge: Prisma.Decimal | number | null;
  quoteType: JobQuoteType | null;
}): string | null => {
  const fee = money(job.siteVisitFee);
  if ((job.siteVisitRequested || job.quoteType === JobQuoteType.ONSITE) && fee != null && fee > 0) {
    return formatEuro(fee);
  }

  const min = money(job.minBudget);
  const max = money(job.maxBudget);
  if (min != null && max != null) {
    return min === max ? formatEuro(min) : `${formatEuro(min)} - ${formatEuro(max)}`;
  }
  if (min != null) return formatEuro(min);
  if (max != null) return formatEuro(max);

  const charge = money(job.serviceCharge);
  if (charge != null && charge > 0) return formatEuro(charge);

  return null;
};

const buildBadge = (job: {
  siteVisitRequested: boolean;
  quoteType: JobQuoteType | null;
  scheduledDate?: Date | null;
  booking?: { status: string } | null;
}): string | null => {
  if (job.booking?.status === 'RESCHEDULED') return 'Reschedule';
  // Past scheduled date on an open job → customer needs a new slot (Select Date & Time).
  if (job.scheduledDate && job.scheduledDate.getTime() < Date.now()) return 'Reschedule';
  if (job.siteVisitRequested || job.quoteType === JobQuoteType.ONSITE) return 'Site Visit';
  return null;
};

const areaNameOf = (job: {
  city: string | null;
  postcode: string | null;
  address?: { city: string | null; county: string | null } | null;
}): string => {
  return (
    job.city?.trim() ||
    job.address?.city?.trim() ||
    job.address?.county?.trim() ||
    job.postcode?.trim() ||
    'Nearby'
  );
};

/** Stable demo distance 0.8–8.5 km when job has no coordinates (keeps list usable for testing). */
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
): { lat: number; lng: number; synthetic: boolean } => {
  if (job.latitude != null && job.longitude != null) {
    return { lat: job.latitude, lng: job.longitude, synthetic: false };
  }
  // Place near origin with synthetic offset so distanceKm is never null for the app.
  const d = syntheticDistanceKm(job.id);
  const bearing = (job.id.charCodeAt(0) % 360) * (Math.PI / 180);
  const lat = origin.lat + (d / 111) * Math.cos(bearing);
  const lng = origin.lng + (d / (111 * Math.cos((origin.lat * Math.PI) / 180) || 1)) * Math.sin(bearing);
  return { lat, lng, synthetic: true };
};

const parsePage = (v?: string) => Math.max(1, Number.parseInt(v || '1', 10) || 1);
const parseLimit = (v?: string) => Math.min(50, Math.max(1, Number.parseInt(v || '20', 10) || 20));

const getTraderContext = async (userId: string) => {
  const trader = await prisma.trader.findUnique({
    where: { userId },
    select: {
      id: true,
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

const resolveOrigin = (
  trader: {
    serviceCenterLat: Prisma.Decimal | null;
    serviceCenterLng: Prisma.Decimal | null;
  },
  lat?: string,
  lng?: string
): Origin => {
  if (lat != null && lng != null && lat !== '' && lng !== '') {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      return { lat: parsedLat, lng: parsedLng };
    }
    throw new BadRequestError('lat and lng must be valid numbers.');
  }
  if (trader.serviceCenterLat != null && trader.serviceCenterLng != null) {
    return {
      lat: Number(trader.serviceCenterLat),
      lng: Number(trader.serviceCenterLng),
    };
  }
  return DUBLIN_ORIGIN;
};

const listCardSelect = {
  id: true,
  title: true,
  city: true,
  postcode: true,
  latitude: true,
  longitude: true,
  siteVisitRequested: true,
  siteVisitFee: true,
  minBudget: true,
  maxBudget: true,
  serviceCharge: true,
  quoteType: true,
  scheduledDate: true,
  createdAt: true,
  categoryId: true,
  address: { select: { city: true, county: true, latitude: true, longitude: true } },
  booking: { select: { status: true } },
} satisfies Prisma.JobSelect;

type ListCardJob = Prisma.JobGetPayload<{ select: typeof listCardSelect }>;

const toListItem = (
  job: ListCardJob,
  origin: Origin,
  bookmarkedIds: Set<string>
) => {
  const coords = resolveJobCoords(
    {
      id: job.id,
      latitude: job.latitude ?? job.address?.latitude ?? null,
      longitude: job.longitude ?? job.address?.longitude ?? null,
    },
    origin
  );
  const distanceKm = Math.round(haversineKm(origin, coords) * 10) / 10;
  const badge = buildBadge(job);
  const isSiteVisit = badge === 'Site Visit' || job.siteVisitRequested || job.quoteType === JobQuoteType.ONSITE;

  return {
    id: job.id,
    title: job.title,
    badge,
    distanceKm,
    areaName: areaNameOf(job),
    priceLabel: buildPriceLabel(job),
    createdAt: job.createdAt,
    isBookmarked: bookmarkedIds.has(job.id),
    isSiteVisit,
  };
};

/**
 * Discover / Nearby Opportunities — open marketplace jobs for traders.
 * Only PUBLISHED jobs with no assigned trader (waiting for quotes).
 */
export const listDiscoverJobs = async (
  userId: string,
  query: {
    page?: string;
    limit?: string;
    radiusKm?: string;
    lat?: string;
    lng?: string;
    categoryId?: string;
    siteVisit?: boolean;
    urgent?: boolean;
    search?: string;
  }
) => {
  const trader = await getTraderContext(userId);
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const origin = resolveOrigin(trader, query.lat, query.lng);

  const radiusKm = (() => {
    if (query.radiusKm != null && query.radiusKm !== '') {
      const n = Number(query.radiusKm);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestError('radiusKm must be a positive number.');
      }
      return n;
    }
    // Wide default so Discover always returns jobs for testing when radius not passed.
    return trader.serviceRadiusKm && trader.serviceRadiusKm > 0
      ? trader.serviceRadiusKm
      : DEFAULT_RADIUS_KM;
  })();

  const traderCategoryIds = [
    ...new Set(
      [
        ...trader.categories.map((c) => c.categoryId),
        trader.categoryId,
      ].filter((id): id is string => Boolean(id))
    ),
  ];

  const categoryFilter = query.categoryId
    ? query.categoryId
    : traderCategoryIds.length > 0
      ? { in: traderCategoryIds }
      : undefined;

  const where: Prisma.JobWhereInput = {
    status: JobStatus.PUBLISHED,
    traderId: null,
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
  };

  if (query.siteVisit) {
    where.OR = [
      { siteVisitRequested: true },
      { quoteType: JobQuoteType.ONSITE },
    ];
  }

  if (query.urgent) {
    const until = new Date(Date.now() + URGENT_WINDOW_MS);
    where.scheduledDate = { gte: new Date(), lte: until };
  }

  if (query.search?.trim()) {
    const q = query.search.trim();
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const candidates = await prisma.job.findMany({
    where,
    select: listCardSelect,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const withDistance = candidates
    .map((job) => {
      const item = toListItem(job, origin, new Set());
      return { job, item, distanceKm: item.distanceKm };
    })
    .filter((row) => row.distanceKm <= radiusKm)
    .sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return b.job.createdAt.getTime() - a.job.createdAt.getTime();
    });

  const slice = withDistance.slice((page - 1) * limit, page * limit);
  const jobIds = slice.map((r) => r.job.id);

  const bookmarks = jobIds.length
    ? await prisma.traderJobBookmark.findMany({
        where: { traderId: trader.id, jobId: { in: jobIds } },
        select: { jobId: true },
      })
    : [];
  const bookmarkedIds = new Set(bookmarks.map((b) => b.jobId));

  return slice.map(({ job }) => toListItem(job, origin, bookmarkedIds));
};

/**
 * Full Job Details payload for Discover → View Details (single call — no extra APIs).
 */
export const getDiscoverJob = async (userId: string, jobId: string, query?: { lat?: string; lng?: string }) => {
  const trader = await getTraderContext(userId);
  const origin = resolveOrigin(trader, query?.lat, query?.lng);

  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      status: JobStatus.PUBLISHED,
      traderId: null,
    },
    include: {
      address: { select: { city: true, county: true, latitude: true, longitude: true } },
      booking: { select: { status: true } },
      customer: {
        select: {
          id: true,
          fullName: true,
          profilePhotoUrl: true,
          mobileVerified: true,
          emailVerified: true,
        },
      },
      category: { select: { id: true, name: true, iconName: true } },
      subcategory: { select: { id: true, name: true } },
      photos: {
        select: { id: true, photoUrl: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!job) {
    throw new NotFoundError('Job not found or no longer available.');
  }

  const bookmark = await prisma.traderJobBookmark.findUnique({
    where: {
      traderId_jobId: { traderId: trader.id, jobId },
    },
    select: { id: true },
  });

  const listCard: ListCardJob = {
    id: job.id,
    title: job.title,
    city: job.city,
    postcode: job.postcode,
    latitude: job.latitude,
    longitude: job.longitude,
    siteVisitRequested: job.siteVisitRequested,
    siteVisitFee: job.siteVisitFee,
    minBudget: job.minBudget,
    maxBudget: job.maxBudget,
    serviceCharge: job.serviceCharge,
    quoteType: job.quoteType,
    scheduledDate: job.scheduledDate,
    createdAt: job.createdAt,
    categoryId: job.categoryId,
    address: job.address,
    booking: job.booking,
  };

  const list = toListItem(listCard, origin, new Set(bookmark ? [jobId] : []));
  const fee = money(job.siteVisitFee);
  const isSiteVisit = list.isSiteVisit;
  const isReschedule = list.badge === 'Reschedule';
  const coords = resolveJobCoords(
    {
      id: job.id,
      latitude: job.latitude ?? job.address?.latitude ?? null,
      longitude: job.longitude ?? job.address?.longitude ?? null,
    },
    origin
  );
  const customerVerified = Boolean(job.customer.mobileVerified || job.customer.emailVerified);
  const photos = job.photos.map((p) => p.photoUrl);

  return {
    ...list,
    description: job.description,
    photos,
    photoCount: photos.length,
    siteVisitFee: isSiteVisit ? fee : null,
    siteVisitFeeLabel: isSiteVisit && fee != null ? formatEuro(fee) : null,
    siteVisitFeeNote: isSiteVisit
      ? 'This fee is paid to the platform to secure the visit and ensure high intent for both parties.'
      : null,
    isReschedule,
    canSelectDateTime: isSiteVisit || isReschedule,
    canRequestSiteVisit: isSiteVisit,
    primaryActionLabel: isSiteVisit ? 'Request For Site Visit' : 'View Quote Options',
    customer: {
      id: job.customer.id,
      fullName: job.customer.fullName,
      profilePhotoUrl: job.customer.profilePhotoUrl,
      isVerified: customerVerified,
      verifiedLabel: customerVerified ? 'Verified Customer' : 'Customer',
    },
    category: {
      id: job.category.id,
      name: job.category.name,
      iconName: job.category.iconName,
    },
    subcategory: job.subcategory
      ? {
          id: job.subcategory.id,
          name: job.subcategory.name,
        }
      : null,
    categoryName: job.category.name,
    subcategoryName: job.subcategory?.name ?? null,
    scheduledDate: job.scheduledDate,
    timeSlot: job.timeSlot,
    durationLabel: job.durationLabel,
    location: {
      areaName: list.areaName,
      distanceKm: list.distanceKm,
      distanceLabel: `approx. ${list.distanceKm}km away`,
      latitude: coords.lat,
      longitude: coords.lng,
      mapPreviewUrl: `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.02}%2C${coords.lat - 0.015}%2C${coords.lng + 0.02}%2C${coords.lat + 0.015}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`,
    },
  };
};

export const bookmarkDiscoverJob = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);

  const job = await prisma.job.findFirst({
    where: { id: jobId, status: JobStatus.PUBLISHED, traderId: null },
    select: { id: true },
  });
  if (!job) {
    throw new NotFoundError('Job not found or no longer available.');
  }

  await prisma.traderJobBookmark.upsert({
    where: { traderId_jobId: { traderId: trader.id, jobId } },
    create: { traderId: trader.id, jobId },
    update: {},
  });

  return { id: jobId, isBookmarked: true };
};

export const unbookmarkDiscoverJob = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);

  await prisma.traderJobBookmark.deleteMany({
    where: { traderId: trader.id, jobId },
  });

  return { id: jobId, isBookmarked: false };
};
