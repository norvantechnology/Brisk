import {
  JobQuoteType,
  JobStatus,
  Prisma,
  QuoteStatus,
  SiteVisitTimeSlot,
  TraderSiteVisitStatus,
} from '@prisma/client';
import { prisma } from '../../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../../utils/errors';
import { resolveCategoryIconUrl } from '../../categories/categories.serializers';
import { requestJob } from './trader-my-jobs.service';
import { resolveDiscoverCurrency } from '../../../services/currency.service';

const EARTH_RADIUS_KM = 6371;
const DEFAULT_RADIUS_KM = 50;
const URGENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const SITE_VISIT_DATE_DAYS = 14;
/** Dublin city centre — used when trader has no service center / job missing coords (testing + demo). */
const DUBLIN_ORIGIN: Origin = { lat: 53.3498, lng: -6.2603 };

/** Figma Site Visit Date & Time bottom sheet — fixed windows. */
const SITE_VISIT_SLOT_DEFS: Record<
  SiteVisitTimeSlot,
  { startTime: string; endTime: string; icon: string }
> = {
  MORNING: { startTime: '08:00', endTime: '12:00', icon: 'sun' },
  AFTERNOON: { startTime: '12:00', endTime: '17:00', icon: 'sun_cloud' },
  EVENING: { startTime: '17:00', endTime: '21:00', icon: 'moon' },
  ANYTIME: { startTime: '08:00', endTime: '21:00', icon: 'clock' },
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

const isSiteVisitJob = (job: {
  siteVisitRequested: boolean;
  quoteType: JobQuoteType | null;
}): boolean => job.siteVisitRequested || job.quoteType === JobQuoteType.ONSITE;

/** True when trader must pick a new visit slot (past preferred date, booking rescheduled, or visit status). */
const jobNeedsReschedule = (
  job: {
    siteVisitRequested: boolean;
    quoteType: JobQuoteType | null;
    scheduledDate?: Date | null;
    booking?: { status: string } | null;
  },
  traderVisitStatus?: TraderSiteVisitStatus | null
): boolean => {
  // Already proposed / locked — not in "needs reschedule" CTA state anymore
  if (
    traderVisitStatus === TraderSiteVisitStatus.PENDING ||
    traderVisitStatus === TraderSiteVisitStatus.CONFIRMED ||
    traderVisitStatus === TraderSiteVisitStatus.COMPLETED
  ) {
    return false;
  }
  if (traderVisitStatus === TraderSiteVisitStatus.RESCHEDULE_REQUIRED) return true;
  if (!isSiteVisitJob(job)) return false;
  if (job.booking?.status === 'RESCHEDULED') return true;
  if (job.scheduledDate && job.scheduledDate.getTime() < Date.now()) return true;
  return false;
};

const buildBadge = (
  job: {
    siteVisitRequested: boolean;
    quoteType: JobQuoteType | null;
    scheduledDate?: Date | null;
    booking?: { status: string } | null;
  },
  traderVisitStatus?: TraderSiteVisitStatus | null
): string | null => {
  // Discover list badge: Reschedule | Site Visit | null only (never "Waiting").
  // Waiting-for-customer is signaled via isWaitingForCustomerConfirmation / primaryAction.
  if (jobNeedsReschedule(job, traderVisitStatus)) return 'Reschedule';
  if (!isSiteVisitJob(job)) return null;
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

type SiteVisitSlotRow = {
  id: string;
  visitDate: Date;
  timeSlot: SiteVisitTimeSlot;
  startTime: string;
  endTime: string;
  sortOrder: number;
  isSelected: boolean;
};

type SiteVisitRow = {
  id: string;
  visitDate: Date | null;
  timeSlot: SiteVisitTimeSlot | null;
  status: TraderSiteVisitStatus;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  slots?: SiteVisitSlotRow[];
};

const normalizeSlotsInput = (body: {
  date?: string;
  timeSlot?: SiteVisitTimeSlot;
  slots?: Array<{ date: string; timeSlot: SiteVisitTimeSlot }>;
}): Array<{ date: string; timeSlot: SiteVisitTimeSlot }> => {
  if (body.slots && body.slots.length > 0) return body.slots;
  if (body.date && body.timeSlot) return [{ date: body.date, timeSlot: body.timeSlot }];
  throw new BadRequestError('Provide slots: [{ date, timeSlot }] or date + timeSlot.');
};

/** UI badge on scheduled-visit card (Figma). */
const visitStatusBadgeFor = (
  status: string
): 'WAITING' | 'CONFIRMED' | 'RESCHEDULE_REQUESTED' | 'COMPLETED' | null => {
  switch (status) {
    case 'PENDING':
      return 'WAITING';
    case 'CONFIRMED':
      return 'CONFIRMED';
    case 'RESCHEDULE_REQUIRED':
      return 'RESCHEDULE_REQUESTED';
    case 'COMPLETED':
      return 'COMPLETED';
    default:
      return null;
  }
};

const toSiteVisitPayload = (row: SiteVisitRow | null) => {
  if (!row || row.status === TraderSiteVisitStatus.CANCELLED) {
    return {
      status: 'NONE' as const,
      visitDate: null as string | null,
      timeSlot: null as SiteVisitTimeSlot | null,
      startTime: null as string | null,
      endTime: null as string | null,
      requestId: null as string | null,
      slots: [] as Array<{
        id: string;
        date: string;
        timeSlot: SiteVisitTimeSlot;
        startTime: string;
        endTime: string;
        isSelected: boolean;
      }>,
      slotCount: 0,
      isSiteVisitDone: false,
      completedAt: null as Date | null,
    };
  }

  const slotRows =
    row.slots && row.slots.length > 0
      ? [...row.slots].sort((a, b) => a.sortOrder - b.sortOrder)
      : row.visitDate && row.timeSlot
        ? [
            {
              id: row.id,
              visitDate: row.visitDate,
              timeSlot: row.timeSlot,
              startTime: SITE_VISIT_SLOT_DEFS[row.timeSlot].startTime,
              endTime: SITE_VISIT_SLOT_DEFS[row.timeSlot].endTime,
              sortOrder: 0,
              isSelected: true,
            },
          ]
        : [];

  const slots = slotRows.map((s) => ({
    id: s.id,
    date: formatVisitDateKey(s.visitDate),
    timeSlot: s.timeSlot,
    startTime: s.startTime,
    endTime: s.endTime,
    isSelected: s.isSelected,
  }));

  const primary =
    slotRows.find((s) => s.isSelected) ||
    (row.visitDate && row.timeSlot
      ? {
          visitDate: row.visitDate,
          timeSlot: row.timeSlot,
          startTime: SITE_VISIT_SLOT_DEFS[row.timeSlot].startTime,
          endTime: SITE_VISIT_SLOT_DEFS[row.timeSlot].endTime,
        }
      : slotRows[0]) ||
    null;

  const isSiteVisitDone = row.status === TraderSiteVisitStatus.COMPLETED;

  if (!primary) {
    return {
      status: row.status as 'PENDING' | 'CONFIRMED' | 'RESCHEDULE_REQUIRED' | 'COMPLETED',
      visitDate: null as string | null,
      timeSlot: null as SiteVisitTimeSlot | null,
      startTime: null as string | null,
      endTime: null as string | null,
      requestId: row.id,
      slots: [],
      slotCount: 0,
      isSiteVisitDone,
      completedAt: row.completedAt ?? null,
    };
  }

  const def = SITE_VISIT_SLOT_DEFS[primary.timeSlot];

  return {
    status: row.status as 'PENDING' | 'CONFIRMED' | 'RESCHEDULE_REQUIRED' | 'COMPLETED',
    visitDate: formatVisitDateKey(primary.visitDate),
    timeSlot: primary.timeSlot,
    startTime: primary.startTime || def.startTime,
    endTime: primary.endTime || def.endTime,
    requestId: row.id,
    slots,
    slotCount: slots.length,
    isSiteVisitDone,
    completedAt: row.completedAt ?? null,
  };
};

type DiscoverQuoteState = {
  hasSubmittedQuote: boolean;
  canUpdateQuote: boolean;
  canSubmitQuote: boolean;
  canRequestJob: boolean;
  isJobRequested: boolean;
  isWaitingForCustomerConfirmation: boolean;
  /** NONE | QUOTED | WAITING_FOR_CUSTOMER | ASSIGNED — never treat WAITING as My Jobs ACTIVE */
  assignmentStatus: 'NONE' | 'QUOTED' | 'WAITING_FOR_CUSTOMER' | 'ASSIGNED';
  quoteId: string | null;
  quoteAmount: number | null;
  quoteNotes: string | null;
  quoteStatus: string | null;
};

const emptyQuoteState = (): DiscoverQuoteState => ({
  hasSubmittedQuote: false,
  canUpdateQuote: false,
  canSubmitQuote: true,
  canRequestJob: false,
  isJobRequested: false,
  isWaitingForCustomerConfirmation: false,
  assignmentStatus: 'NONE',
  quoteId: null,
  quoteAmount: null,
  quoteNotes: null,
  quoteStatus: null,
});

type QuoteFlagRow = {
  id: string;
  quotedAmount: Prisma.Decimal | number;
  notes: string | null;
  status: string;
  requestedAt: Date | null;
};

/**
 * Single source of truth for Discover quote / request / waiting flags.
 *
 * Flow:
 *  1) Submit quote → QUOTED (hasSubmittedQuote=true, waiting=false) — still Discover, not Active
 *  2) Request Job → WAITING_FOR_CUSTOMER (isJobRequested + isWaitingForCustomerConfirmation)
 *     Job stays PUBLISHED + unassigned — NOT My Jobs ACTIVE
 *  3) Customer confirms → ASSIGNED (traderId set, status ACCEPTED/SCHEDULED) → My Jobs ACTIVE
 */
const resolveDiscoverQuoteFlags = (params: {
  quote: QuoteFlagRow | null | undefined;
  jobStatus: JobStatus;
  jobTraderId: string | null;
  traderId: string;
  isSiteVisit?: boolean;
  hasActiveVisit?: boolean;
}): DiscoverQuoteState => {
  const isAssignedToThis = params.jobTraderId === params.traderId;
  const isOpenMarketplace =
    params.jobStatus === JobStatus.PUBLISHED && params.jobTraderId == null;
  const quote = params.quote ?? null;
  const hasSubmittedQuote = Boolean(quote);
  const isJobRequested = Boolean(quote?.requestedAt);

  // Waiting = trader requested AND customer has not confirmed (still open marketplace).
  // This is NOT the Active / assigned job state.
  const isWaitingForCustomerConfirmation =
    isJobRequested && !isAssignedToThis && isOpenMarketplace;

  if (isAssignedToThis && params.jobTraderId) {
    return {
      hasSubmittedQuote,
      canUpdateQuote: false,
      canSubmitQuote: false,
      canRequestJob: false,
      isJobRequested,
      isWaitingForCustomerConfirmation: false,
      assignmentStatus: 'ASSIGNED',
      quoteId: quote?.id ?? null,
      quoteAmount: quote ? money(quote.quotedAmount) : null,
      quoteNotes: quote?.notes ?? null,
      quoteStatus: quote?.status ?? null,
    };
  }

  if (!hasSubmittedQuote || !quote) {
    return {
      ...emptyQuoteState(),
      canSubmitQuote: !(params.isSiteVisit ?? false) || Boolean(params.hasActiveVisit),
      canRequestJob: false,
      assignmentStatus: 'NONE',
    };
  }

  const pending = quote.status === QuoteStatus.PENDING || quote.status === 'PENDING';

  return {
    hasSubmittedQuote: true,
    canUpdateQuote: pending && isOpenMarketplace,
    canSubmitQuote: false,
    canRequestJob: !isJobRequested && isOpenMarketplace && pending,
    isJobRequested,
    isWaitingForCustomerConfirmation,
    assignmentStatus: isWaitingForCustomerConfirmation
      ? 'WAITING_FOR_CUSTOMER'
      : 'QUOTED',
    quoteId: quote.id,
    quoteAmount: money(quote.quotedAmount),
    quoteNotes: quote.notes,
    quoteStatus: quote.status,
  };
};

const resolvePrimaryActions = (
  isSiteVisit: boolean,
  siteVisit: ReturnType<typeof toSiteVisitPayload>,
  quote: DiscoverQuoteState,
  needsReschedule = false
) => {
  if (quote.isWaitingForCustomerConfirmation) {
    return {
      canSelectDateTime: false,
      canRequestSiteVisit: false,
      canRequestReschedule: false,
      canSubmitQuote: false,
      canUpdateQuote: quote.canUpdateQuote,
      canRequestJob: false,
      primaryAction: 'WAITING_FOR_CUSTOMER' as const,
    };
  }

  if (siteVisit.status === 'CONFIRMED' || siteVisit.status === 'COMPLETED') {
    return {
      canSelectDateTime: false,
      canRequestSiteVisit: false,
      canRequestReschedule: false,
      canSubmitQuote: false,
      canUpdateQuote: quote.canUpdateQuote,
      canRequestJob: quote.canRequestJob,
      primaryAction: quote.canRequestJob
        ? ('REQUEST_JOB' as const)
        : ('BACK_TO_JOB' as const),
    };
  }

  // Proposed slots submitted — waiting for customer to confirm (not another reschedule CTA)
  if (siteVisit.status === 'PENDING') {
    return {
      canSelectDateTime: false,
      canRequestSiteVisit: false,
      canRequestReschedule: false,
      canSubmitQuote: false,
      canUpdateQuote: quote.canUpdateQuote,
      canRequestJob: quote.canRequestJob,
      primaryAction: 'WAITING_FOR_CONFIRMATION' as const,
    };
  }

  // Past preferred date / RESCHEDULE_REQUIRED visit — same UI as Figma reschedule card
  if (siteVisit.status === 'RESCHEDULE_REQUIRED' || needsReschedule) {
    return {
      canSelectDateTime: true,
      canRequestSiteVisit: false,
      canRequestReschedule: true,
      canSubmitQuote: false,
      canUpdateQuote: false,
      canRequestJob: false,
      primaryAction: 'REQUEST_RESCHEDULE' as const,
    };
  }

  if (isSiteVisit && siteVisit.status === 'NONE') {
    return {
      canSelectDateTime: true,
      canRequestSiteVisit: true,
      canRequestReschedule: false,
      canSubmitQuote: false,
      canUpdateQuote: quote.canUpdateQuote,
      canRequestJob: quote.canRequestJob,
      primaryAction: 'REQUEST_SITE_VISIT' as const,
    };
  }

  if (quote.hasSubmittedQuote) {
    return {
      canSelectDateTime: false,
      canRequestSiteVisit: false,
      canRequestReschedule: false,
      canSubmitQuote: false,
      canUpdateQuote: quote.canUpdateQuote,
      canRequestJob: quote.canRequestJob,
      primaryAction: quote.canRequestJob
        ? ('REQUEST_JOB' as const)
        : ('UPDATE_QUOTE' as const),
    };
  }

  return {
    canSelectDateTime: false,
    canRequestSiteVisit: false,
    canRequestReschedule: false,
    canSubmitQuote: quote.canSubmitQuote,
    canUpdateQuote: false,
    canRequestJob: false,
    primaryAction: 'SUBMIT_QUOTE' as const,
  };
};

/** Suggested bottom-button label — FE can use as-is or map i18n from primaryAction. */
const primaryActionLabelFor = (primaryAction: string, acceptJobAmount?: number | null): string => {
  switch (primaryAction) {
    case 'REQUEST_SITE_VISIT':
      return 'Request For Site Visit';
    case 'REQUEST_RESCHEDULE':
      return 'Request For Reschedule Site Visit';
    case 'WAITING_FOR_CONFIRMATION':
      return 'Waiting for Confirmation';
    case 'WAITING_FOR_CUSTOMER':
      return 'Waiting for Customer';
    case 'BACK_TO_JOB':
      return 'Back to Job';
    case 'SUBMIT_QUOTE':
      return 'Submit Quote';
    case 'UPDATE_QUOTE':
      return 'Update Quote';
    case 'REQUEST_JOB':
      return acceptJobAmount != null && acceptJobAmount > 0
        ? `Accept Job for €${acceptJobAmount.toFixed(2)}`
        : 'Request Job';
    default:
      return 'View Details';
  }
};

/**
 * Single Job Details price amount for mobile top card.
 * Labels ("Site Visited" / "ESTIMATED BUDGET") are client-side from flags.
 * Prefer submitted quotation; else estimated budget for normal (non site-visit) jobs.
 * Never returns siteVisitFee.
 */
const resolveJobPriceQuotation = (input: {
  isSiteVisit: boolean;
  quoteAmount: number | null;
  minBudget: number | null;
  maxBudget: number | null;
  serviceCharge: number | null;
}): number | null => {
  if (input.quoteAmount != null && input.quoteAmount > 0) {
    return input.quoteAmount;
  }
  if (input.isSiteVisit) {
    return null;
  }
  return (
    (input.maxBudget != null && input.maxBudget > 0 ? input.maxBudget : null) ??
    (input.serviceCharge != null && input.serviceCharge > 0 ? input.serviceCharge : null) ??
    (input.minBudget != null && input.minBudget > 0 ? input.minBudget : null)
  );
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

const formatDiscoverFullAddress = (job: {
  addressLine: string | null;
  city: string | null;
  postcode: string | null;
  address?: {
    houseNumber?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    county?: string | null;
    eircode?: string | null;
    country?: string | null;
  } | null;
}): string => {
  if (job.address) {
    const a = job.address;
    const line = [
      [a.houseNumber, a.addressLine1].filter(Boolean).join(' ').trim(),
      a.addressLine2,
      a.city,
      a.county,
      a.eircode,
      a.country,
    ]
      .filter((p) => p && String(p).trim())
      .join(', ');
    if (line) return line;
  }
  return [job.addressLine, job.city, job.postcode].filter(Boolean).join(', ') || 'Address TBD';
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
      country: true,
      categories: { select: { categoryId: true } },
      user: { select: { preferredCurrency: true, country: true } },
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
  status: true,
  traderId: true,
  address: {
    select: { city: true, county: true, country: true, latitude: true, longitude: true },
  },
  customer: { select: { preferredCurrency: true, country: true } },
  booking: { select: { status: true } },
} satisfies Prisma.JobSelect;

type ListCardJob = Prisma.JobGetPayload<{ select: typeof listCardSelect }>;

const toListItem = (
  job: ListCardJob,
  origin: Origin,
  bookmarkedIds: Set<string>,
  traderVisitStatus?: TraderSiteVisitStatus | null,
  quoteFlags?: Partial<DiscoverQuoteState>,
  currency?: { currencyCode: string; currencySymbol: string }
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
  const hasSubmittedQuote = Boolean(quoteFlags?.hasSubmittedQuote);
  const isJobRequested = Boolean(quoteFlags?.isJobRequested);
  const isWaitingForCustomerConfirmation = Boolean(
    quoteFlags?.isWaitingForCustomerConfirmation
  );
  const assignmentStatus =
    quoteFlags?.assignmentStatus ??
    (isWaitingForCustomerConfirmation
      ? 'WAITING_FOR_CUSTOMER'
      : hasSubmittedQuote
        ? 'QUOTED'
        : 'NONE');

  return {
    id: job.id,
    title: job.title,
    badge,
    distanceKm,
    areaName: areaNameOf(job),
    siteVisitFee: money(job.siteVisitFee),
    minBudget: money(job.minBudget),
    maxBudget: money(job.maxBudget),
    serviceCharge: money(job.serviceCharge),
    currencyCode: currency?.currencyCode ?? 'EUR',
    currencySymbol: currency?.currencySymbol ?? '€',
    createdAt: job.createdAt,
    isBookmarked: bookmarkedIds.has(job.id),
    isSiteVisit,
    /** Actual DB job status — Discover open jobs are PUBLISHED until customer confirms. */
    jobStatus: job.status,
    /**
     * NONE → no quote yet
     * QUOTED → quote submitted, not requested (still Discover, not Active)
     * WAITING_FOR_CUSTOMER → Request Job done, pending customer confirm (NOT My Jobs ACTIVE)
     * ASSIGNED → customer confirmed (normally leaves Discover → My Jobs ACTIVE)
     */
    assignmentStatus,
    hasSubmittedQuote,
    canUpdateQuote: Boolean(quoteFlags?.canUpdateQuote),
    canSubmitQuote: quoteFlags?.canSubmitQuote ?? !hasSubmittedQuote,
    isJobRequested,
    isWaitingForCustomerConfirmation,
    quoteAmount: quoteFlags?.quoteAmount ?? null,
  };
};

const currencyForDiscoverJob = async (
  job: ListCardJob,
  trader: {
    country: string | null;
    user: { preferredCurrency: string; country: string | null };
  }
): Promise<{ currencyCode: string; currencySymbol: string }> =>
  resolveDiscoverCurrency({
    customerPreferredCurrency: job.customer?.preferredCurrency,
    traderPreferredCurrency: trader.user.preferredCurrency,
    jobCountry: job.address?.country ?? job.customer?.country,
    traderCountry: trader.user.country ?? trader.country,
  });

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

  const withDistance = (
    await Promise.all(
      candidates.map(async (job) => {
        const currency = await currencyForDiscoverJob(job, trader);
        const item = toListItem(job, origin, new Set(), null, undefined, currency);
        return { job, item, distanceKm: item.distanceKm, currency };
      })
    )
  )
    .filter((row) => row.distanceKm <= radiusKm)
    .sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return b.job.createdAt.getTime() - a.job.createdAt.getTime();
    });

  const slice = withDistance.slice((page - 1) * limit, page * limit);
  const jobIds = slice.map((r) => r.job.id);

  const [bookmarks, visits, quotes] = await Promise.all([
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
    jobIds.length
      ? prisma.quote.findMany({
          where: { traderId: trader.id, jobId: { in: jobIds } },
          select: {
            id: true,
            jobId: true,
            quotedAmount: true,
            notes: true,
            status: true,
            requestedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve(
          [] as Array<{
            id: string;
            jobId: string;
            quotedAmount: Prisma.Decimal;
            notes: string | null;
            status: string;
            requestedAt: Date | null;
          }>
        ),
  ]);
  const bookmarkedIds = new Set(bookmarks.map((b) => b.jobId));
  const visitByJob = new Map(visits.map((v) => [v.jobId, v.status]));
  const quoteByJob = new Map<string, (typeof quotes)[number]>();
  for (const q of quotes) {
    if (!quoteByJob.has(q.jobId)) quoteByJob.set(q.jobId, q);
  }

  return slice.map(({ job, currency }) => {
    const q = quoteByJob.get(job.id) ?? null;
    const visitStatus = visitByJob.get(job.id) ?? null;
    const isSiteVisit = isSiteVisitJob(job);
    const quoteFlags = resolveDiscoverQuoteFlags({
      quote: q,
      jobStatus: job.status,
      jobTraderId: job.traderId ?? null,
      traderId: trader.id,
      isSiteVisit,
      hasActiveVisit: Boolean(visitStatus && visitStatus !== TraderSiteVisitStatus.CANCELLED),
    });
    // Site-visit slots proposed → waiting for customer confirm (same waiting flag mobile uses)
    const waitingOnVisit = visitStatus === TraderSiteVisitStatus.PENDING;
    return toListItem(
      job,
      origin,
      bookmarkedIds,
      visitStatus,
      {
        ...quoteFlags,
        isWaitingForCustomerConfirmation:
          quoteFlags.isWaitingForCustomerConfirmation || waitingOnVisit,
        assignmentStatus:
          quoteFlags.isWaitingForCustomerConfirmation || waitingOnVisit
            ? 'WAITING_FOR_CUSTOMER'
            : quoteFlags.assignmentStatus,
      },
      currency
    );
  });
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
        { quotes: { some: { traderId: trader.id } } },
        { traderId: trader.id },
      ],
    },
    include: {
      address: {
        select: {
          houseNumber: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          county: true,
          eircode: true,
          country: true,
          latitude: true,
          longitude: true,
        },
      },
      booking: { select: { status: true } },
      customer: {
        select: {
          id: true,
          fullName: true,
          profilePhotoUrl: true,
          mobileVerified: true,
          emailVerified: true,
          preferredCurrency: true,
          country: true,
        },
      },
      category: { select: { id: true, name: true, iconName: true, urlSlug: true } },
      subcategory: { select: { id: true, name: true, urlSlug: true } },
      photos: {
        where: { kind: 'CUSTOMER' },
        select: { id: true, photoUrl: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!job) {
    throw new NotFoundError('Job not found or no longer available.');
  }

  // Once customer confirmed & assigned, Discover detail redirects traders to My Jobs flow.
  if (job.traderId && job.traderId !== trader.id) {
    throw new NotFoundError('Job not found or no longer available.');
  }

  const [bookmark, visitRow, quoteRow] = await Promise.all([
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
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        slots: {
          select: {
            id: true,
            visitDate: true,
            timeSlot: true,
            startTime: true,
            endTime: true,
            sortOrder: true,
            isSelected: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    }),
    prisma.quote.findFirst({
      where: { jobId, traderId: trader.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        quotedAmount: true,
        notes: true,
        status: true,
        requestedAt: true,
      },
    }),
  ]);

  const activeVisit =
    visitRow && visitRow.status !== TraderSiteVisitStatus.CANCELLED ? visitRow : null;

  const isSiteVisitPreview = isSiteVisitJob(job);
  let quoteState = resolveDiscoverQuoteFlags({
    quote: quoteRow,
    jobStatus: job.status,
    jobTraderId: job.traderId,
    traderId: trader.id,
    isSiteVisit: isSiteVisitPreview,
    hasActiveVisit: Boolean(activeVisit),
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
    status: job.status,
    traderId: job.traderId,
    address: job.address,
    customer: {
      preferredCurrency: job.customer.preferredCurrency,
      country: job.customer.country,
    },
    booking: job.booking,
  };

  const currency = await currencyForDiscoverJob(listCard, trader);
  const list = toListItem(
    listCard,
    origin,
    new Set(bookmark ? [jobId] : []),
    activeVisit?.status ?? null,
    quoteState,
    currency
  );
  const fee = money(job.siteVisitFee);
  const isSiteVisit = list.isSiteVisit || isSiteVisitPreview;
  const baseSiteVisit = toSiteVisitPayload(activeVisit);
  const needsReschedule = jobNeedsReschedule(job, activeVisit?.status);
  // Align siteVisit.status with list badge when job needs reschedule but trader has no visit yet
  const siteVisit = (
    needsReschedule && baseSiteVisit.status === 'NONE'
      ? { ...baseSiteVisit, status: 'RESCHEDULE_REQUIRED' as const }
      : baseSiteVisit
  ) as ReturnType<typeof toSiteVisitPayload>;
  // Site-visit jobs: allow request job after slots proposed (optional quote for fee jobs).
  if (isSiteVisit && !quoteState.hasSubmittedQuote && siteVisit.status === 'PENDING') {
    quoteState = {
      ...quoteState,
      canRequestJob:
        !quoteState.isJobRequested &&
        job.traderId !== trader.id &&
        job.status === JobStatus.PUBLISHED &&
        job.traderId == null,
    };
  }
  const actions = resolvePrimaryActions(isSiteVisit, siteVisit, quoteState, needsReschedule);
  const waitingOnVisitConfirm = siteVisit.status === 'PENDING';
  const isWaitingForCustomerConfirmation =
    quoteState.isWaitingForCustomerConfirmation || waitingOnVisitConfirm;
  const isReschedule =
    (needsReschedule || siteVisit.status === 'RESCHEDULE_REQUIRED') && !waitingOnVisitConfirm;
  /**
   * Visit schedule date for UI:
   * - Fresh site visit (NONE) → null (trader has not selected slots yet)
   * - PENDING / CONFIRMED / COMPLETED → trader's proposed/confirmed visitDate
   * - RESCHEDULE_REQUIRED → previous visitDate if any, else null
   * - Normal (non site-visit) jobs → customer preferred job.scheduledDate
   */
  const scheduledDate = (() => {
    if (!isSiteVisit) return job.scheduledDate;
    if (
      (siteVisit.status === 'PENDING' ||
        siteVisit.status === 'CONFIRMED' ||
        siteVisit.status === 'COMPLETED' ||
        siteVisit.status === 'RESCHEDULE_REQUIRED') &&
      siteVisit.visitDate
    ) {
      return new Date(`${siteVisit.visitDate}T12:00:00.000Z`);
    }
    return null;
  })();
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
          /** Fetchable icon URL for mobile (not a Lucide/name key). */
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

  const isSiteVisitDone = siteVisit.status === 'COMPLETED';
  const canCompleteSiteVisit = siteVisit.status === 'CONFIRMED';
  const visitStatusBadge = visitStatusBadgeFor(siteVisit.status);
  const visitSectionLabel =
    isReschedule || siteVisit.status === 'RESCHEDULE_REQUIRED'
      ? ('RESCHEDULED_VISIT' as const)
      : siteVisit.status === 'PENDING' ||
          siteVisit.status === 'CONFIRMED' ||
          siteVisit.status === 'COMPLETED'
        ? ('SCHEDULED_VISIT' as const)
        : null;
  // Figma "Accept Job for €X" — same action as Request Job; amount for button label.
  const serviceChargeAmt = money(job.serviceCharge) ?? 0;
  const maxBudgetAmt = money(job.maxBudget) ?? 0;
  const minBudgetAmt = money(job.minBudget) ?? 0;
  const acceptJobAmount =
    quoteState.quoteAmount ??
    (serviceChargeAmt > 0 ? serviceChargeAmt : null) ??
    (maxBudgetAmt > 0 ? maxBudgetAmt : null) ??
    (minBudgetAmt > 0 ? minBudgetAmt : null);

  const jobPriceQuotation = resolveJobPriceQuotation({
    isSiteVisit,
    quoteAmount: quoteState.quoteAmount,
    minBudget: minBudgetAmt > 0 ? minBudgetAmt : null,
    maxBudget: maxBudgetAmt > 0 ? maxBudgetAmt : null,
    serviceCharge: serviceChargeAmt > 0 ? serviceChargeAmt : null,
  });
  const primaryActionLabel = primaryActionLabelFor(actions.primaryAction, acceptJobAmount);

  return {
    ...list,
    description: job.description,
    photos,
    photoCount: photos.length,
    /** Prefer showing fee card only when value > 0; still return 0 if DB has 0. */
    siteVisitFee: isSiteVisit ? fee : null,
    siteVisitRequested: Boolean(job.siteVisitRequested),
    /**
     * Single price for Job Details top card (mobile owns labels).
     * Quotation when submitted; else estimated budget for normal jobs. Not siteVisitFee.
     */
    jobPriceQuotation,
    /** Mobile key spelling (Symball) — same value as currencySymbol. */
    jobPriceQuotationCurrencySymball: list.currencySymbol,
    jobPriceQuotationCurrencyCode: list.currencyCode,
    isReschedule,
    ...actions,
    /** Ready-to-show bottom button text (from primaryAction). */
    primaryActionLabel,
    hasSubmittedQuote: quoteState.hasSubmittedQuote,
    canUpdateQuote: actions.canUpdateQuote,
    canRequestJob: actions.canRequestJob,
    /** Alias of canRequestJob — Figma "Accept Job" button. */
    canAcceptJob: actions.canRequestJob,
    /** Amount to show on Accept Job button (quote / service charge / budget). */
    acceptJobAmount,
    isJobRequested: quoteState.isJobRequested,
    isWaitingForCustomerConfirmation,
    assignmentStatus: isWaitingForCustomerConfirmation
      ? 'WAITING_FOR_CUSTOMER'
      : quoteState.assignmentStatus,
    quoteId: quoteState.quoteId,
    quoteAmount: quoteState.quoteAmount,
    quoteNotes: quoteState.quoteNotes,
    quoteStatus: quoteState.quoteStatus,
    siteVisit: {
      ...siteVisit,
      requested: Boolean(job.siteVisitRequested),
      isSiteVisit,
      isSiteVisitDone,
    },
    /** true only when this trader's site visit status is COMPLETED. */
    isSiteVisitDone,
    /** true when visit is CONFIRMED — trader can complete site visit (My Jobs CTA). */
    canCompleteSiteVisit,
    /** Figma badge on visit card: WAITING | CONFIRMED | RESCHEDULE_REQUESTED | COMPLETED */
    visitStatusBadge,
    /** Figma section title: SCHEDULED_VISIT | RESCHEDULED_VISIT | null */
    visitSectionLabel,
    customer: {
      id: job.customer.id,
      fullName: job.customer.fullName,
      profilePhotoUrl: job.customer.profilePhotoUrl,
      isVerified: customerVerified,
    },
    category: {
      id: job.category.id,
      name: job.category.name,
      iconName: job.category.iconName,
      iconUrl: categoryIconUrl,
    },
    subcategory: job.subcategory
      ? {
          id: job.subcategory.id,
          name: job.subcategory.name,
          iconUrl: subcategoryIconUrl,
        }
      : null,
    categoryName: job.category.name,
    subcategoryName: job.subcategory?.name ?? null,
    tags,
    scheduledDate,
    /** Visit time slot — only after trader proposed / confirmed; null on fresh site visit. */
    timeSlot:
      isSiteVisit && (siteVisit.status === 'NONE' || !siteVisit.timeSlot)
        ? null
        : siteVisit.timeSlot ?? (isSiteVisit ? null : job.timeSlot),
    durationLabel: job.durationLabel,
    location: {
      fullAddress: formatDiscoverFullAddress(job),
      areaName: list.areaName,
      distanceKm: list.distanceKm,
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
      scheduledDate: true,
      booking: { select: { status: true } },
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
    select: { id: true, status: true },
  });
  if (!isSiteVisitJob(job) && !existingVisit) {
    throw new BadRequestError('This job does not require a site visit.');
  }
  return { job, existingVisit };
};

/** Bottom sheet: Site Visit Date & Time — dates + periods + proposed multi-slots list. */
export const getSiteVisitSlots = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const { job, existingVisit } = await assertJobAccessibleForSiteVisit(trader.id, jobId);

  const visit = await prisma.traderSiteVisitRequest.findUnique({
    where: { jobId_traderId: { jobId, traderId: trader.id } },
    select: {
      id: true,
      visitDate: true,
      timeSlot: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      slots: {
        select: {
          id: true,
          visitDate: true,
          timeSlot: true,
          startTime: true,
          endTime: true,
          sortOrder: true,
          isSelected: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  const active = visit && visit.status !== TraderSiteVisitStatus.CANCELLED ? visit : null;
  const payload = toSiteVisitPayload(active);
  const needsReschedule = jobNeedsReschedule(job, active?.status ?? existingVisit?.status ?? null);

  return {
    jobId,
    title: needsReschedule ? 'Reschedule Visit Date & Time' : 'Site Visit Date & Time',
    dates: buildAvailableDates(),
    timeSlots: SITE_VISIT_SLOT_ORDER.map((id) => ({
      id,
      startTime: SITE_VISIT_SLOT_DEFS[id].startTime,
      endTime: SITE_VISIT_SLOT_DEFS[id].endTime,
      icon: SITE_VISIT_SLOT_DEFS[id].icon,
    })),
    proposedSlots: payload.slots,
    selected:
      active && active.visitDate != null && active.timeSlot != null
        ? {
            date: formatVisitDateKey(active.visitDate),
            timeSlot: active.timeSlot,
          }
        : payload.slots[0]
          ? { date: payload.slots[0].date, timeSlot: payload.slots[0].timeSlot }
          : null,
    mode: needsReschedule ? 'RESCHEDULE' : 'REQUEST',
  };
};

const upsertSiteVisit = async (
  traderId: string,
  jobId: string,
  body: {
    date?: string;
    timeSlot?: SiteVisitTimeSlot;
    slots?: Array<{ date: string; timeSlot: SiteVisitTimeSlot }>;
  },
  mode: 'request' | 'reschedule'
) => {
  const slotsInput = normalizeSlotsInput(body);
  const parsed = slotsInput.map((s) => ({
    visitDate: parseVisitDateOnly(s.date),
    timeSlot: s.timeSlot,
    startTime: SITE_VISIT_SLOT_DEFS[s.timeSlot].startTime,
    endTime: SITE_VISIT_SLOT_DEFS[s.timeSlot].endTime,
  }));
  const primary = parsed[0];

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      siteVisitRequested: true,
      quoteType: true,
      scheduledDate: true,
      booking: { select: { status: true } },
    },
  });

  const existing = await prisma.traderSiteVisitRequest.findUnique({
    where: { jobId_traderId: { jobId, traderId } },
  });

  if (mode === 'request') {
    // Allow create/update while pending; only block once customer confirmed.
    if (existing && existing.status === TraderSiteVisitStatus.CONFIRMED) {
      throw new ConflictError('Site visit already confirmed. Use reschedule if a new slot is needed.');
    }
    if (existing && existing.status === TraderSiteVisitStatus.COMPLETED) {
      throw new ConflictError('Site visit is already completed.');
    }
  } else if (!existing || existing.status === TraderSiteVisitStatus.CANCELLED) {
    // Allow first slot proposal via reschedule when job itself needs reschedule (past preferred date).
    const allowCreate =
      job != null && jobNeedsReschedule(job, existing?.status ?? null);
    if (!allowCreate) {
      throw new BadRequestError('No site visit to reschedule. Request a site visit first.');
    }
  }

  const nextStatus =
    mode === 'reschedule' ||
    existing?.status === TraderSiteVisitStatus.RESCHEDULE_REQUIRED
      ? TraderSiteVisitStatus.PENDING
      : existing?.status === TraderSiteVisitStatus.CONFIRMED
        ? TraderSiteVisitStatus.CONFIRMED
        : TraderSiteVisitStatus.PENDING;

  const row = await prisma.$transaction(async (tx) => {
    const request = await tx.traderSiteVisitRequest.upsert({
      where: { jobId_traderId: { jobId, traderId } },
      create: {
        jobId,
        traderId,
        visitDate: primary.visitDate,
        timeSlot: primary.timeSlot,
        status: TraderSiteVisitStatus.PENDING,
      },
      update: {
        visitDate: primary.visitDate,
        timeSlot: primary.timeSlot,
        status: nextStatus,
      },
    });

    await tx.traderSiteVisitSlot.deleteMany({ where: { requestId: request.id } });
    await tx.traderSiteVisitSlot.createMany({
      data: parsed.map((s, index) => ({
        requestId: request.id,
        visitDate: s.visitDate,
        timeSlot: s.timeSlot,
        startTime: s.startTime,
        endTime: s.endTime,
        sortOrder: index,
        isSelected: index === 0,
      })),
    });

    return tx.traderSiteVisitRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: { slots: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  return toSiteVisitPayload(row);
};

/** CTA: Request For Site Visit — multi-slot `slots[]` or legacy date+timeSlot. */
export const requestSiteVisit = async (
  userId: string,
  jobId: string,
  body: {
    date?: string;
    timeSlot?: SiteVisitTimeSlot;
    slots?: Array<{ date: string; timeSlot: SiteVisitTimeSlot }>;
  }
) => {
  const trader = await getTraderContext(userId);
  await assertJobAccessibleForSiteVisit(trader.id, jobId);
  const siteVisit = await upsertSiteVisit(trader.id, jobId, body, 'request');
  const detail = await getDiscoverJob(userId, jobId);
  return { ...detail, siteVisit };
};

/** CTA: Request For Reschedule Site Visit — replaces proposed slots. */
export const rescheduleSiteVisit = async (
  userId: string,
  jobId: string,
  body: {
    date?: string;
    timeSlot?: SiteVisitTimeSlot;
    slots?: Array<{ date: string; timeSlot: SiteVisitTimeSlot }>;
  }
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

/**
 * Request / Accept Job from Discover Job Details.
 * Does NOT assign trader — sets waiting-for-customer flags. Job stays on Discover.
 */
export const requestDiscoverJob = async (
  userId: string,
  jobId: string,
  body?: { amount?: number; notes?: string }
) => {
  await requestJob(userId, jobId, body);
  return getDiscoverJob(userId, jobId);
};

/**
 * Home Active/Waiting card — jobs this trader requested, awaiting customer confirmation.
 */
export const listWaitingJobs = async (userId: string) => {
  const trader = await getTraderContext(userId);
  const origin = resolveOrigin(trader);

  const quotes = await prisma.quote.findMany({
    where: {
      traderId: trader.id,
      status: QuoteStatus.PENDING,
      requestedAt: { not: null },
      job: { status: JobStatus.PUBLISHED, traderId: null },
    },
    orderBy: { requestedAt: 'desc' },
    select: {
      id: true,
      quotedAmount: true,
      requestedAt: true,
      job: {
        select: {
          id: true,
          title: true,
          city: true,
          postcode: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          address: { select: { city: true, county: true } },
          customer: { select: { fullName: true } },
        },
      },
    },
  });

  return {
    items: quotes.map((q) => {
      const amount = money(q.quotedAmount) ?? 0;
      const coords = resolveJobCoords(q.job, origin);
      const distanceKm = Math.round(haversineKm(origin, coords) * 10) / 10;
      return {
        id: q.job.id,
        title: q.job.title,
        customerName: q.job.customer.fullName,
        areaName: areaNameOf(q.job),
        distanceKm,
        quoteAmount: amount,
        statusBadge: 'Waiting',
        colorHint: 'blue',
        isJobRequested: true,
        isWaitingForCustomerConfirmation: true,
        assignmentStatus: 'WAITING_FOR_CUSTOMER',
        hasSubmittedQuote: true,
        requestedAt: q.requestedAt,
        jobStatus: JobStatus.PUBLISHED,
        primaryAction: 'WAITING_FOR_CUSTOMER',
      };
    }),
    count: quotes.length,
  };
};
