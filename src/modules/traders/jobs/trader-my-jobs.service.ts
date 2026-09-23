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
import { resolveDiscoverCurrency } from '../../../services/currency.service';

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

type FlowStatus =
  | 'CANCELLED'
  | 'READY_TO_ARRIVE'
  | 'ARRIVED'
  | 'WORK_PROOF_PENDING'
  | 'READY_TO_FINISH'
  | 'SITE_VISIT_IN_PROGRESS'
  | 'SITE_VISIT_PAYMENT_PENDING'
  | 'PARTIAL_PAYMENT_PENDING'
  | 'PARTIALLY_PAID'
  | 'AWAITING_PAYMENT'
  | 'COMPLETED'
  | 'OPEN';

const money = (v: Prisma.Decimal | number | null | undefined): number => {
  if (v == null) return 0;
  return Number(v);
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const sumPaidAmount = (
  requests: { status: TraderPaymentRequestStatus; totalAmount: Prisma.Decimal | number }[]
) =>
  round2(
    requests
      .filter((r) => r.status === TraderPaymentRequestStatus.PAID)
      .reduce((s, r) => s + money(r.totalAmount), 0)
  );

const resolvePartialPaymentStatus = (
  jobAmount: number,
  alreadyPaid: number,
  hasOpenPartial: boolean
): string => {
  if (alreadyPaid <= 0 && !hasOpenPartial) return 'UNPAID';
  if (alreadyPaid > 0 && alreadyPaid < jobAmount) return 'PARTIALLY_PAID';
  if (alreadyPaid >= jobAmount && jobAmount > 0) return 'PAID';
  if (hasOpenPartial) return 'PENDING';
  return 'UNPAID';
};

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
    // Include cancelled visits too — cancelled site-visit jobs still appear under OTHER.
    { siteVisitRequests: { some: { traderId } } },
    { quotes: { some: { traderId } } },
  ],
});

const tabStatusWhere = (tab: MyJobsTab, traderId: string): Prisma.JobWhereInput => {
  if (tab === 'ACTIVE') {
    // Running jobs: assigned in-progress + open site-visit jobs for this trader.
    // Never include finishedAt jobs or JobStatus.COMPLETED / CANCELLED.
    return {
      status: { notIn: [JobStatus.COMPLETED, JobStatus.CANCELLED] },
      AND: [
        {
          OR: [
            { booking: null },
            { booking: { finishedAt: null } },
          ],
        },
        {
          OR: [
            // Assigned trader — normal active job
            {
              traderId,
              OR: [
                { status: { in: [...ACTIVE_JOB_STATUSES, JobStatus.PAYMENT_PENDING] } },
        {
          booking: {
            traderId,
                    finishedAt: null,
            status: { in: [BookingStatus.SCHEDULED, BookingStatus.IN_PROGRESS] },
          },
                },
              ],
            },
            // Site visit in progress (may not have job.traderId yet)
            {
              siteVisitRequests: {
                some: {
                  traderId,
                  status: { notIn: [TraderSiteVisitStatus.CANCELLED, TraderSiteVisitStatus.COMPLETED] },
                },
              },
            },
          ],
        },
      ],
    };
  }
  if (tab === 'COMPLETED') {
    // Only after trader finishes the job (booking.finishedAt set) or status COMPLETED.
    // Arrived / proof-pending / in-progress must NEVER appear here.
  return {
      traderId,
      status: JobStatus.COMPLETED,
          booking: {
            traderId,
        finishedAt: { not: null },
      },
    };
  }
  // OTHER tab = cancelled jobs only (not site-visit / quotes / other leftovers).
  return {
    OR: [
      { status: JobStatus.CANCELLED },
      { booking: { status: BookingStatus.CANCELLED } },
    ],
  };
};

const statusBadgeFor = (
  status: JobStatus,
  bookingStatus?: string | null,
  flowStatus?: FlowStatus
): string => {
  if (status === JobStatus.CANCELLED || bookingStatus === BookingStatus.CANCELLED) {
    return 'Cancelled';
  }
  if (flowStatus) {
    switch (flowStatus) {
      case 'READY_TO_ARRIVE':
        return 'Ready to Arrive';
      case 'ARRIVED':
        return 'Job Arrived';
      case 'WORK_PROOF_PENDING':
        return 'Work Proof';
      case 'READY_TO_FINISH':
        return 'In Progress';
      case 'SITE_VISIT_IN_PROGRESS':
        return 'Site Visit';
      case 'SITE_VISIT_PAYMENT_PENDING':
        return 'Site Visit Fee';
      case 'PARTIAL_PAYMENT_PENDING':
        return 'Partial Payment Pending';
      case 'PARTIALLY_PAID':
        return 'Partially Paid';
      case 'AWAITING_PAYMENT':
        return 'Awaiting Payout';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        break;
    }
  }
  if (status === JobStatus.PAYMENT_PENDING) return 'Awaiting Payout';
  if (status === JobStatus.COMPLETED) return 'Completed';
  if (ACTIVE_JOB_STATUSES.includes(status)) return 'Active';
  return 'Open';
};

/** Machine-readable progress for Flutter ACTIVE vs COMPLETED UI. */
const resolveFlowStatus = (input: {
  status: JobStatus;
  bookingStatus?: string | null;
  arrivedAt?: Date | null;
  finishedAt?: Date | null;
  proofCount?: number;
  siteVisitStatus?: TraderSiteVisitStatus | null;
  hasSiteVisitPaymentRequest?: boolean;
  hasOpenPartialPayment?: boolean;
  alreadyPaidAmount?: number;
  jobAmount?: number;
}): { flowStatus: FlowStatus; statusLabel: string } => {
  const {
    status,
    bookingStatus,
    arrivedAt,
    finishedAt,
    proofCount = 0,
    siteVisitStatus = null,
    hasSiteVisitPaymentRequest = false,
    hasOpenPartialPayment: _hasOpenPartialPayment = false,
    alreadyPaidAmount = 0,
    jobAmount = 0,
  } = input;

  if (status === JobStatus.CANCELLED || bookingStatus === BookingStatus.CANCELLED) {
    return { flowStatus: 'CANCELLED', statusLabel: 'Cancelled' };
  }

  const visitActive =
    siteVisitStatus != null &&
    siteVisitStatus !== TraderSiteVisitStatus.CANCELLED &&
    siteVisitStatus !== TraderSiteVisitStatus.COMPLETED;
  const visitCompleted = siteVisitStatus === TraderSiteVisitStatus.COMPLETED;

  if (visitActive && !arrivedAt && !finishedAt) {
    return { flowStatus: 'SITE_VISIT_IN_PROGRESS', statusLabel: 'Site Visit In Progress' };
  }
  if (visitCompleted && !hasSiteVisitPaymentRequest && !finishedAt && status !== JobStatus.COMPLETED) {
    return {
      flowStatus: 'SITE_VISIT_PAYMENT_PENDING',
      statusLabel: 'Site Visit Payment Pending',
    };
  }

  // While job is still in progress, keep proof-screen statuses so app opens
  // Job Proof (not a separate awaiting-partial screen). Partial state is exposed
  // via isPartialJob + paymentStatus instead.
  // (PARTIAL_PAYMENT_PENDING / PARTIALLY_PAID only matter after finish / payout UIs.)

  if (finishedAt || status === JobStatus.COMPLETED) {
    if (alreadyPaidAmount > 0 && jobAmount > 0 && alreadyPaidAmount < jobAmount) {
      return { flowStatus: 'PARTIALLY_PAID', statusLabel: 'Partially Paid' };
    }
    return { flowStatus: 'COMPLETED', statusLabel: 'Completed' };
  }
  if (status === JobStatus.PAYMENT_PENDING) {
    return { flowStatus: 'AWAITING_PAYMENT', statusLabel: 'Awaiting Payment' };
  }

  if (arrivedAt && !finishedAt) {
    if (proofCount <= 0) {
      return { flowStatus: 'WORK_PROOF_PENDING', statusLabel: 'Work Proof Pending' };
    }
    return { flowStatus: 'READY_TO_FINISH', statusLabel: 'Ready to Finish' };
  }

  if (
    status === JobStatus.ACCEPTED ||
    status === JobStatus.SCHEDULED ||
    status === JobStatus.IN_PROGRESS
  ) {
    return { flowStatus: 'READY_TO_ARRIVE', statusLabel: 'Ready to Arrive' };
  }

  return { flowStatus: 'OPEN', statusLabel: 'Open' };
};

const isJobCancelled = (
  status: JobStatus,
  bookingStatus?: string | null
): boolean =>
  status === JobStatus.CANCELLED || bookingStatus === BookingStatus.CANCELLED;

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
      booking: {
        include: {
          invoice: {
            include: {
              payments: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          ratingReview: true,
        },
      },
      customer: {
        select: {
          id: true,
          fullName: true,
          profilePhotoUrl: true,
          mobileVerified: true,
          emailVerified: true,
          mobileNumber: true,
          preferredCurrency: true,
          country: true,
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
        where: { traderId },
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
      paymentRequests: {
        where: { traderId },
        orderBy: { createdAt: 'desc' },
        take: 20,
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
  const cancelled = isJobCancelled(job.status, booking?.status ?? null);

  if (cancelled) {
    return {
      canArrive: false,
      canFinish: false,
      canAddMaterials: false,
      canSubmitQuote: false,
      canAcceptJob: false,
      canRequestPayment: false,
      canRequestPartialPayment: false,
      canCompleteSiteVisit: false,
      canRequestSiteVisitPayment: false,
      isPartialJob: false,
    };
  }

  const hasActiveVisit =
    visit &&
    visit.status !== TraderSiteVisitStatus.CANCELLED &&
    visit.status !== TraderSiteVisitStatus.COMPLETED;
  const visitCompleted = visit?.status === TraderSiteVisitStatus.COMPLETED;
  const bookingArrived = Boolean(booking?.arrivedAt);
  const bookingFinished = Boolean(booking?.finishedAt);
  const isInProgress =
    job.status === JobStatus.IN_PROGRESS || booking?.status === BookingStatus.IN_PROGRESS;

  const alreadyPaidAmount = sumPaidAmount(job.paymentRequests);
  const hasOpenPartial = job.paymentRequests.some(
    (p) =>
      p.type === TraderPaymentRequestType.PARTIAL &&
      p.status === TraderPaymentRequestStatus.SENT
  );
  const hasAnyPartial = job.paymentRequests.some(
    (p) =>
      p.type === TraderPaymentRequestType.PARTIAL &&
      p.status !== TraderPaymentRequestStatus.CANCELLED
  );
  const breakdown = computePaymentBreakdown(job);
  const jobAmount = breakdown.totalAmount;
  const remainingBalance = round2(Math.max(0, jobAmount - alreadyPaidAmount));
  /** Once partial flow started, stay on Job Proof until fully paid — no Submit & Next. */
  const isPartialJob = !bookingFinished && (hasAnyPartial || alreadyPaidAmount > 0);
  const blockFinishForPartial = isPartialJob && remainingBalance > 0;

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
    isInProgress &&
    job.photos.some((p) => p.kind === JobPhotoKind.PROOF) &&
    !blockFinishForPartial;
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
  const canRequestPartialPayment =
    assignedToThis &&
    bookingArrived &&
    !bookingFinished &&
    isInProgress &&
    job.status !== JobStatus.CANCELLED &&
    remainingBalance > 0 &&
    !hasOpenPartial;
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
    canRequestPartialPayment,
    canCompleteSiteVisit,
    canRequestSiteVisitPayment,
    isPartialJob,
  };
};

const resolvePrimaryAction = (
  actions: ReturnType<typeof buildActions>,
  job: MyJobRow
): { primaryAction: string } => {
  if (isJobCancelled(job.status, job.booking?.status ?? null)) {
    return { primaryAction: 'VIEW_DETAILS' };
  }
  if (actions.canArrive) return { primaryAction: 'ARRIVE' };
  // Partial job: stay on Job Proof — only part-payment CTA (not Submit & Next / FINISH)
  if (actions.isPartialJob && job.booking?.arrivedAt && !job.booking?.finishedAt) {
    if (!actions.canRequestPartialPayment) {
      return { primaryAction: 'AWAITING_PARTIAL_PAYMENT' };
    }
    return { primaryAction: 'REQUEST_PARTIAL_PAYMENT' };
  }
  if (
    job.booking?.arrivedAt &&
    !job.booking.finishedAt &&
    !job.photos.some((p) => p.kind === JobPhotoKind.PROOF)
  ) {
    return { primaryAction: 'UPLOAD_PROOF' };
  }
  if (actions.canFinish) return { primaryAction: 'FINISH' };
  if (actions.canRequestPartialPayment) return { primaryAction: 'REQUEST_PARTIAL_PAYMENT' };
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
          // Keep cancelled visits so cancelled site-visit jobs still get siteVisit=true.
          where: { traderId: trader.id },
          select: { status: true, visitDate: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        booking: {
          select: {
            status: true,
            traderId: true,
            arrivedAt: true,
            finishedAt: true,
            scheduledDate: true,
          },
        },
        photos: {
          where: { kind: JobPhotoKind.PROOF },
          select: { id: true },
          take: 1,
        },
        paymentRequests: {
          where: {
            traderId: trader.id,
            status: { not: TraderPaymentRequestStatus.CANCELLED },
          },
          select: { id: true, type: true, status: true, totalAmount: true },
          take: 20,
        },
        siteVisitRequested: true,
        siteVisitFee: true,
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const origin = resolveOrigin(trader);

  const items = jobs.map((job) => {
    const visits = job.siteVisitRequests;
    const activeVisit =
      visits.find(
        (v) =>
          v.status !== TraderSiteVisitStatus.CANCELLED &&
          v.status !== TraderSiteVisitStatus.COMPLETED
      ) ??
      visits.find((v) => v.status !== TraderSiteVisitStatus.CANCELLED) ??
      null;
    const visit = activeVisit ?? visits[0] ?? null;
    const isSiteVisitJob = Boolean(
      job.siteVisitRequested || visits.length > 0 || (job.siteVisitFee != null && money(job.siteVisitFee) > 0)
    );
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

    const hasOpenPartial = job.paymentRequests.some(
      (p) =>
        p.type === TraderPaymentRequestType.PARTIAL &&
        p.status === TraderPaymentRequestStatus.SENT
    );
    const hasAnyPartial = job.paymentRequests.some(
      (p) =>
        p.type === TraderPaymentRequestType.PARTIAL &&
        p.status !== TraderPaymentRequestStatus.CANCELLED
    );
    const alreadyPaidAmount = sumPaidAmount(job.paymentRequests);
    const jobAmountEstimate = round2(
      (quotePrice ?? 0) + PLATFORM_FEE + ((quotePrice ?? 0) + PLATFORM_FEE) * VAT_RATE
    );
    const remainingBalance = round2(Math.max(0, jobAmountEstimate - alreadyPaidAmount));
    const isPartialJob =
      !job.booking?.finishedAt && (hasAnyPartial || alreadyPaidAmount > 0);

    const cancelled = isJobCancelled(job.status, job.booking?.status ?? null);
    const { flowStatus, statusLabel } = resolveFlowStatus({
      status: job.status,
      bookingStatus: job.booking?.status ?? null,
      arrivedAt: job.booking?.arrivedAt ?? null,
      finishedAt: job.booking?.finishedAt ?? null,
      proofCount: job.photos.length,
      siteVisitStatus: activeVisit?.status ?? null,
      hasSiteVisitPaymentRequest: job.paymentRequests.some(
        (p) => p.type === TraderPaymentRequestType.SITE_VISIT_FEE
      ),
      hasOpenPartialPayment: hasOpenPartial,
      alreadyPaidAmount,
      jobAmount: jobAmountEstimate,
    });

    // Prefer ARRIVE before site-visit CTAs when trader has not marked arrival yet
    // (matches detail resolvePrimaryAction / app "I have arrived" button).
    let primaryAction = 'VIEW_DETAILS';
    if (cancelled) {
      primaryAction = 'VIEW_DETAILS';
    } else if (job.booking && !job.booking.arrivedAt && !job.booking.finishedAt) {
      primaryAction = 'ARRIVE';
    } else if (flowStatus === 'SITE_VISIT_IN_PROGRESS') {
      primaryAction = 'COMPLETE_SITE_VISIT';
    } else if (flowStatus === 'SITE_VISIT_PAYMENT_PENDING') {
      primaryAction = 'REQUEST_SITE_VISIT_PAYMENT';
    } else if (isPartialJob && job.booking?.arrivedAt && !job.booking?.finishedAt) {
      // Stay on Job Proof screen — only part-payment CTA until fully paid
      primaryAction = hasOpenPartial
        ? 'AWAITING_PARTIAL_PAYMENT'
        : remainingBalance > 0
          ? 'REQUEST_PARTIAL_PAYMENT'
          : 'FINISH';
    } else if (flowStatus === 'WORK_PROOF_PENDING') {
      primaryAction = 'UPLOAD_PROOF';
    } else if (job.booking?.arrivedAt && !job.booking.finishedAt) {
      primaryAction = 'FINISH';
    } else if (job.status === JobStatus.PAYMENT_PENDING || flowStatus === 'AWAITING_PAYMENT') {
      primaryAction = 'AWAITING_PAYOUT';
    } else if (job.status === JobStatus.COMPLETED || flowStatus === 'COMPLETED') {
      primaryAction = 'VIEW_DETAILS';
    }

    const scheduledDate =
      job.scheduledDate ?? job.booking?.scheduledDate ?? visit?.visitDate ?? null;

    return {
      id: job.id,
      jobRef: job.jobRef,
      title: job.title,
      status: job.status,
      // Cancelled always wins for status chip; site-visit type is separate field below.
      statusBadge: statusBadgeFor(job.status, job.booking?.status ?? null, flowStatus),
      statusLabel: cancelled ? 'Cancelled' : statusLabel,
      flowStatus,
      paymentStatus: resolvePartialPaymentStatus(
        jobAmountEstimate,
        alreadyPaidAmount,
        hasOpenPartial
      ),
      isPartPayment: isPartialJob,
      isPartialJob,
      siteVisit: isSiteVisitJob,
      siteVisitRequested: Boolean(job.siteVisitRequested),
      // Second label for UI: show with Cancelled when site-visit job was cancelled.
      siteVisitLabel: isSiteVisitJob ? 'Site Visit' : null,
      arrivalStatus: job.booking?.arrivedAt
        ? 'ARRIVED'
        : job.booking
          ? 'ARRIVING_SOON'
          : null,
      siteVisitedBadge: Boolean(siteVisitedBadge),
      customerName: job.customer.fullName,
      customerProfilePhotoUrl: job.customer.profilePhotoUrl,
      areaName,
      distanceKm,
      quotePrice,
      scheduledDate,
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

  const currency = await resolveDiscoverCurrency({
    customerPreferredCurrency: job.customer.preferredCurrency,
    traderPreferredCurrency: trader.user.preferredCurrency,
    jobCountry: job.address?.country ?? job.customer.country,
    traderCountry: trader.user.country ?? trader.country,
  });
  const formatPriceLabel = (amount: number) =>
    `${currency.currencySymbol}${amount.toFixed(2)}`;
  const materialItems = job.materials.map((m) => {
    const price = money(m.price);
    return {
      id: m.id,
      name: m.name,
      detail: m.detail,
      price,
      priceLabel: formatPriceLabel(price),
      currencyCode: currency.currencyCode,
      currencySymbol: currency.currencySymbol,
      photoUrl: m.photoUrl,
    };
  });

  const hasSiteVisitPaymentRequest = job.paymentRequests.some(
    (p) =>
      p.type === TraderPaymentRequestType.SITE_VISIT_FEE &&
      p.status !== TraderPaymentRequestStatus.CANCELLED
  );
  const hasOpenPartialPayment = job.paymentRequests.some(
    (p) =>
      p.type === TraderPaymentRequestType.PARTIAL &&
      p.status === TraderPaymentRequestStatus.SENT
  );
  const hasAnyPartial = job.paymentRequests.some(
    (p) =>
      p.type === TraderPaymentRequestType.PARTIAL &&
      p.status !== TraderPaymentRequestStatus.CANCELLED
  );
  const alreadyPaidAmount = job.paymentRequests
    .filter((p) => p.status === TraderPaymentRequestStatus.PAID)
    .reduce((s, p) => s + money(p.totalAmount), 0);
  const jobAmountEstimate =
    (quotePrice ?? 0) > 0
      ? round2((quotePrice ?? 0) + PLATFORM_FEE + ((quotePrice ?? 0) + PLATFORM_FEE) * VAT_RATE)
      : 0;
  const paymentStatus = resolvePartialPaymentStatus(
    jobAmountEstimate,
    alreadyPaidAmount,
    hasOpenPartialPayment
  );
  const isPartialJob =
    !job.booking?.finishedAt && (hasAnyPartial || alreadyPaidAmount > 0);
  const { flowStatus, statusLabel } = resolveFlowStatus({
    status: job.status,
    bookingStatus: job.booking?.status ?? null,
    arrivedAt: job.booking?.arrivedAt ?? null,
    finishedAt: job.booking?.finishedAt ?? null,
    proofCount: proofPhotos.length,
    siteVisitStatus: job.siteVisitRequests[0]?.status ?? null,
    hasSiteVisitPaymentRequest,
    hasOpenPartialPayment,
    alreadyPaidAmount,
    jobAmount: jobAmountEstimate,
  });

  return {
    id: job.id,
    title: job.title,
    createdAt: job.createdAt,
    jobRef: job.jobRef,
    description: job.description,
    status: job.status,
    statusBadge: statusBadgeFor(job.status, job.booking?.status ?? null, flowStatus),
    statusLabel,
    flowStatus,
    paymentStatus,
    siteVisit: {
      ...siteVisitBlock(job),
      requested: Boolean(job.siteVisitRequested),
      isSiteVisit: Boolean(job.siteVisitRequested || job.siteVisitRequests[0]),
    },
    photos: customerPhotos.map((p) => p.photoUrl),
    proofPhotos: proofPhotos.map((p) => ({ id: p.id, photoUrl: p.photoUrl })),
    completionPhotos: proofPhotos.map((p) => p.photoUrl),
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
      id: job.customer.id,
      fullName: job.customer.fullName,
      name: job.customer.fullName,
      profilePhotoUrl: job.customer.profilePhotoUrl,
      avatar: job.customer.profilePhotoUrl,
      location: job.city || job.address?.city || formatFullAddress(job),
      isVerified: customerVerified,
      phoneNumber: job.phoneNumber || job.customer.mobileNumber || null,
      rating: null as number | null,
      jobsPosted: job.customer._count.jobs,
      conversationId: job.id,
    },
    materials: {
      ...materials,
      items: materialItems,
      totalLabel: formatPriceLabel(materials.total),
      currencyCode: currency.currencyCode,
      currencySymbol: currency.currencySymbol,
    },
    negotiationMessages,
    ...actions,
    ...primary,
    isPartialJob,
    isPartPayment: isPartialJob,
    estimatedEarnings,
    durationLabel: job.durationLabel,
    arrivalStatus: arrivalStatus(job),
    scheduledDate:
      job.scheduledDate ??
      job.booking?.scheduledDate ??
      job.siteVisitRequests[0]?.visitDate ??
      null,
  };
};

const formatOutcomeDateLabel = (date: Date, kind: 'COMPLETED' | 'CANCELLED') => {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const prefix = kind === 'COMPLETED' ? 'Finished on' : 'Cancelled on';
  return `${prefix} ${month} ${day}, ${year} • ${hours}:${minutes} ${ampm}`;
};

const formatShortDateTimeLabel = (date: Date) => {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} • ${hours}:${minutes} ${ampm}`;
};

const formatTimelineTimeLabel = (date: Date) => {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${months[date.getMonth()]} ${date.getDate()}, ${hours}:${minutes} ${ampm}`;
};

const buildCancelledTimeline = (job: MyJobRow, cancelledAt: Date) => {
  const steps: Array<{
    key: string;
    title: string;
    time: string;
    isCompleted: boolean;
    isCancelledStep?: boolean;
  }> = [
    {
      key: 'JOB_REQUESTED',
      title: 'Job Requested',
      time: formatTimelineTimeLabel(job.createdAt),
      isCompleted: true,
    },
  ];

  const confirmedAt = job.booking?.createdAt ?? null;
  if (confirmedAt) {
    steps.push({
      key: 'TRADER_CONFIRMED',
      title: 'Trader Confirmed',
      time: formatTimelineTimeLabel(confirmedAt),
      isCompleted: true,
    });
  }

  steps.push({
    key: 'CANCELLED',
    title: 'Cancelled by Customer',
    time: formatTimelineTimeLabel(cancelledAt),
    isCompleted: true,
    isCancelledStep: true,
  });

  return steps;
};

const resolvePaymentStatusLabel = (job: MyJobRow): string => {
  const invoice = job.booking?.invoice;
  if (invoice?.status === 'PAID') return 'PAID';
  if (invoice?.status === 'REFUNDED') return 'REFUNDED';
  const latestPayment = invoice?.payments?.[0];
  if (latestPayment?.status === 'COMPLETED') return 'PAID';
  if (latestPayment?.status === 'FAILED') return 'FAILED';
  if (job.status === JobStatus.PAYMENT_PENDING) return 'PENDING';
  if (job.status === JobStatus.CANCELLED) return 'CANCELLED';
  // Ready for full / part payment request after job finish
  if (job.status === JobStatus.COMPLETED || job.booking?.finishedAt) return 'UNPAID';
  return 'UNPAID';
};

/** Payment Request screen breakdown (Submit & Next response). */
const buildSubmitPaymentSummary = (job: MyJobRow) => {
  const invoice = job.booking?.invoice;
  const breakdown = computePaymentBreakdown(job);
  const offerDiscount = invoice
    ? round2(money(invoice.traderOfferDiscount) + money(invoice.promoDiscount))
    : 0;
  const baseRate = invoice ? money(invoice.serviceCharge) : breakdown.serviceCharge;
  const platformFee = invoice ? money(invoice.platformFee) : breakdown.platformFee;
  const materialCost = breakdown.materialsTotal;
  const vatRate = Math.round(breakdown.vatRate * 100);
  const vatAmount = invoice ? money(invoice.tax) : breakdown.vatAmount;
  const totalAmount = invoice ? money(invoice.totalAmount) : breakdown.totalAmount;

  return {
    baseRate,
    materialCost,
    materialsTotal: materialCost,
    platformFee,
    offerApplied: offerDiscount > 0 ? -offerDiscount : 0,
    siteVisitFee: breakdown.siteVisitFee,
    vatRate,
    vatPercentage: vatRate,
    vatAmount,
    totalAmount,
    netPayout: totalAmount,
  };
};

const formatMoneyWithSymbol = (currencySymbol: string, amount: number) => {
  const rounded = round2(amount);
  const amountDisplay = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2);
  return `${currencySymbol} ${amountDisplay}`;
};

const buildOutcomePaymentSummary = (
  job: MyJobRow,
  currency: { currencyCode: string; currencySymbol: string }
) => {
  const summary = buildSubmitPaymentSummary(job);
  const moneyLabel = (amount: number) =>
    formatMoneyWithSymbol(currency.currencySymbol, amount);

  return {
    baseRate: moneyLabel(summary.baseRate),
    platformFee: moneyLabel(summary.platformFee),
    offerApplied: moneyLabel(summary.offerApplied),
    materialsTotal: moneyLabel(summary.materialsTotal),
    materialCost: moneyLabel(summary.materialCost),
    siteVisitFee: moneyLabel(summary.siteVisitFee),
    vatPercentage: summary.vatPercentage,
    vatRate: summary.vatRate,
    vatAmount: moneyLabel(summary.vatAmount),
    netPayout: moneyLabel(summary.netPayout),
    totalAmount: moneyLabel(summary.totalAmount),
    currencyCode: currency.currencyCode,
    currencySymbol: currency.currencySymbol,
    paymentStatus: resolvePaymentStatusLabel(job),
  };
};

/**
 * Completed / cancelled history screens — matches mobile dummy payload shape.
 */
export const getJobOutcomeDetail = async (
  userId: string,
  jobId: string,
  expected: 'COMPLETED' | 'CANCELLED'
) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);
  const cancelled = isJobCancelled(job.status, job.booking?.status ?? null);
  const completedLike =
    job.status === JobStatus.COMPLETED || job.status === JobStatus.PAYMENT_PENDING;

  if (expected === 'COMPLETED' && !completedLike) {
    throw new BadRequestError('Job is not completed.');
  }
  if (expected === 'CANCELLED' && !cancelled) {
    throw new BadRequestError('Job is not cancelled.');
  }

  const eventAt =
    expected === 'COMPLETED'
      ? (job.booking?.finishedAt ?? job.updatedAt)
      : job.updatedAt;
  const proofPhotos = job.photos.filter((p) => p.kind === JobPhotoKind.PROOF);
  const review = job.booking?.ratingReview ?? null;
  const invoice = job.booking?.invoice ?? null;
  const categoryLabel = job.subcategory?.name || job.category?.name || 'SERVICE';

  if (expected === 'CANCELLED') {
    const isSiteVisitJob = Boolean(
      job.siteVisitRequested ||
        job.siteVisitRequests.length > 0 ||
        (job.siteVisitFee != null && money(job.siteVisitFee) > 0)
    );
    return {
      id: job.id,
      jobRef: job.jobRef ? job.jobRef.replace(/^#/, '') : null,
      title: job.title,
      category: categoryLabel,
      status: JobStatus.CANCELLED,
      statusBadge: 'Cancelled',
      siteVisit: isSiteVisitJob,
      siteVisitRequested: Boolean(job.siteVisitRequested),
      siteVisitLabel: isSiteVisitJob ? 'Site Visit' : null,
      cancellationTitle: 'Job Terminated',
      cancellationReason:
        'Customer requested cancellation due to personal scheduling conflict.',
      cancelledBy: 'CUSTOMER',
      cancelledAt: eventAt,
      formattedCancelledDate: formatShortDateTimeLabel(eventAt),
      fullAddress: formatFullAddress(job),
      latitude: job.latitude ?? job.address?.latitude ?? null,
      longitude: job.longitude ?? job.address?.longitude ?? null,
      customerId: job.customer.id,
      customerName: job.customer.fullName,
      customerProfileImage: job.customer.profilePhotoUrl,
      customerPhoneNumber: job.phoneNumber || job.customer.mobileNumber || null,
      timeline: buildCancelledTimeline(job, eventAt),
    };
  }

  const isSiteVisitJob = Boolean(
    job.siteVisitRequested ||
      job.siteVisitRequests.length > 0 ||
      (job.siteVisitFee != null && money(job.siteVisitFee) > 0)
  );

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

  // Full part-payment history (same item shape as GET .../part-payment-history).
  // FE may show first N on completed screen and use View All for the rest.
  const { items: previousPayments, total: previousPaymentsTotal } =
    await buildInstallmentPaymentList(userId, jobId);

  return {
    id: job.id,
    jobRef: job.jobRef ? (job.jobRef.startsWith('#') ? job.jobRef : `#${job.jobRef}`) : null,
    title: job.title,
    // Keep string for existing UI; prefer parent category name (not UPPERCASE).
    category: job.category?.name || job.subcategory?.name || categoryLabel,
    categoryName: job.category?.name ?? null,
    subcategoryName: job.subcategory?.name ?? null,
    tags,
    status: job.status,
    statusBadge: statusBadgeFor(job.status, job.booking?.status ?? null),
    siteVisit: isSiteVisitJob,
    siteVisitRequested: Boolean(job.siteVisitRequested),
    siteVisitLabel: isSiteVisitJob ? 'Site Visit' : null,
    completedAt: eventAt,
    cancelledAt: null,
    formattedCompletedDate: formatOutcomeDateLabel(eventAt, 'COMPLETED'),
    customer: {
      id: job.customer.id,
      name: job.customer.fullName,
      location: job.city || job.address?.city || formatFullAddress(job),
      avatar: job.customer.profilePhotoUrl,
      conversationId: job.id,
    },
    review: review
      ? {
          rating: review.stars,
          comment: review.review,
          createdAt: review.createdAt,
        }
      : null,
    completionPhotos: proofPhotos.map((p) => p.photoUrl),
    paymentSummary: buildOutcomePaymentSummary(
      job,
      await resolveDiscoverCurrency({
        customerPreferredCurrency: job.customer.preferredCurrency,
        traderPreferredCurrency: trader.user.preferredCurrency,
        jobCountry: job.address?.country ?? job.customer.country,
        traderCountry: trader.user.country ?? trader.country,
      })
    ),
    /** Full installment list — same shape as GET .../part-payment-history (FE truncates for UI). */
    previousPayments,
    previousPaymentsTotal,
    invoiceId: invoice?.invoiceNumber ?? invoice?.id ?? null,
    invoiceUrl: `/traders/jobs/mine/${job.id}/invoice/download`,
  };
};

/** Process / progress screen — same as detail with materials items for in-job UI. */
export const getProcessJobDetail = async (userId: string, jobId: string) => {
  const detail = await getMyJobDetail(userId, jobId);
  if (
    detail.status !== JobStatus.IN_PROGRESS &&
    detail.status !== JobStatus.ACCEPTED &&
    detail.status !== JobStatus.SCHEDULED
  ) {
    throw new BadRequestError('Job is not in an active process state.');
  }
  return detail;
};

export const arriveAtJob = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);

  if (isJobCancelled(job.status, job.booking?.status ?? null)) {
    throw new BadRequestError('This job was cancelled.');
  }
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

  if (isJobCancelled(job.status, job.booking?.status ?? null)) {
    throw new BadRequestError('This job was cancelled.');
  }
  if (!job.booking || job.booking.traderId !== trader.id) {
    throw new BadRequestError('No booking found for this job.');
  }
  if (!job.booking.arrivedAt) {
    throw new BadRequestError('Mark arrival before finishing the job.');
  }
  if (job.booking.finishedAt) {
    throw new ConflictError('Job already finished.');
  }
  const proofCount = job.photos.filter((p) => p.kind === JobPhotoKind.PROOF).length;
  if (proofCount <= 0) {
    throw new BadRequestError('Upload at least one work-proof photo before finishing.');
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

/**
 * Job Progress screen — Submit & Next.
 *
 * isPartPayment: false → save proof + finish job (COMPLETED).
 * isPartPayment: true  → save proof only; job stays ACTIVE/IN_PROGRESS.
 *   Then app calls POST .../request-partial-payment with amount + description
 *   (Partial Payment screen has no image upload — images already saved here).
 */
export const submitJobCompletion = async (
  userId: string,
  jobId: string,
  input: {
    photoUrl?: string;
    photoUrls?: string[];
    isPartPayment?: boolean;
  }
) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);
  const isPartPayment = Boolean(input.isPartPayment);

  if (isJobCancelled(job.status, job.booking?.status ?? null)) {
    throw new BadRequestError('This job was cancelled.');
  }
  if (!job.booking || job.booking.traderId !== trader.id) {
    throw new BadRequestError('No booking found for this job.');
  }
  if (!job.booking.arrivedAt) {
    throw new BadRequestError('Mark arrival before submitting completion.');
  }
  if (job.booking.finishedAt) {
    throw new ConflictError('Job already finished.');
  }

  const photoUrls = [
    ...new Set([...(input.photoUrls ?? []), ...(input.photoUrl ? [input.photoUrl] : [])]),
  ].filter(Boolean);

  if (photoUrls.length === 0) {
    throw new BadRequestError('Provide at least one work-proof photo URL.');
  }

  // ── Partial path: save proof only (job stays ACTIVE) ─────────────────────
  if (isPartPayment) {
    await prisma.jobPhoto.createMany({
      data: photoUrls.map((photoUrl) => ({
        jobId,
        photoUrl,
        kind: JobPhotoKind.PROOF,
        uploadedById: userId,
      })),
    });

    const fresh = await assertMyJob(trader.id, jobId);
    const breakdown = computePaymentBreakdown(fresh);
    const jobAmount = breakdown.totalAmount;
    const requests = await loadJobPaymentRequests(jobId, trader.id);
    const alreadyPaid = sumPaidAmount(requests);
    const hasOpenPartial = requests.some(
      (r) =>
        r.type === TraderPaymentRequestType.PARTIAL &&
        r.status === TraderPaymentRequestStatus.SENT
    );
    const paymentStatus = resolvePartialPaymentStatus(jobAmount, alreadyPaid, hasOpenPartial);
    const remainingBalance = round2(Math.max(0, jobAmount - alreadyPaid));

    return {
      id: fresh.id,
      jobRef: fresh.jobRef,
      title: fresh.title,
      status: fresh.status,
      statusBadge: statusBadgeFor(fresh.status, fresh.booking?.status ?? null),
      flowStatus: (photoUrls.length > 0 || fresh.photos.some((p) => p.kind === JobPhotoKind.PROOF)
        ? 'READY_TO_FINISH'
        : 'WORK_PROOF_PENDING') as FlowStatus,
      statusLabel: 'Work Proof — Partial Job',
      isPartPayment: true,
      isPartialJob: true,
      paymentStatus,
      proofPhotosAdded: photoUrls.length,
      canFinish: false,
      canRequestPartialPayment: remainingBalance > 0 && !hasOpenPartial && !fresh.booking?.finishedAt,
      primaryAction: hasOpenPartial
        ? 'AWAITING_PARTIAL_PAYMENT'
        : 'REQUEST_PARTIAL_PAYMENT',
      jobAmount,
      alreadyPaid,
      remainingBalance,
      location: {
        fullAddress: formatFullAddress(fresh),
      },
      nextStep: 'REQUEST_PARTIAL_PAYMENT',
    };
  }

  // ── Mark as Finished path ────────────────────────────────────────────────
  // Once partial flow started and balance remains, force Job Proof + part payment only
  // (Submit & Next / finish must stay disabled until fully paid).
  {
    const requests = await loadJobPaymentRequests(jobId, trader.id);
    const alreadyPaid = sumPaidAmount(requests);
    const hasAnyPartial = requests.some(
      (r) =>
        r.type === TraderPaymentRequestType.PARTIAL &&
        r.status !== TraderPaymentRequestStatus.CANCELLED
    );
    const breakdown = computePaymentBreakdown(job);
    const remainingBalance = round2(Math.max(0, breakdown.totalAmount - alreadyPaid));
    const isPartialJob = hasAnyPartial || alreadyPaid > 0;
    if (isPartialJob && remainingBalance > 0) {
      throw new BadRequestError(
        'This is a partial payment job. Full finish (Submit & Next) is disabled until the remaining balance is paid. Use part payment / request-partial-payment, or wait until fully paid.'
      );
    }
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.jobPhoto.createMany({
      data: photoUrls.map((photoUrl) => ({
        jobId,
        photoUrl,
        kind: JobPhotoKind.PROOF,
        uploadedById: userId,
      })),
    });
    await tx.booking.update({
      where: { id: job.booking!.id },
      data: { finishedAt: now, status: BookingStatus.COMPLETED },
    });
    await tx.job.update({
      where: { id: job.id },
      data: { status: JobStatus.COMPLETED },
    });
  });

  const fresh = await assertMyJob(trader.id, jobId);
  const payload = buildPaymentRequestScreenPayload(fresh);
  return {
    ...payload,
    isPartPayment: false,
    isPartialJob: false,
    flowStatus: 'COMPLETED' as FlowStatus,
    statusLabel: 'Completed',
    proofPhotosAdded: photoUrls.length,
  };
};

/** Shared Payment Request screen payload (after Mark as Finished / reopen app). */
const buildPaymentRequestScreenPayload = (job: MyJobRow) => {
  const paymentSummary = buildSubmitPaymentSummary(job);
  const paymentStatus = resolvePaymentStatusLabel(job);
  const completedAt = job.booking?.finishedAt ?? job.updatedAt;
  const invoice = job.booking?.invoice;

  return {
    id: job.id,
    jobRef: job.jobRef ?? null,
    title: job.title,
    status: job.status,
    statusBadge: statusBadgeFor(job.status, job.booking?.status ?? null, 'COMPLETED'),
    flowStatus: (job.status === JobStatus.PAYMENT_PENDING
      ? 'AWAITING_PAYMENT'
      : 'COMPLETED') as FlowStatus,
    statusLabel: job.status === JobStatus.PAYMENT_PENDING ? 'Awaiting Payment' : 'Completed',
    completedAt,
    location: {
      fullAddress: formatFullAddress(job),
    },
    paymentSummary,
    paymentStatus,
    isPartPayment: paymentStatus === 'PARTIALLY_PAID' || paymentStatus === 'PENDING',
    canRequestPayment:
      job.status === JobStatus.COMPLETED ||
      (Boolean(job.booking?.finishedAt) && job.status !== JobStatus.PAYMENT_PENDING),
    invoiceId: invoice?.invoiceNumber ?? invoice?.id ?? null,
    invoiceUrl: `/traders/jobs/mine/${job.id}/invoice/download`,
  };
};

/**
 * Re-open Payment Request screen after Submit (e.g. user closed app and comes back).
 * Same shape as POST /submit response — no need to cache locally.
 */
export const getPaymentRequestScreen = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);

  if (isJobCancelled(job.status, job.booking?.status ?? null)) {
    throw new BadRequestError('This job was cancelled.');
  }
  if (!job.booking?.finishedAt && job.status !== JobStatus.COMPLETED && job.status !== JobStatus.PAYMENT_PENDING) {
    throw new BadRequestError(
      'Job is not ready for payment request. Submit job proof / finish first.'
    );
  }

  return buildPaymentRequestScreenPayload(job);
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

  const currency = await resolveDiscoverCurrency({
    customerPreferredCurrency: job.customer.preferredCurrency,
    traderPreferredCurrency: trader.user.preferredCurrency,
    jobCountry: job.address?.country ?? job.customer.country,
    traderCountry: trader.user.country ?? trader.country,
  });

  const formatPriceLabel = (amount: number) =>
    `${currency.currencySymbol}${amount.toFixed(2)}`;

  const items = job.materials.map((m) => {
    const price = money(m.price);
    return {
    id: m.id,
    name: m.name,
    detail: m.detail,
      price,
      priceLabel: formatPriceLabel(price),
      currencyCode: currency.currencyCode,
      currencySymbol: currency.currencySymbol,
    photoUrl: m.photoUrl,
    };
  });
  const total = round2(items.reduce((s, i) => s + i.price, 0));
  const last = job.materials[0]?.updatedAt ?? job.materials[0]?.createdAt ?? null;

  return {
    items,
    count: items.length,
    total,
    totalLabel: formatPriceLabel(total),
    currencyCode: currency.currencyCode,
    currencySymbol: currency.currencySymbol,
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
  // Alias of payment-request screen for reopen after Submit.
  return getPaymentRequestScreen(userId, jobId);
};

const loadJobPaymentRequests = async (jobId: string, traderId: string) =>
  prisma.traderPaymentRequest.findMany({
    where: {
      jobId,
      traderId,
      status: { not: TraderPaymentRequestStatus.CANCELLED },
    },
    orderBy: { createdAt: 'desc' },
  });

const formatPaidDateLabel = (date: Date) => {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const formatInstallmentPaymentDateLabel = (date: Date) => {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} • ${hours}:${minutes} ${ampm}`;
};

/**
 * Payment Request screen (partial installment) — GET details for Request Partial Payment.
 * Job amount, already paid, remaining balance, previous payments.
 */
export const getPartialPaymentScreen = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);

  if (isJobCancelled(job.status, job.booking?.status ?? null)) {
    throw new BadRequestError('This job was cancelled.');
  }
  if (!job.booking || job.booking.traderId !== trader.id) {
    throw new BadRequestError('No booking found for this job.');
  }
  if (!job.booking.arrivedAt) {
    throw new BadRequestError('Mark arrival before requesting partial payment.');
  }

  const breakdown = computePaymentBreakdown(job);
  const jobAmount = breakdown.totalAmount;
  const requests = await loadJobPaymentRequests(jobId, trader.id);
  const alreadyPaid = sumPaidAmount(requests);
  const remainingBalance = round2(Math.max(0, jobAmount - alreadyPaid));
  const hasOpenPartial = requests.some(
    (r) =>
      r.type === TraderPaymentRequestType.PARTIAL &&
      r.status === TraderPaymentRequestStatus.SENT
  );
  const paymentStatus = resolvePartialPaymentStatus(jobAmount, alreadyPaid, hasOpenPartial);

  const currency = await resolveDiscoverCurrency({
    customerPreferredCurrency: job.customer.preferredCurrency,
    traderPreferredCurrency: trader.user.preferredCurrency,
    jobCountry: job.address?.country ?? job.customer.country,
    traderCountry: trader.user.country ?? trader.country,
  });

  const previousPayments = requests
    .filter(
      (r) =>
        r.type === TraderPaymentRequestType.PARTIAL ||
        r.type === TraderPaymentRequestType.FULL_JOB ||
        r.status === TraderPaymentRequestStatus.PAID
    )
    .map((r) => {
      const amount = money(r.totalAmount);
      const rowCurrencyCode = r.currencyCode || currency.currencyCode;
      const rowCurrencySymbol =
        rowCurrencyCode === currency.currencyCode
          ? currency.currencySymbol
          : rowCurrencyCode === 'GBP'
            ? '£'
            : rowCurrencyCode === 'EUR'
              ? '€'
              : currency.currencySymbol;
      const amountDisplay =
        Number.isInteger(round2(amount)) ? String(round2(amount)) : round2(amount).toFixed(2);
  return {
        id: r.id,
        title:
          r.description?.trim() ||
          (r.type === TraderPaymentRequestType.PARTIAL
            ? 'Installment'
            : r.type === TraderPaymentRequestType.SITE_VISIT_FEE
              ? 'Site Visit Fee'
              : 'Job Payment'),
        description: r.description,
        amount,
        amountLabel: `${rowCurrencySymbol} ${amountDisplay}`,
        currencyCode: rowCurrencyCode,
        currencySymbol: rowCurrencySymbol,
        status: r.status,
        statusLabel:
          r.status === TraderPaymentRequestStatus.PAID
            ? `Paid • ${formatPaidDateLabel(r.updatedAt)}`
            : r.status === TraderPaymentRequestStatus.SENT
              ? 'Pending'
              : r.status,
        createdAt: r.createdAt,
        paidAt: r.status === TraderPaymentRequestStatus.PAID ? r.updatedAt : null,
        type: r.type,
      };
    });

  const formatAmountLabel = (amount: number) => {
    const amountDisplay =
      Number.isInteger(round2(amount)) ? String(round2(amount)) : round2(amount).toFixed(2);
    return `${currency.currencySymbol} ${amountDisplay}`;
  };

  return {
    id: job.id,
    jobRef: job.jobRef,
    title: job.title,
    status: job.status,
    statusBadge: statusBadgeFor(job.status, job.booking?.status ?? null),
    progressLabel: job.booking?.finishedAt ? 'COMPLETED' : 'IN PROGRESS',
    location: {
      fullAddress: formatFullAddress(job),
    },
    jobAmount,
    jobAmountLabel: formatAmountLabel(jobAmount),
    alreadyPaid,
    alreadyPaidLabel: formatAmountLabel(alreadyPaid),
    remainingBalance,
    remainingBalanceLabel: formatAmountLabel(remainingBalance),
    currencyCode: currency.currencyCode,
    currencySymbol: currency.currencySymbol,
    paymentStatus,
    previousPayments,
    escrowNote:
      'Funds are securely held and released only upon customer confirmation of milestone completion.',
    canRequestPartialPayment: remainingBalance > 0 && !job.booking.finishedAt && !hasOpenPartial,
  };
};

/**
 * Part Payment History — flat list for Transaction History UI cards.
 * Used by GET .../part-payment-history and embedded preview on completed job detail.
 */
const buildInstallmentPaymentList = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);

  const currency = await resolveDiscoverCurrency({
    customerPreferredCurrency: job.customer.preferredCurrency,
    traderPreferredCurrency: trader.user.preferredCurrency,
    jobCountry: job.address?.country ?? job.customer.country,
    traderCountry: trader.user.country ?? trader.country,
  });

  const requests = await loadJobPaymentRequests(jobId, trader.id);
  const installments = requests
    .filter((r) => r.type === TraderPaymentRequestType.PARTIAL)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const items = installments.map((r, index) => {
    const paymentDate =
      r.status === TraderPaymentRequestStatus.PAID ? r.updatedAt : r.createdAt;
    const txnSuffix = r.id.replace(/-/g, '').slice(-6).toUpperCase();
    const transactionId = `TXN-${txnSuffix}`;
    const title =
      r.description?.trim() ||
      (index === 0
        ? 'Initial Deposit'
        : index === installments.length - 1 && installments.length > 1
          ? 'Final Installment'
          : `Installment ${index + 1}`);

    const amount = money(r.totalAmount);
    const currencyCode = r.currencyCode || currency.currencyCode;
    const currencySymbol =
      currencyCode === currency.currencyCode
        ? currency.currencySymbol
        : currencyCode === 'GBP'
          ? '£'
          : currencyCode === 'EUR'
            ? '€'
            : currency.currencySymbol;
    const amountDisplay =
      Number.isInteger(round2(amount)) ? String(round2(amount)) : round2(amount).toFixed(2);

    const isPaid = r.status === TraderPaymentRequestStatus.PAID;
    const statusLabel = isPaid
      ? `Paid • ${formatPaidDateLabel(paymentDate)}`
      : r.status === TraderPaymentRequestStatus.SENT
        ? 'Pending'
        : String(r.status);

    return {
      id: transactionId,
      title,
      amount,
      amountLabel: `${currencySymbol} ${amountDisplay}`,
      currencyCode,
      currencySymbol,
      paymentDate,
      formattedPaymentDate: formatInstallmentPaymentDateLabel(paymentDate),
      status: r.status,
      statusLabel,
      transactionId,
    };
  });

  return { items, total: items.length };
};

/** GET .../part-payment-history — flat installment history list. */
export const listPartPaymentHistory = async (userId: string, jobId: string) => {
  const { items } = await buildInstallmentPaymentList(userId, jobId);
  return items;
};

/**
 * Send partial installment payment request (separate from full-job request-payment).
 * Optional proof photo URL(s) can be attached (same URLs from POST /uploads) — job stays IN_PROGRESS.
 */
export const requestPartialPayment = async (
  userId: string,
  jobId: string,
  input: {
    amount: number;
    description: string;
    photoUrl?: string;
    photoUrls?: string[];
  }
) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);

  if (isJobCancelled(job.status, job.booking?.status ?? null)) {
    throw new BadRequestError('This job was cancelled.');
  }
  if (!job.booking || job.booking.traderId !== trader.id) {
    throw new BadRequestError('No booking found for this job.');
  }
  if (!job.booking.arrivedAt) {
    throw new BadRequestError('Mark arrival before requesting partial payment.');
  }
  if (job.booking.finishedAt) {
    throw new BadRequestError(
      'Job is already finished. Use full payment request instead of partial.'
    );
  }

  const amount = round2(input.amount);
  if (!(amount > 0)) {
    throw new BadRequestError('Installment amount must be greater than 0.');
  }

  const description = input.description.trim();
  if (!description) {
    throw new BadRequestError('Description for this installment is required.');
  }

  const breakdown = computePaymentBreakdown(job);
  const jobAmount = breakdown.totalAmount;
  const requests = await loadJobPaymentRequests(jobId, trader.id);
  const alreadyPaid = sumPaidAmount(requests);
  const remainingBalance = round2(Math.max(0, jobAmount - alreadyPaid));

  if (remainingBalance <= 0) {
    throw new ConflictError('Job is already fully paid.');
  }
  if (amount > remainingBalance) {
    throw new BadRequestError(
      `Installment amount cannot exceed remaining balance (${remainingBalance}).`
    );
  }

  const openPartial = requests.find(
    (r) =>
      r.type === TraderPaymentRequestType.PARTIAL &&
      r.status === TraderPaymentRequestStatus.SENT
  );
  if (openPartial) {
    throw new ConflictError(
      'A partial payment request is already pending. Wait for the customer to pay or cancel it first.'
    );
  }

  const photoUrls = [
    ...new Set([...(input.photoUrls ?? []), ...(input.photoUrl ? [input.photoUrl] : [])]),
  ].filter(Boolean);

  const paymentRequest = await prisma.$transaction(async (tx) => {
    if (photoUrls.length > 0) {
      await tx.jobPhoto.createMany({
        data: photoUrls.map((photoUrl) => ({
          jobId,
          photoUrl,
          kind: JobPhotoKind.PROOF,
          uploadedById: userId,
        })),
      });
    }

    return tx.traderPaymentRequest.create({
      data: {
        jobId,
        traderId: trader.id,
        customerId: job.customerId,
        type: TraderPaymentRequestType.PARTIAL,
        status: TraderPaymentRequestStatus.SENT,
        description,
        serviceCharge: amount,
        materialsTotal: 0,
        siteVisitFee: 0,
        platformFee: 0,
        vatRate: 0,
        vatAmount: 0,
        totalAmount: amount,
      },
    });
  });

  const alreadyPaidAfter = alreadyPaid;
  const remainingAfter = round2(Math.max(0, jobAmount - alreadyPaidAfter));
  const paymentStatus = resolvePartialPaymentStatus(jobAmount, alreadyPaidAfter, true);
  const proofCount = job.photos.filter((p) => p.kind === JobPhotoKind.PROOF).length + photoUrls.length;
  const flowStatus = (
    proofCount > 0 ? 'READY_TO_FINISH' : 'WORK_PROOF_PENDING'
  ) as FlowStatus;

  const currency = await resolveDiscoverCurrency({
    customerPreferredCurrency: job.customer.preferredCurrency,
    traderPreferredCurrency: trader.user.preferredCurrency,
    jobCountry: job.address?.country ?? job.customer.country,
    traderCountry: trader.user.country ?? trader.country,
  });
  const formatAmountLabel = (value: number) => {
    const amountDisplay =
      Number.isInteger(round2(value)) ? String(round2(value)) : round2(value).toFixed(2);
    return `${currency.currencySymbol} ${amountDisplay}`;
  };

  return {
    paymentRequestId: paymentRequest.id,
    id: job.id,
    jobRef: job.jobRef,
    title: job.title,
    status: job.status,
    paymentStatus,
    isPartPayment: true,
    isPartialJob: true,
    // Stay on Job Proof screen — do not use PARTIAL_PAYMENT_PENDING for navigation
    // Do NOT call GET .../completed — job remains IN_PROGRESS until fully finished.
    flowStatus,
    statusLabel: proofCount > 0 ? 'Ready to Finish' : 'Work Proof Pending',
    proofPhotosAdded: photoUrls.length,
    canFinish: false,
    canRequestPartialPayment: false,
    primaryAction: 'AWAITING_PARTIAL_PAYMENT',
    currencyCode: currency.currencyCode,
    currencySymbol: currency.currencySymbol,
    installment: {
      amount,
      amountLabel: formatAmountLabel(amount),
      description,
      netDue: amount,
      netDueLabel: formatAmountLabel(amount),
      status: paymentRequest.status,
    },
    jobAmount,
    jobAmountLabel: formatAmountLabel(jobAmount),
    alreadyPaid: alreadyPaidAfter,
    alreadyPaidLabel: formatAmountLabel(alreadyPaidAfter),
    remainingBalance: remainingAfter,
    remainingBalanceLabel: formatAmountLabel(remainingAfter),
    duePaymentSummary: {
      installmentDueAmount: amount,
      installmentDueAmountLabel: formatAmountLabel(amount),
      netDue: amount,
      netDueLabel: formatAmountLabel(amount),
    },
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

/**
 * Download job invoice as PDF (completed / payment screens).
 */
export const downloadJobInvoicePdf = async (userId: string, jobId: string) => {
  const trader = await getTraderContext(userId);
  const job = await assertMyJob(trader.id, jobId);

  if (!job.booking?.finishedAt && job.status !== JobStatus.COMPLETED && job.status !== JobStatus.PAYMENT_PENDING) {
    throw new BadRequestError('Invoice is available after the job is finished.');
  }

  const summary = buildSubmitPaymentSummary(job);
  const paymentStatus = resolvePaymentStatusLabel(job);
  const invoice = job.booking?.invoice;
  const invoiceNumber =
    invoice?.invoiceNumber ||
    `INV-${(job.jobRef || job.id.slice(0, 8)).replace(/^#/, '')}`;

  const { buildInvoicePdfBuffer } = await import('../../../utils/invoice-pdf');
  const buffer = await buildInvoicePdfBuffer({
    invoiceNumber,
    jobRef: job.jobRef,
    title: job.title,
    completedAt: job.booking?.finishedAt ?? null,
    customerName: job.customer.fullName,
    address: formatFullAddress(job),
    currencyCode: invoice?.currencyCode || 'EUR',
    lines: [
      { label: 'Base rate', amount: summary.baseRate },
      { label: 'Materials', amount: summary.materialCost },
      { label: 'Platform fee', amount: summary.platformFee },
      { label: 'Offer applied', amount: summary.offerApplied },
      ...(summary.siteVisitFee > 0
        ? [{ label: 'Site visit fee', amount: summary.siteVisitFee }]
        : []),
      { label: `VAT (${summary.vatRate}%)`, amount: summary.vatAmount },
    ],
    totalAmount: summary.totalAmount,
    paymentStatus,
  });

  const filename = `${invoiceNumber}.pdf`.replace(/[^\w.-]+/g, '_');
  return { buffer, filename, invoiceNumber };
};
