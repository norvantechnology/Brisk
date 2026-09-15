import {
  JobQuoteType,
  JobStatus,
  Prisma,
  SiteVisitTimeSlot,
  TraderSiteVisitStatus,
} from '@prisma/client';
import { prisma } from '../../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../../utils/errors';

const EARTH_RADIUS_KM = 6371;
const DEFAULT_RADIUS_KM = 50;
const URGENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const SITE_VISIT_DATE_DAYS = 14;
/** Dublin city centre — used when trader has no service center / job missing coords (testing + demo). */
const DUBLIN_ORIGIN: Origin = { lat: 53.3498, lng: -6.2603 };

/** Figma Site Visit Date & Time bottom sheet — fixed windows. */
const SITE_VISIT_SLOT_DEFS: Record<
  SiteVisitTimeSlot,
  { label: string; startTime: string; endTime: string; icon: string }
> = {
  MORNING: { label: 'Morning', startTime: '08:00', endTime: '12:00', icon: 'sun' },
  AFTERNOON: { label: 'Afternoon', startTime: '12:00', endTime: '17:00', icon: 'sun_cloud' },
  EVENING: { label: 'Evening', startTime: '17:00', endTime: '21:00', icon: 'moon' },
  ANYTIME: { label: 'Any time', startTime: '08:00', endTime: '21:00', icon: 'clock' },
};

const SITE_VISIT_SLOT_ORDER: SiteVisitTimeSlot[] = [
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'ANYTIME',
];


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

const isSiteVisitJob = (job: {
  siteVisitRequested: boolean;
  quoteType: JobQuoteType | null;
}): boolean => job.siteVisitRequested || job.quoteType === JobQuoteType.ONSITE;

const buildBadge = (
  job: {
    siteVisitRequested: boolean;
    quoteType: JobQuoteType | null;
    scheduledDate?: Date | null;
    booking?: { status: string } | null;
  },
  traderVisitStatus?: TraderSiteVisitStatus | null
): string | null => {
  if (traderVisitStatus === TraderSiteVisitStatus.RESCHEDULE_REQUIRED) return 'Reschedule';
  if (!isSiteVisitJob(job)) return null;
  if (job.booking?.status === 'RESCHEDULED') return 'Reschedule';
  // Past customer-preferred date on a site-visit job → list shows Reschedule badge.
  if (job.scheduledDate && job.scheduledDate.getTime() < Date.now()) return 'Reschedule';
  return 'Site Visit';
};

const parseVisitDateOnly = (dateStr: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new BadRequestError('date must be YYYY-MM-DD.');
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new BadRequestError('Invalid date.');
  }
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (dt.getTime() < todayUtc) {
    throw new BadRequestError('Visit date cannot be in the past.');
  }
  return dt;
};

const formatVisitDateKey = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatVisitDisplayLabel = (visitDate: Date, timeSlot: SiteVisitTimeSlot): string => {
  const def = SITE_VISIT_SLOT_DEFS[timeSlot];
  const label = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(visitDate);
  return `${label} ${def.startTime} – ${def.endTime}`;
};

const buildAvailableDates = (days = SITE_VISIT_DATE_DAYS) => {
  const out: Array<{
    date: string;
    month: string;
    day: number;
    weekday: string;
  }> = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({
      date,
      month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      day: d.getDate(),
      weekday: d.toLocaleString('en-US', { weekday: 'short' }).toUpperCase(),
    });
  }
  return out;
};

type SiteVisitRow = {
  id: string;
  visitDate: Date;
  timeSlot: SiteVisitTimeSlot;
  status: TraderSiteVisitStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

const toSiteVisitPayload = (row: SiteVisitRow | null) => {
  if (!row || row.status === TraderSiteVisitStatus.CANCELLED) {
    return {
      status: 'NONE' as const,
      visitDate: null as string | null,
      timeSlot: null as SiteVisitTimeSlot | null,
      timeSlotLabel: null as string | null,
      startTime: null as string | null,
      endTime: null as string | null,
      displayLabel: null as string | null,
      statusBadge: null as string | null,
      sectionTitle: null as string | null,
      requestId: null as string | null,
    };
  }

  const def = SITE_VISIT_SLOT_DEFS[row.timeSlot];
  const isRescheduleRequired = row.status === TraderSiteVisitStatus.RESCHEDULE_REQUIRED;
  const wasRescheduled =
    Boolean(row.createdAt && row.updatedAt) &&
    row.updatedAt!.getTime() - row.createdAt!.getTime() > 1500;
  const sectionTitle = isRescheduleRequired || wasRescheduled
    ? 'RESCHEDULED VISIT DATE & TIME'
    : 'SCHEDULED VISIT DATE & TIME';

  return {
    status: row.status as 'CONFIRMED' | 'RESCHEDULE_REQUIRED',
    visitDate: formatVisitDateKey(row.visitDate),
    timeSlot: row.timeSlot,
    timeSlotLabel: def.label,
    startTime: def.startTime,
    endTime: def.endTime,
    displayLabel: formatVisitDisplayLabel(row.visitDate, row.timeSlot),
    statusBadge: isRescheduleRequired ? 'RESCHEDULE REQUIRED' : 'CONFIRMED',
    sectionTitle,
    requestId: row.id,
  };
};

const resolvePrimaryActions = (
  isSiteVisit: boolean,
  siteVisit: ReturnType<typeof toSiteVisitPayload>
) => {
  if (siteVisit.status === 'CONFIRMED') {
    return {
      canSelectDateTime: false,
      canRequestSiteVisit: false,
      canRequestReschedule: false,
      selectDateTimeLabel: null as string | null,
      primaryAction: 'BACK_TO_JOB' as const,
      primaryActionLabel: 'Back to Job',
    };
  }
  if (siteVisit.status === 'RESCHEDULE_REQUIRED') {
    return {
      canSelectDateTime: true,
      canRequestSiteVisit: false,
      canRequestReschedule: true,
      selectDateTimeLabel: 'Select Date & Time',
      primaryAction: 'REQUEST_RESCHEDULE' as const,
      primaryActionLabel: 'Request For Reschedule Site Visit',
    };
  }
  if (isSiteVisit) {
    return {
      canSelectDateTime: true,
      canRequestSiteVisit: true,
      canRequestReschedule: false,
      selectDateTimeLabel: 'Select Date & Time',
      primaryAction: 'REQUEST_SITE_VISIT' as const,
      primaryActionLabel: 'Request For Site Visit',
    };
  }
  return {
    canSelectDateTime: false,
    canRequestSiteVisit: false,
    canRequestReschedule: false,
    selectDateTimeLabel: null as string | null,
    primaryAction: 'VIEW_QUOTE' as const,
    primaryActionLabel: 'View Quote Options',
  };
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
  bookmarkedIds: Set<string>,
  traderVisitStatus?: TraderSiteVisitStatus | null
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
  const badge = buildBadge(job, traderVisitStatus);
  const isSiteVisit = badge === 'Site Visit' || isSiteVisitJob(job);

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

  const [bookmarks, visits] = await Promise.all([
    jobIds.length
      ? prisma.traderJobBookmark.findMany({
          where: { traderId: trader.id, jobId: { in: jobIds } },
          select: { jobId: true },
        })
      : Promise.resolve([] as { jobId: string }[]),
    jobIds.length
      ? prisma.traderSiteVisitRequest.findMany({
          where: {
            traderId: trader.id,
            jobId: { in: jobIds },
            status: { not: TraderSiteVisitStatus.CANCELLED },
          },
          select: { jobId: true, status: true },
        })
      : Promise.resolve([] as { jobId: string; status: TraderSiteVisitStatus }[]),
  ]);
  const bookmarkedIds = new Set(bookmarks.map((b) => b.jobId));
  const visitByJob = new Map(visits.map((v) => [v.jobId, v.status]));

  return slice.map(({ job }) =>
    toListItem(job, origin, bookmarkedIds, visitByJob.get(job.id) ?? null)
  );
};

/**
 * Full Job Details payload for Discover → View Details (single call — no extra APIs).
 * Also serves Confirmed / Reschedule Required screens after a trader site-visit request.
 */
export const getDiscoverJob = async (userId: string, jobId: string, query?: { lat?: string; lng?: string }) => {
  const trader = await getTraderContext(userId);
  const origin = resolveOrigin(trader, query?.lat, query?.lng);

  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      OR: [
        { status: JobStatus.PUBLISHED, traderId: null },
        {
          siteVisitRequests: {
            some: {
              traderId: trader.id,
              status: { not: TraderSiteVisitStatus.CANCELLED },
            },
          },
        },
        { traderId: trader.id },
      ],
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

  const [bookmark, visitRow] = await Promise.all([
    prisma.traderJobBookmark.findUnique({
      where: { traderId_jobId: { traderId: trader.id, jobId } },
      select: { id: true },
    }),
    prisma.traderSiteVisitRequest.findUnique({
      where: { jobId_traderId: { jobId, traderId: trader.id } },
      select: {
        id: true,
        visitDate: true,
        timeSlot: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const activeVisit =
    visitRow && visitRow.status !== TraderSiteVisitStatus.CANCELLED ? visitRow : null;

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

  const list = toListItem(
    listCard,
    origin,
    new Set(bookmark ? [jobId] : []),
    activeVisit?.status ?? null
  );
  const fee = money(job.siteVisitFee);
  const isSiteVisit = list.isSiteVisit || isSiteVisitJob(job);
  const siteVisit = toSiteVisitPayload(activeVisit);
  const actions = resolvePrimaryActions(isSiteVisit, siteVisit);
  const isReschedule =
    list.badge === 'Reschedule' || siteVisit.status === 'RESCHEDULE_REQUIRED';
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

  const tags = [
    job.category
      ? { label: job.category.name, icon: job.category.iconName ?? 'category' }
      : null,
    job.subcategory ? { label: job.subcategory.name, icon: 'tag' } : null,
  ].filter(Boolean);

  return {
    ...list,
    description: job.description,
    photos,
    photoCount: photos.length,
    photosSectionTitle: `Customer Photos (${photos.length})`,
    photosHint: photos.length > 1 ? 'Swipe for more' : null,
    siteVisitFeeTitle: isSiteVisit ? 'SITE VISIT FEE' : null,
    siteVisitFee: isSiteVisit ? fee : null,
    siteVisitFeeLabel: isSiteVisit && fee != null ? formatEuro(fee) : null,
    siteVisitFeeNote: isSiteVisit
      ? 'This fee is paid to the platform to secure the visit and ensure high intent for both parties.'
      : null,
    isReschedule,
    ...actions,
    siteVisit,
    serviceTermsNote: 'By accepting, you agree to the Service Terms.',
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
    tags,
    scheduledDate: job.scheduledDate,
    timeSlot: job.timeSlot,
    durationLabel: job.durationLabel,
    location: {
      areaName: list.areaName,
      distanceKm: list.distanceKm,
      distanceLabel: `Approx. ${list.distanceKm} km away`,
      latitude: coords.lat,
      longitude: coords.lng,
      mapPreviewUrl: `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.02}%2C${coords.lat - 0.015}%2C${coords.lng + 0.02}%2C${coords.lat + 0.015}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`,
    },
  };
};

const assertJobAccessibleForSiteVisit = async (traderId: string, jobId: string) => {
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      OR: [
        { status: JobStatus.PUBLISHED, traderId: null },
        {
          siteVisitRequests: {
            some: {
              traderId,
              status: { not: TraderSiteVisitStatus.CANCELLED },
            },
          },
        },
        { traderId },
      ],
    },
    select: {
      id: true,
      siteVisitRequested: true,
      quoteType: true,
      title: true,
    },
  });
  if (!job) {
    throw new NotFoundError('Job not found or no longer available.');
  }
  const existingVisit = await prisma.traderSiteVisitRequest.findFirst({
    where: {
      jobId,
      traderId,
      status: { not: TraderSiteVisitStatus.CANCELLED },
    },
    select: { id: true },
  });
  if (!isSiteVisitJob(job) && !existingVisit) {
    throw new BadRequestError('This job does not require a site visit.');
  }
  return job;
};

/** Bottom sheet: Site Visit Date & Time — available dates + Morning/Afternoon/Evening/Any time. */
export const getSiteVisitSlots = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  await assertJobAccessibleForSiteVisit(trader.id, jobId);

  const visit = await prisma.traderSiteVisitRequest.findUnique({
    where: { jobId_traderId: { jobId, traderId: trader.id } },
    select: {
      id: true,
      visitDate: true,
      timeSlot: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const active = visit && visit.status !== TraderSiteVisitStatus.CANCELLED ? visit : null;

  return {
    jobId,
    title: 'Site Visit Date & Time',
    dates: buildAvailableDates(),
    timeSlots: SITE_VISIT_SLOT_ORDER.map((id) => ({
      id,
      label: SITE_VISIT_SLOT_DEFS[id].label,
      startTime: SITE_VISIT_SLOT_DEFS[id].startTime,
      endTime: SITE_VISIT_SLOT_DEFS[id].endTime,
      rangeLabel: `${SITE_VISIT_SLOT_DEFS[id].startTime} - ${SITE_VISIT_SLOT_DEFS[id].endTime}`,
      icon: SITE_VISIT_SLOT_DEFS[id].icon,
    })),
    selected: active
      ? {
          date: formatVisitDateKey(active.visitDate),
          timeSlot: active.timeSlot,
        }
      : null,
    mode: active?.status === TraderSiteVisitStatus.RESCHEDULE_REQUIRED ? 'RESCHEDULE' : 'REQUEST',
    submitLabel:
      active?.status === TraderSiteVisitStatus.RESCHEDULE_REQUIRED
        ? 'Request For Reschedule Site Visit'
        : 'Request For Site Visit',
  };
};

const upsertSiteVisit = async (
  traderId: string,
  jobId: string,
  body: { date: string; timeSlot: SiteVisitTimeSlot },
  mode: 'request' | 'reschedule'
) => {
  const visitDate = parseVisitDateOnly(body.date);
  const existing = await prisma.traderSiteVisitRequest.findUnique({
    where: { jobId_traderId: { jobId, traderId } },
  });

  if (mode === 'request') {
    if (existing && existing.status === TraderSiteVisitStatus.CONFIRMED) {
      throw new ConflictError('Site visit already confirmed. Use reschedule if a new slot is needed.');
    }
  } else {
    if (!existing || existing.status === TraderSiteVisitStatus.CANCELLED) {
      throw new BadRequestError('No site visit to reschedule. Request a site visit first.');
    }
  }

  const row = await prisma.traderSiteVisitRequest.upsert({
    where: { jobId_traderId: { jobId, traderId } },
    create: {
      jobId,
      traderId,
      visitDate,
      timeSlot: body.timeSlot,
      status: TraderSiteVisitStatus.CONFIRMED,
    },
    update: {
      visitDate,
      timeSlot: body.timeSlot,
      status: TraderSiteVisitStatus.CONFIRMED,
    },
  });

  return toSiteVisitPayload(row);
};

/** CTA: Request For Site Visit (after Select Date & Time). MVP auto-confirms. */
export const requestSiteVisit = async (
  userId: string,
  jobId: string,
  body: { date: string; timeSlot: SiteVisitTimeSlot }
) => {
  const trader = await getTraderContext(userId);
  await assertJobAccessibleForSiteVisit(trader.id, jobId);
  const siteVisit = await upsertSiteVisit(trader.id, jobId, body, 'request');
  const detail = await getDiscoverJob(userId, jobId);
  return { ...detail, siteVisit };
};

/** CTA: Request For Reschedule Site Visit. */
export const rescheduleSiteVisit = async (
  userId: string,
  jobId: string,
  body: { date: string; timeSlot: SiteVisitTimeSlot }
) => {
  const trader = await getTraderContext(userId);
  await assertJobAccessibleForSiteVisit(trader.id, jobId);
  const siteVisit = await upsertSiteVisit(trader.id, jobId, body, 'reschedule');
  const detail = await getDiscoverJob(userId, jobId);
  return { ...detail, siteVisit };
};

export const bookmarkDiscoverJob = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);

  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      OR: [
        { status: JobStatus.PUBLISHED, traderId: null },
        {
          siteVisitRequests: {
            some: { traderId: trader.id, status: { not: TraderSiteVisitStatus.CANCELLED } },
          },
        },
      ],
    },
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
