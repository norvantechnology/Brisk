import {
  BookingStatus,
  JobStatus,
  Prisma,
  QuoteStatus,
  SiteVisitTimeSlot,
  TraderSiteVisitStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import {
  getCurrencyMeta,
  asBriskCurrency,
  currencyCodeFromCountry,
  convertAmount,
  resolveUserCurrency,
} from '../../services/currency.service';
import { emitSiteVisitUpdate, pushUserNotification } from '../../sockets/realtime';
import { createAdminNotifications } from '../admin/admin-notifications/admin-notifications.service';
import {
  customerJobAmountSelect,
  customerHasFinalPaymentRequest,
  customerStatusBadgeFor,
  formatAddressLine,
  formatDisplayDay,
  money,
  resolveCustomerJobAmount,
  resolveJobType,
  round2,
  toDisplayStatus,
} from './jobs.service';
import type {
  CreateJobDisputeInput,
  JobReviewInput,
  RescheduleJobInput,
} from './jobs.validation';
import { DISPUTE_MAX_EVIDENCE_PHOTOS, DISPUTE_REASONS } from './jobs.validation';

export const DISPUTE_STATUSES = ['OPEN', 'IN REVIEW', 'RESOLVED', 'REJECTED'] as const;
const ACTIVE_DISPUTE_STATUSES = ['OPEN', 'IN REVIEW'];

const RESCHEDULABLE_STATUSES: JobStatus[] = [
  JobStatus.PUBLISHED,
  JobStatus.QUOTED,
  JobStatus.ACCEPTED,
  JobStatus.SCHEDULED,
  JobStatus.IN_PROGRESS,
  JobStatus.PAYMENT_PENDING,
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

  const customer = await prisma.user.findUnique({
    where: { id: customerId },
    select: { preferredCurrency: true, country: true },
  });
  const customerCurrency =
    asBriskCurrency(customer?.preferredCurrency) ||
    currencyCodeFromCountry(customer?.country) ||
    'EUR';
  const customerMeta = await getCurrencyMeta(customerCurrency);

  const originalAmount = money(quote.quotedAmount);
  const originalCurrency = quote.currencyCode || 'EUR';
  let displayAmount = originalAmount;
  let exchangeRate = 1;

  if (originalCurrency !== customerCurrency) {
    try {
      const converted = await convertAmount(originalAmount, originalCurrency, customerCurrency);
      displayAmount = converted.amount;
      exchangeRate = converted.rate;
    } catch {
      // fallback
    }
  }

  const displayPriceLabel =
    originalCurrency !== customerCurrency
      ? `${customerMeta.symbol}${displayAmount} (approx ${currency.symbol}${originalAmount})`
      : `${customerMeta.symbol}${displayAmount}`;

  return {
    quoteId: quote.id,
    jobId: job.id,
    jobRef: job.jobRef,
    jobTitle: job.title,
    jobStatus: toDisplayStatus(job.status),
    amount: displayAmount,
    currencyCode: customerCurrency,
    currencySymbol: customerMeta.symbol,
    originalAmount,
    originalCurrencyCode: originalCurrency,
    originalCurrencySymbol: currency.symbol,
    exchangeRate,
    displayPriceLabel,
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
      quoteType: true,
      siteVisitRequested: true,
      siteVisitFee: true,
      siteVisitRequests: {
        where: { status: { not: TraderSiteVisitStatus.CANCELLED } },
        select: { id: true, status: true },
        take: 1,
      },
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
          customerConfirmedAt: true,
          createdAt: true,
          ratingReview: { select: { stars: true, tags: true, review: true, createdAt: true } },
          traderCustomerReview: {
            select: { stars: true, tags: true, review: true, createdAt: true },
          },
          invoice: {
            select: {
              id: true,
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
  const paymentRequested = customerHasFinalPaymentRequest(job);
  const customerCurrency = await resolveUserCurrency(customerId);
  const pricing = resolveCustomerJobAmount(job, customerCurrency);
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
    {
      key: 'COMPLETION CONFIRMED',
      title: 'Completion Confirmed',
      done: Boolean(booking?.customerConfirmedAt),
      at: booking?.customerConfirmedAt ?? null,
    },
    { key: 'PAYMENT COMPLETED', title: 'Payment Completed', done: paid, at: paid ? paidAt : null },
  ];
  let currentAssigned = false;
  const milestones = steps.map((s): {
    key: string;
    title: string;
    subtitle: string;
    status: MilestoneStatus;
    at: Date | null;
  } => {
    let status: MilestoneStatus;
    if (s.done) status = 'COMPLETED';
    else if (!cancelled && !currentAssigned) {
      status = 'CURRENT';
      currentAssigned = true;
    } else status = 'PENDING';
    return { key: s.key, title: s.title, subtitle: s.at ? formatDateTime(s.at) : '', status, at: s.at };
  });
  // Cancelled: one red "Job Cancelled" step right after the last completed step; the rest stay grey.
  if (cancelled) {
    const cancelledAt = job.cancelledAt ?? job.updatedAt;
    const lastDoneIndex = milestones.reduce((last, m, i) => (m.status === 'COMPLETED' ? i : last), -1);
    milestones.splice(lastDoneIndex + 1, 0, {
      key: 'JOB CANCELLED',
      title: 'Job Cancelled',
      subtitle: formatDateTime(cancelledAt),
      status: 'CANCELLED',
      at: cancelledAt,
    });
  }

  const currencyMeta = await getCurrencyMeta(pricing.currencyCode);
  const scheduledDate = booking?.scheduledDate ?? job.scheduledDate;
  const hasActiveDispute = job.disputes.length > 0;
  const hasPendingPartial = job.paymentRequests.some(
    (p) => p.type === 'PARTIAL' && p.status === 'SENT'
  );

  const confirmedPayments = job.paymentRequests
    .filter((p) => p.status === 'PAID')
    .map((p) => {
      const amt = money(p.totalAmount);
      const paidDate = p.paidAt ?? p.createdAt;
      return {
        id: p.id,
        transactionId: `TXN-${p.id.replace(/-/g, '').slice(-6).toUpperCase()}`,
        type: p.type,
        title: p.title?.trim() || p.description?.trim() || (p.type === 'PARTIAL' ? 'Installment Payment' : 'Payment'),
        description: p.description,
        amount: amt,
        currencyCode: p.currencyCode,
        currencySymbol: currencyMeta.symbol,
        formattedAmount: `${currencyMeta.symbol}${amt.toFixed(2)}`,
        status: 'CONFIRMED',
        paidAt: paidDate,
        confirmedAt: paidDate,
        confirmedDateLabel: paidDate ? `Confirmed on ${formatDisplayDay(paidDate)}` : null,
      };
    });

  const pendingPayments = job.paymentRequests
    .filter((p) => p.status === 'SENT')
    .map((p) => {
      const amt = money(p.totalAmount);
      const title = p.title?.trim() || p.description?.trim() || (p.type === 'PARTIAL' ? 'Installment Payment' : 'Payment');
      return {
        id: p.id,
        invoiceId: p.invoice?.id ?? null,
        type: p.type,
        title: `${title} Pending`,
        rawTitle: title,
        description: p.description,
        amount: amt,
        currencyCode: p.currencyCode,
        currencySymbol: currencyMeta.symbol,
        formattedAmount: `${currencyMeta.symbol}${amt.toFixed(2)}`,
        status: 'PENDING',
        dueDate: p.createdAt,
        dueDateLabel: `Due: ${formatDisplayDay(p.createdAt)}`,
        canPay: amt > 0 && Boolean(p.invoice?.id),
      };
    });

  return {
    jobId: job.id,
    jobRef: job.jobRef,
    bookingId: booking?.id ?? null,
    bookingRef: booking?.bookingRef ?? null,
    title: job.title,
    description: job.description,
    status: toDisplayStatus(
      cancelled
        ? JobStatus.CANCELLED
        : hasPendingPartial
          ? 'PARTIAL_PAYMENT'
          : finished && !paymentRequested && job.status === JobStatus.PAYMENT_PENDING
            ? 'WORK_COMPLETED'
            : job.status
    ),
    statusLabel: hasPendingPartial
      ? 'Partial Payment'
      : customerStatusBadgeFor(job.status, booking?.status ?? null, booking?.finishedAt ?? null, {
          paymentRequested,
          hasPendingPartial,
        }),
    category: job.category,
    subcategory: job.subcategory,
    ...resolveJobType(job),
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
    isPartPayment: pricing.isPartPayment,
    hasPendingPartial,
    flowType: hasPendingPartial ? 'INSTALLMENT_PAYMENT' : null,
    confirmedPayments,
    pendingPayments,
    paymentProgress: {
      confirmed: confirmedPayments,
      pending: pendingPayments,
    },
    pricing: {
      amount: pricing.amount,
      amountType: pricing.amountType,
      amountDue: pricing.amountDue,
      totalPaid: pricing.totalPaid,
      refunded: pricing.refunded,
      invoiceId: pricing.invoiceId,
      currencyCode: pricing.currencyCode,
      currencySymbol: currencyMeta.symbol,
    },
    /** Customer → trader review (your rating of the trader). */
    review: booking?.ratingReview
      ? {
          rating: booking.ratingReview.stars,
          tags: booking.ratingReview.tags ?? [],
          comment: booking.ratingReview.review,
          review: booking.ratingReview.review,
          createdAt: booking.ratingReview.createdAt,
        }
      : null,
    /** Trader → customer review (how the trader rated you). */
    traderReview: booking?.traderCustomerReview
      ? {
          rating: booking.traderCustomerReview.stars,
          tags: booking.traderCustomerReview.tags ?? [],
          comment: booking.traderCustomerReview.review,
          review: booking.traderCustomerReview.review,
          createdAt: booking.traderCustomerReview.createdAt,
        }
      : null,
    completionConfirmedAt: booking?.customerConfirmedAt ?? null,
    cancellationReason: job.cancellationReason,
    cancelledAt: cancelled ? (job.cancelledAt ?? job.updatedAt) : null,
    downloadUrl: finished && job.traderId ? `/jobs/${job.id}/invoice/download` : null,
    actions: {
      canConfirmCompletion: finished && !cancelled && !booking?.customerConfirmedAt && !hasActiveDispute,
      canCancel: !cancelled && !finished && pricing.totalPaid === 0,
      canReschedule:
        !cancelled &&
        job.status !== JobStatus.COMPLETED &&
        job.status !== JobStatus.DRAFT &&
        !booking?.arrivedAt &&
        !booking?.finishedAt,
      /** true → rate the trader via POST /jobs/{id}/review */
      canReview: finished && !cancelled && Boolean(job.trader) && !booking?.ratingReview,
      canReportIssue: Boolean(job.traderId) && !hasActiveDispute,
      hasActiveDispute,
    },
  };
};

// ---------------------------------------------------------------------------
// Reschedule
// ---------------------------------------------------------------------------

const asSiteVisitTimeSlot = (value: string): SiteVisitTimeSlot | null => {
  const key = value.trim().toUpperCase().replace(/\s+/g, '_');
  if (key === 'MORNING' || key === 'AFTERNOON' || key === 'EVENING' || key === 'ANYTIME') {
    return key;
  }
  return null;
};

export const rescheduleJob = async (
  customerId: string,
  jobId: string,
  input: RescheduleJobInput,
  actor: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER'
) => {
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
      siteVisitRequested: true,
      customer: { select: { fullName: true } },
      trader: { select: { id: true, userId: true } },
      booking: { select: { id: true, status: true, arrivedAt: true, finishedAt: true } },
      siteVisitRequests: {
        where: {
          status: {
            in: [
              TraderSiteVisitStatus.PENDING,
              TraderSiteVisitStatus.CONFIRMED,
              TraderSiteVisitStatus.RESCHEDULE_REQUIRED,
            ],
          },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          traderId: true,
          status: true,
          visitDate: true,
          timeSlot: true,
        },
      },
      _count: { select: { quotes: true } },
    },
  });
  if (!job) throw new NotFoundError('Job not found.');
  if (isJobCancelled(job)) throw new BadRequestError('Cancelled jobs cannot be rescheduled.');
  if (job.status === JobStatus.COMPLETED || job.booking?.finishedAt) {
    throw new BadRequestError('Completed jobs cannot be rescheduled.');
  }
  if (job.booking?.arrivedAt) {
    throw new BadRequestError('The trader has already started this job, so it can no longer be rescheduled.');
  }
  if (!RESCHEDULABLE_STATUSES.includes(job.status)) {
    throw new BadRequestError('This job cannot be rescheduled in its current status.');
  }

  const scheduledDate = new Date(`${input.date}T00:00:00.000Z`);
  const todayUtc = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  if (scheduledDate < todayUtc) throw new BadRequestError('Please choose today or a future date.');

  /** Reschedule = date + time only (site visit and non–site visit). Category is read-only. */
  const categoryChanged =
    (input.serviceCategoryId !== undefined && input.serviceCategoryId !== job.categoryId) ||
    (input.serviceSubcategoryId !== undefined && input.serviceSubcategoryId !== job.subcategoryId);
  if (categoryChanged) {
    throw new BadRequestError(
      'Only the date and time can be rescheduled. The service category cannot be changed.'
    );
  }

  /** Prefer assigned trader's visit; else latest open visit on the job. */
  const siteVisit =
    (job.traderId
      ? job.siteVisitRequests.find((v) => v.traderId === job.traderId)
      : null) ?? job.siteVisitRequests[0] ?? null;

  /**
   * Site-visit path: preferred date/time on job; visit → RESCHEDULE_REQUIRED (trader Jobs Queue).
   * Non–site-visit path: update job/booking date/time; notify trader JOB_RESCHEDULED.
   * Both stay on customer Active with RESCHEDULE badge.
   */
  const siteVisitReschedule =
    Boolean(siteVisit) &&
    (siteVisit!.status === TraderSiteVisitStatus.CONFIRMED ||
      siteVisit!.status === TraderSiteVisitStatus.PENDING ||
      siteVisit!.status === TraderSiteVisitStatus.RESCHEDULE_REQUIRED);

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: {
        scheduledDate,
        timeSlot: input.timeSlot,
        ...(job.status === JobStatus.ACCEPTED && job.booking && !siteVisitReschedule
          ? { status: JobStatus.SCHEDULED }
          : {}),
      },
    });
    if (job.booking) {
      await tx.booking.update({
        where: { id: job.booking.id },
        data: {
          scheduledDate,
          status: BookingStatus.RESCHEDULED,
        },
      });
    }
    if (siteVisitReschedule && siteVisit) {
      // Keep previous visitDate/timeSlot as Discover reschedule context; preferred date is on the job.
      await tx.traderSiteVisitRequest.update({
        where: { id: siteVisit.id },
        data: { status: TraderSiteVisitStatus.RESCHEDULE_REQUIRED },
      });
    }
  });

  const byLabel = actor === 'ADMIN' ? 'BRISK support' : job.customer.fullName || 'The customer';

  if (siteVisitReschedule && siteVisit) {
    const traderUserId =
      job.trader?.userId ??
      (
        await prisma.trader.findUnique({
          where: { id: siteVisit.traderId },
          select: { userId: true },
        })
      )?.userId ??
      null;
    if (traderUserId) {
      const slot = asSiteVisitTimeSlot(siteVisit.timeSlot ?? '') ?? asSiteVisitTimeSlot(input.timeSlot);
      emitSiteVisitUpdate({
        type: 'SITE_VISIT_RESCHEDULE_REQUESTED',
        recipientUserId: traderUserId,
        jobId,
        requestId: siteVisit.id,
        visitDate: siteVisit.visitDate,
        timeSlot: slot,
      });
    }
  } else {
    const recipients = actor === 'ADMIN' ? [customerId, job.trader?.userId] : [job.trader?.userId];
    await pushUserNotification(recipients, {
      type: 'JOB_RESCHEDULED',
      title: 'Job rescheduled',
      message: `${byLabel} moved "${job.title}" to ${formatDisplayDay(scheduledDate)} (${input.timeSlot}).`,
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
  const comment = input.comment?.trim() || null;
  const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const { created, avgRating, reviewsCount } = await prisma.$transaction(async (tx) => {
    const created = await tx.ratingReview.create({
      data: {
        bookingId,
        customerId,
        traderId,
        stars: input.rating,
        tags,
        review: comment,
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
    tags: created.tags,
    comment: created.review,
    /** @deprecated Use `comment`. */
    review: created.review,
    createdAt: created.createdAt,
    trader: { id: traderId, avgRating, reviewsCount },
  };
};

// ---------------------------------------------------------------------------
// Confirm completion
// ---------------------------------------------------------------------------

/** Customer confirms the finished work — signals BRISK admin that the trader payout can be released. */
export const confirmJobCompletion = async (customerId: string, jobId: string) => {
  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId },
    select: {
      id: true,
      jobRef: true,
      title: true,
      status: true,
      customer: { select: { fullName: true } },
      trader: { select: { id: true, userId: true, businessName: true } },
      booking: { select: { id: true, status: true, finishedAt: true, customerConfirmedAt: true } },
      disputes: { where: { status: { in: ACTIVE_DISPUTE_STATUSES } }, select: { id: true } },
    },
  });
  if (!job) throw new NotFoundError('Job not found.');
  if (!job.trader || !job.booking) throw new BadRequestError('This job has no booked trader.');
  if (isJobCancelled(job)) throw new BadRequestError('Cancelled jobs cannot be confirmed.');
  if (!job.booking.finishedAt && job.status !== JobStatus.COMPLETED) {
    throw new BadRequestError('You can confirm completion once the trader has finished the work.');
  }
  if (job.booking.customerConfirmedAt) throw new ConflictError('You have already confirmed this job.');
  if (job.disputes.length) {
    throw new ConflictError('You have an open issue on this job. BRISK support will resolve it before completion is confirmed.');
  }

  const confirmedAt = new Date();
  const updated = await prisma.booking.updateMany({
    where: { id: job.booking.id, customerConfirmedAt: null },
    data: { customerConfirmedAt: confirmedAt },
  });
  if (updated.count === 0) throw new ConflictError('You have already confirmed this job.');

  const data = { jobId, jobRef: job.jobRef, bookingId: job.booking.id, confirmedAt: confirmedAt.toISOString() };
  await pushUserNotification([job.trader.userId], {
    type: 'JOB_COMPLETION_CONFIRMED',
    title: 'Completion confirmed',
    message: `${job.customer.fullName || 'The customer'} confirmed "${job.title}" is complete.`,
    data,
  });
  await createAdminNotifications({
    type: 'JOB_COMPLETION_CONFIRMED',
    title: `Completion confirmed ${job.jobRef ?? ''}`.trim(),
    message: `${job.customer.fullName || 'Customer'} confirmed "${job.title}" (trader ${job.trader.businessName ?? ''}) is complete — review and release the trader payout.`,
    actionUrl: `/jobs/${jobId}`,
    payload: { ...data, traderId: job.trader.id },
  }).catch(() => undefined);

  return getJobProgress(customerId, jobId);
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

/** Report an Issue screen: reasons dropdown + latest submitted issue; app shows read-only once submitted. */
export const listJobDisputes = async (customerId: string, jobId: string) => {
  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId },
    select: { id: true, traderId: true },
  });
  if (!job) throw new NotFoundError('Job not found.');
  const rows = await prisma.jobDispute.findMany({
    where: { jobId },
    orderBy: { createdAt: 'desc' },
    include: { job: { select: { id: true, jobRef: true, title: true } } },
  });

  const disputes = rows.map(serializeDispute);
  const dispute = disputes[0] ?? null;
  const hasActiveDispute = disputes.some((d) => ACTIVE_DISPUTE_STATUSES.includes(d.status));
  const canSubmit = Boolean(job.traderId) && !hasActiveDispute;

  return {
    reasons: DISPUTE_REASONS.map((r) => ({ value: r, label: r })),
    maxEvidencePhotos: DISPUTE_MAX_EVIDENCE_PHOTOS,
    isSubmitted: Boolean(dispute),
    isEditable: !dispute && canSubmit,
    canSubmit,
    dispute,
    disputes,
  };
};
