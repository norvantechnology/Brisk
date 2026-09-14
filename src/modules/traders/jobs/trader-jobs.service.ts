import {
  JobQuoteType,
  JobStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../../config/database';
import { BadRequestError, NotFoundError } from '../../../utils/errors';

const EARTH_RADIUS_KM = 6371;
const DEFAULT_RADIUS_KM = 10;
const URGENT_WINDOW_MS = 48 * 60 * 60 * 1000;

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
  booking?: { status: string } | null;
}): string | null => {
  if (job.booking?.status === 'RESCHEDULED') return 'Reschedule';
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
): Origin | null => {
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
  return null;
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
  address: { select: { city: true, county: true } },
  booking: { select: { status: true } },
} satisfies Prisma.JobSelect;

type ListCardJob = Prisma.JobGetPayload<{ select: typeof listCardSelect }>;

const toListItem = (
  job: ListCardJob,
  origin: Origin | null,
  bookmarkedIds: Set<string>
) => {
  const distanceKm =
    origin && job.latitude != null && job.longitude != null
      ? Math.round(haversineKm(origin, { lat: job.latitude, lng: job.longitude }) * 10) / 10
      : null;

  return {
    id: job.id,
    title: job.title,
    badge: buildBadge(job),
    distanceKm,
    areaName: areaNameOf(job),
    priceLabel: buildPriceLabel(job),
    createdAt: job.createdAt,
    isBookmarked: bookmarkedIds.has(job.id),
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

  // Bounding-box prefilter when we have an origin (reduces rows before haversine).
  if (origin) {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((origin.lat * Math.PI) / 180) || 1);
    where.latitude = { gte: origin.lat - latDelta, lte: origin.lat + latDelta };
    where.longitude = { gte: origin.lng - lngDelta, lte: origin.lng + lngDelta };
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
    .filter((row) => {
      if (!origin) return true;
      if (row.distanceKm == null) return false;
      return row.distanceKm <= radiusKm;
    })
    .sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) {
        return b.job.createdAt.getTime() - a.job.createdAt.getTime();
      }
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
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

  const jobs = slice.map(({ job }) => toListItem(job, origin, bookmarkedIds));

  // App shows count from data.length — no total wrapper.
  return jobs;
};

export const getDiscoverJob = async (userId: string, jobId: string, query?: { lat?: string; lng?: string }) => {
  const trader = await getTraderContext(userId);
  const origin = resolveOrigin(trader, query?.lat, query?.lng);

  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      status: JobStatus.PUBLISHED,
      traderId: null,
    },
    select: {
      ...listCardSelect,
      description: true,
      timeSlot: true,
      durationLabel: true,
      scheduledDate: true,
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
      photos: {
        select: { photoUrl: true },
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

  const list = toListItem(job, origin, new Set(bookmark ? [jobId] : []));

  return {
    ...list,
    description: job.description,
    photos: job.photos.map((p) => p.photoUrl),
    scheduledDate: job.scheduledDate,
    timeSlot: job.timeSlot,
    durationLabel: job.durationLabel,
    categoryName: job.category.name,
    subcategoryName: job.subcategory?.name ?? null,
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
