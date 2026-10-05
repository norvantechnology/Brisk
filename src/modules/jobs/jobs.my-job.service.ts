import { BookingStatus, JobStatus, Prisma, QuoteStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { getCurrencyMeta } from '../../services/currency.service';
import { pushUserNotification } from '../../sockets/realtime';
import { createAdminNotifications } from '../admin/admin-notifications/admin-notifications.service';
import {
  customerJobAmountSelect,
  customerStatusBadgeFor,
  formatAddressLine,
  formatDisplayDay,
  money,
  resolveCustomerJobAmount,
  round2,
  toDisplayStatus,
  updateJob,
} from './jobs.service';
import type {
  CreateJobDisputeInput,
  JobReviewInput,
  RescheduleJobInput,
} from './jobs.validation';

export const DISPUTE_STATUSES = ['OPEN', 'IN REVIEW', 'RESOLVED', 'REJECTED'] as const;
const ACTIVE_DISPUTE_STATUSES = ['OPEN', 'IN REVIEW'];

const RESCHEDULABLE_STATUSES: JobStatus[] = [
  JobStatus.PUBLISHED,
  JobStatus.QUOTED,
  JobStatus.ACCEPTED,
  JobStatus.SCHEDULED,
];

const traderName = (t: { businessName: string | null; user: { fullName: string | null } }) =>
  t.businessName || t.user.fullName || 'Trader';

/** "Sarah C." — reviewer name shown to other customers. */
const shortName = (fullName: string | null | undefined) => {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Customer';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

const formatDateTime = (date: Date) =>
  date.toLocaleString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });

const isJobCancelled = (job: { status: JobStatus; booking?: { status: BookingStatus } | null }) =>
  job.status === JobStatus.CANCELLED || job.booking?.status === BookingStatus.CANCELLED;

// ---------------------------------------------------------------------------
// Quote detail (Trader Profile & Quote Details screen)
// ---------------------------------------------------------------------------

export const getJobQuoteDetail = async (
  customerId: string,
  jobId: string,
  quoteId: string,
  query: { reviewsLimit: number }
) => {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, jobId, job: { customerId } },
    include: {
      job: { select: { id: true, jobRef: true, title: true, status: true, traderId: true } },
      trader: {
        select: {
          id: true,
          businessName: true,
          bio: true,
          traderType: true,
          profilePhotoUrl: true,
          coverImageUrl: true,
          yearsExperience: true,
          avgRating: true,
          topRated: true,
          verificationStatus: true,
          city: true,
          county: true,
          country: true,
          createdAt: true,
          user: { select: { fullName: true, profilePhotoUrl: true } },
          categories: {
            where: { isActive: true },
            select: { category: { select: { id: true, name: true } } },
          },
          _count: { select: { ratingsReceived: true } },
        },
      },
    },
  });
  if (!quote) throw new NotFoundError('Quotation not found for this job.');

  const [jobsCompleted, reviews, currency] = await Promise.all([
    prisma.booking.count({ where: { traderId: quote.traderId, finishedAt: { not: null } } }),
    prisma.ratingReview.findMany({
      where: { traderId: quote.traderId },
      orderBy: { createdAt: 'desc' },
      take: query.reviewsLimit,
      include: { customer: { select: { fullName: true, profilePhotoUrl: true } } },
    }),
    getCurrencyMeta(quote.currencyCode),
  ]);

  const job = quote.job;
  const isOpen = !job.traderId && (job.status === JobStatus.PUBLISHED || job.status === JobStatus.QUOTED);
  const selectionStatus =
    job.traderId === quote.traderId && quote.status === QuoteStatus.ACCEPTED
      ? 'CONFIRMED'
      : quote.status === QuoteStatus.ACCEPTED && isOpen
        ? 'AWAITING TRADER CONFIRMATION'
        : quote.status;
  const t = quote.trader;
  const isVerified = t.verificationStatus === 'VERIFIED';

  return {
    quoteId: quote.id,
    jobId: job.id,
    jobRef: job.jobRef,
    jobTitle: job.title,
    jobStatus: toDisplayStatus(job.status),
    amount: money(quote.quotedAmount),
    currencyCode: quote.currencyCode,
    currencySymbol: currency.symbol,
    notes: quote.notes,
    estimatedDays: quote.estimatedDays,
    status: quote.status,
    selectionStatus,
    canAccept: isOpen && quote.status === QuoteStatus.PENDING,
    requestedAt: quote.requestedAt,
    createdAt: quote.createdAt,
    trader: {
      id: t.id,
      displayName: traderName(t),
      fullName: t.user.fullName,
      businessName: t.businessName,
      traderType: t.traderType,
      profilePhotoUrl: t.profilePhotoUrl ?? t.user.profilePhotoUrl ?? null,
      coverImageUrl: t.coverImageUrl,
      bio: t.bio,
      location: [t.city, t.county, t.country].filter(Boolean).join(', '),
      yearsExperience: t.yearsExperience ?? 0,
      avgRating: Number(t.avgRating ?? 0),
      reviewsCount: t._count.ratingsReceived,
      jobsCompleted,
      isTopRated: t.topRated,
      isVerified,
      badges: [t.topRated ? 'TOP RATED' : null, isVerified ? 'VERIFIED' : null].filter(Boolean),
      categories: t.categories.map((c) => c.category),
      memberSince: t.createdAt,
    },
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.stars,
      review: r.review,
      createdAt: r.createdAt,
      date: formatDisplayDay(r.createdAt),
      customerName: shortName(r.customer.fullName),
      customerPhotoUrl: r.customer.profilePhotoUrl,
    })),
  };
};

// ---------------------------------------------------------------------------
// Job progress (Booking Confirmed & Details screen)
// ---------------------------------------------------------------------------

type MilestoneStatus = 'COMPLETED' | 'CURRENT' | 'PENDING' | 'CANCELLED';

export const getJobProgress = async (customerId: string, jobId: string) => {
  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId },
    select: {
      ...customerJobAmountSelect,
      id: true,
      jobRef: true,
      title: true,
      description: true,
      scheduledDate: true,
      timeSlot: true,
      addressLine: true,
      city: true,
      postcode: true,
      latitude: true,
      longitude: true,
      cancellationReason: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
      address: true,
      trader: {
        select: {
          id: true,
          businessName: true,
          profilePhotoUrl: true,
          avgRating: true,
          topRated: true,
          user: { select: { fullName: true, profilePhotoUrl: true, mobileNumber: true } },
          _count: { select: { ratingsReceived: true } },
        },
      },
      booking: {
        select: {
          id: true,
          bookingRef: true,
          status: true,
          scheduledDate: true,
          arrivedAt: true,
          finishedAt: true,
          createdAt: true,
          ratingReview: { select: { stars: true, review: true, createdAt: true } },
          invoice: {
            select: {
              status: true,
              totalAmount: true,
              currencyCode: true,
              payments: {
                select: { refunds: { where: { status: 'COMPLETED' }, select: { refundAmount: true } } },
              },
            },
          },
        },
      },
      disputes: {
        where: { status: { in: ACTIVE_DISPUTE_STATUSES } },
        select: { id: true },
      },
    },
  });
  if (!job) throw new NotFoundError('Job not found.');

  const [acceptedQuote, lastInvoicePayment, lastPaidRequest] = await Promise.all([
    prisma.quote.findFirst({
      where: { jobId, status: QuoteStatus.ACCEPTED },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.payment.findFirst({
      where: { invoice: { booking: { jobId } }, status: 'COMPLETED' },
      orderBy: { paidAt: 'desc' },
      select: { paidAt: true },
    }),
    prisma.traderPaymentRequest.findFirst({
      where: { jobId, status: 'PAID' },
      orderBy: { paidAt: 'desc' },
      select: { paidAt: true },
    }),
  ]);

  const booking = job.booking;
  const cancelled = isJobCancelled(job);
  const finished = Boolean(booking?.finishedAt) || job.status === JobStatus.COMPLETED;
  const pricing = resolveCustomerJobAmount(job);
  const paid = finished && pricing.amountDue === 0 && pricing.totalPaid > 0;
  const paidAt =
    [lastInvoicePayment?.paidAt, lastPaidRequest?.paidAt]
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const steps: Array<{ key: string; title: string; done: boolean; at: Date | null }> = [
    {
      key: 'QUOTE ACCEPTED',
      title: 'Quote Accepted',
      done: Boolean(acceptedQuote || job.traderId),
      at: acceptedQuote?.updatedAt ?? null,
    },
    { key: 'BOOKING CONFIRMED', title: 'Booking Confirmed', done: Boolean(booking), at: booking?.createdAt ?? null },
    { key: 'TRADER ARRIVED', title: 'Trader Arrived', done: Boolean(booking?.arrivedAt), at: booking?.arrivedAt ?? null },
    { key: 'WORK COMPLETED', title: 'Work Completed', done: finished, at: booking?.finishedAt ?? null },
    { key: 'PAYMENT COMPLETED', title: 'Payment Completed', done: paid, at: paid ? paidAt : null },
  ];
  let currentAssigned = false;
  const milestones = steps.map((s) => {
    let status: MilestoneStatus;
    if (s.done) status = 'COMPLETED';
    else if (cancelled) status = 'CANCELLED';
    else if (!currentAssigned) {
      status = 'CURRENT';
      currentAssigned = true;
    } else status = 'PENDING';
    return { key: s.key, title: s.title, subtitle: s.at ? formatDateTime(s.at) : '', status, at: s.at };
  });

  const currencyMeta = await getCurrencyMeta(pricing.currencyCode);
  const scheduledDate = booking?.scheduledDate ?? job.scheduledDate;
  const hasActiveDispute = job.disputes.length > 0;

  return {
    jobId: job.id,
    jobRef: job.jobRef,
    bookingId: booking?.id ?? null,
    bookingRef: booking?.bookingRef ?? null,
    title: job.title,
    description: job.description,
    status: toDisplayStatus(cancelled ? JobStatus.CANCELLED : job.status),
    statusLabel: customerStatusBadgeFor(job.status, booking?.status ?? null, booking?.finishedAt ?? null),
    category: job.category,
    subcategory: job.subcategory,
    scheduledDate,
    date: scheduledDate ? formatDisplayDay(scheduledDate) : null,
    timeSlot: job.timeSlot,
    address: {
      fullAddress: job.address ? formatAddressLine(job.address) : job.addressLine,
      city: job.city,
      eircode: job.postcode,
      latitude: job.latitude,
      longitude: job.longitude,
    },
    trader: job.trader
      ? {
          id: job.trader.id,
          name: traderName(job.trader),
          profilePhotoUrl: job.trader.profilePhotoUrl ?? job.trader.user.profilePhotoUrl ?? null,
          phone: booking && !cancelled ? job.trader.user.mobileNumber : null,
          avgRating: Number(job.trader.avgRating ?? 0),
          reviewsCount: job.trader._count.ratingsReceived,
          isTopRated: job.trader.topRated,
        }
      : null,
    milestones,
    pricing: {
      amount: pricing.amount,
      amountType: pricing.amountType,
      amountDue: pricing.amountDue,
      totalPaid: pricing.totalPaid,
      refunded: pricing.refunded,
      currencyCode: pricing.currencyCode,
      currencySymbol: currencyMeta.symbol,
    },
    review: booking?.ratingReview
      ? {
          rating: booking.ratingReview.stars,
          review: booking.ratingReview.review,
          createdAt: booking.ratingReview.createdAt,
        }
      : null,
    cancellationReason: job.cancellationReason,
    cancelledAt: cancelled ? (job.cancelledAt ?? job.updatedAt) : null,
    downloadUrl: finished && job.traderId ? `/jobs/${job.id}/invoice/download` : null,
    actions: {
      canCancel: !cancelled && !finished && pricing.totalPaid === 0,
      canReschedule:
        !cancelled && !booking?.arrivedAt && RESCHEDULABLE_STATUSES.includes(job.status),
      canReview: finished && !cancelled && Boolean(job.trader) && !booking?.ratingReview,
      canReportIssue: Boolean(job.traderId) && !hasActiveDispute,
      hasActiveDispute,
    },
  };
};

// ---------------------------------------------------------------------------
// Reschedule
// ---------------------------------------------------------------------------

export const rescheduleJob = async (customerId: string, jobId: string, input: RescheduleJobInput) => {
  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId },
    select: {
      id: true,
      jobRef: true,
      title: true,
      status: true,
      categoryId: true,
      subcategoryId: true,
      traderId: true,
      customer: { select: { fullName: true } },
      trader: { select: { userId: true } },
      booking: { select: { id: true, status: true, arrivedAt: true, finishedAt: true } },
      _count: { select: { quotes: true } },
    },
  });
  if (!job) throw new NotFoundError('Job not found.');
  if (isJobCancelled(job)) throw new BadRequestError('Cancelled jobs cannot be rescheduled.');
  if (job.booking?.arrivedAt || job.booking?.finishedAt) {
    throw new BadRequestError('The trader has already started this job, so it can no longer be rescheduled.');
  }
  if (!RESCHEDULABLE_STATUSES.includes(job.status)) {
    throw new BadRequestError('This job cannot be rescheduled in its current status.');
  }

  const scheduledDate = new Date(`${input.date}T00:00:00.000Z`);
  const todayUtc = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  if (scheduledDate < todayUtc) throw new BadRequestError('Please choose today or a future date.');

  const categoryChanged =
    (input.serviceCategoryId !== undefined && input.serviceCategoryId !== job.categoryId) ||
    (input.serviceSubcategoryId !== undefined && input.serviceSubcategoryId !== job.subcategoryId);

  if (categoryChanged) {
    if (job.traderId || job._count.quotes > 0) {
      throw new BadRequestError('The service cannot be changed after quotations are received. Only the date and time can be rescheduled.');
    }
    const nextCategoryId = input.serviceCategoryId ?? job.categoryId;
    await updateJob(customerId, jobId, {
      categoryId: nextCategoryId,
      subcategoryId:
        input.serviceSubcategoryId !== undefined
          ? input.serviceSubcategoryId
          : nextCategoryId !== job.categoryId
            ? null
            : undefined,
      scheduledDate,
      timeSlot: input.timeSlot,
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: {
          scheduledDate,
          timeSlot: input.timeSlot,
          ...(job.status === JobStatus.ACCEPTED && job.booking ? { status: JobStatus.SCHEDULED } : {}),
        },
      });
      if (job.booking) {
        await tx.booking.update({ where: { id: job.booking.id }, data: { scheduledDate } });
      }
    });
  }

  if (job.trader?.userId) {
    await pushUserNotification([job.trader.userId], {
      type: 'JOB_RESCHEDULED',
      title: 'Job rescheduled',
      message: `${job.customer.fullName || 'The customer'} moved "${job.title}" to ${formatDisplayDay(scheduledDate)} (${input.timeSlot}).`,
      data: {
        jobId,
        jobRef: job.jobRef,
        bookingId: job.booking?.id ?? null,
        scheduledDate: scheduledDate.toISOString(),
        timeSlot: input.timeSlot,
      },
    });
  }

  return getJobProgress(customerId, jobId);
};

// ---------------------------------------------------------------------------
// Rating & review
// ---------------------------------------------------------------------------

export const submitJobReview = async (customerId: string, jobId: string, input: JobReviewInput) => {
  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId },
    select: {
      id: true,
      jobRef: true,
      title: true,
      status: true,
      customer: { select: { fullName: true } },
      trader: { select: { id: true, userId: true } },
      booking: { select: { id: true, status: true, finishedAt: true, ratingReview: { select: { id: true } } } },
    },
  });
  if (!job) throw new NotFoundError('Job not found.');
  if (!job.trader || !job.booking) throw new BadRequestError('This job has no booked trader to review.');
  if (isJobCancelled(job)) throw new BadRequestError('Cancelled jobs cannot be reviewed.');
  if (!job.booking.finishedAt && job.status !== JobStatus.COMPLETED) {
    throw new BadRequestError('You can rate the trader once the job is finished.');
  }
  if (job.booking.ratingReview) throw new ConflictError('You have already reviewed this job.');

  const traderId = job.trader.id;
  const bookingId = job.booking.id;
  const { created, avgRating, reviewsCount } = await prisma.$transaction(async (tx) => {
    const created = await tx.ratingReview.create({
      data: {
        bookingId,
        customerId,
        traderId,
        stars: input.rating,
        review: input.review?.trim() || null,
      },
    });
    const agg = await tx.ratingReview.aggregate({
      where: { traderId },
      _avg: { stars: true },
      _count: { _all: true },
    });
    const avgRating = round2(agg._avg.stars ?? 0);
    await tx.trader.update({ where: { id: traderId }, data: { avgRating } });
    return { created, avgRating, reviewsCount: agg._count._all };
  });

  await pushUserNotification([job.trader.userId], {
    type: 'NEW_REVIEW',
    title: 'New review',
    message: `${job.customer.fullName || 'A customer'} rated "${job.title}" ${input.rating}/5.`,
    data: { jobId, jobRef: job.jobRef, reviewId: created.id, rating: input.rating },
  });

  return {
    reviewId: created.id,
    jobId,
    rating: created.stars,
    review: created.review,
    createdAt: created.createdAt,
    trader: { id: traderId, avgRating, reviewsCount },
  };
};

// ---------------------------------------------------------------------------
// Report an issue (disputes)
// ---------------------------------------------------------------------------

const generateDisputeRef = () => `DSP-${randomBytes(3).toString('hex').toUpperCase()}`;

export const serializeDispute = (d: Prisma.JobDisputeGetPayload<{ include: { job: { select: { id: true; jobRef: true; title: true } } } }>) => ({
  id: d.id,
  disputeId: d.id,
  disputeRef: d.disputeRef,
  jobId: d.jobId,
  jobRef: d.job.jobRef,
  jobTitle: d.job.title,
  reason: d.reason,
  description: d.description,
  evidenceUrls: d.evidenceUrls,
  status: d.status,
  adminNote: d.adminNote,
  resolvedAt: d.resolvedAt,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

export const createJobDispute = async (customerId: string, jobId: string, input: CreateJobDisputeInput) => {
  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId },
    select: {
      id: true,
      jobRef: true,
      title: true,
      status: true,
      traderId: true,
      customer: { select: { fullName: true } },
      disputes: { where: { status: { in: ACTIVE_DISPUTE_STATUSES } }, select: { id: true } },
    },
  });
  if (!job) throw new NotFoundError('Job not found.');
  if (!job.traderId) throw new BadRequestError('You can report an issue once a trader is assigned to this job.');
  if (job.disputes.length) {
    throw new ConflictError('You already have an open issue for this job. BRISK support will update you soon.');
  }

  let disputeRef = generateDisputeRef();
  for (let i = 0; i < 5 && (await prisma.jobDispute.findUnique({ where: { disputeRef } })); i++) {
    disputeRef = generateDisputeRef();
  }

  const dispute = await prisma.jobDispute.create({
    data: {
      disputeRef,
      jobId,
      customerId,
      traderId: job.traderId,
      reason: input.reason,
      description: input.description.trim(),
      evidenceUrls: input.evidenceUrls ?? [],
    },
    include: { job: { select: { id: true, jobRef: true, title: true } } },
  });

  await createAdminNotifications({
    type: 'JOB_DISPUTE',
    title: 'New job dispute',
    message: `${job.customer.fullName || 'A customer'} reported "${input.reason}" on ${job.jobRef ?? job.title}.`,
    actionUrl: `/disputes/${dispute.id}`,
    payload: { disputeId: dispute.id, disputeRef, jobId, jobRef: job.jobRef, reason: input.reason },
  }).catch(() => undefined);

  return serializeDispute(dispute);
};

export const listJobDisputes = async (customerId: string, jobId: string) => {
  const job = await prisma.job.findFirst({ where: { id: jobId, customerId }, select: { id: true } });
  if (!job) throw new NotFoundError('Job not found.');
  const rows = await prisma.jobDispute.findMany({
    where: { jobId },
    orderBy: { createdAt: 'desc' },
    include: { job: { select: { id: true, jobRef: true, title: true } } },
  });
  return rows.map(serializeDispute);
};
