import {
  DiscountType,
  JobStatus,
  OfferClaimStatus,
  Prisma,
  QuoteStatus,
  BookingStatus,
  InvoiceStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { prisma } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import type {
  CreateJobInput,
  PublishJobInput,
  SetJobLocationInput,
  UpdateJobInput,
} from './jobs.validation';

const money = (value: Prisma.Decimal | number | null | undefined): number =>
  value == null ? 0 : Number(value);

const round2 = (n: number) => Math.round(n * 100) / 100;

const generateJobRef = () => `JOB-${randomBytes(2).toString('hex').toUpperCase()}`;
const generateBookingRef = () => `BKG-${randomBytes(2).toString('hex').toUpperCase()}`;
const generateInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `INV-${year}-${suffix}`;
};

const formatAddressLine = (address: {
  houseNumber?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
}) =>
  [address.houseNumber, address.addressLine1, address.addressLine2]
    .filter(Boolean)
    .join(' ')
    .trim();

export const computeTraderOfferDiscount = (
  serviceCharge: number,
  discountType: DiscountType | null | undefined,
  discountValue: number
): number => {
  if (!discountType) return 0;
  let discount = 0;
  switch (discountType) {
    case DiscountType.FLAT:
      discount = discountValue;
      break;
    case DiscountType.PERCENTAGE:
      discount = (serviceCharge * discountValue) / 100;
      break;
    case DiscountType.FREE_SERVICE:
      // Free visit / free service — covers the full service charge
      discount = serviceCharge;
      break;
    default:
      discount = 0;
  }
  return round2(Math.min(Math.max(discount, 0), serviceCharge));
};

export const computeInvoiceBreakdown = (input: {
  serviceCharge: number;
  traderOfferDiscount: number;
  promoDiscount?: number;
  currencyCode?: string;
}) => {
  const serviceCharge = round2(input.serviceCharge);
  const traderOfferDiscount = round2(Math.min(input.traderOfferDiscount, serviceCharge));
  const promoDiscount = round2(input.promoDiscount ?? 0);
  const postOffer = Math.max(serviceCharge - traderOfferDiscount, 0);
  const platformFee = round2(postOffer * 0.1);
  const tax = 0;
  const totalAmount = round2(
    serviceCharge - traderOfferDiscount - promoDiscount + platformFee + tax
  );

  return {
    serviceCharge,
    traderOfferDiscount,
    promoDiscount,
    platformFee,
    tax,
    totalAmount: Math.max(totalAmount, 0),
    currencyCode: input.currencyCode ?? 'EUR',
  };
};

const jobInclude = {
  photos: { orderBy: { createdAt: 'asc' as const } },
  offer: {
    select: {
      id: true,
      offerCode: true,
      title: true,
      discountType: true,
      discountValue: true,
      discountLabel: true,
      currencyCode: true,
      offerType: true,
      traderId: true,
      bannerImageUrl: true,
    },
  },
  address: true,
  category: { select: { id: true, name: true } },
  subcategory: { select: { id: true, name: true } },
  trader: {
    select: {
      id: true,
      businessName: true,
      traderType: true,
      avgRating: true,
      topRated: true,
      verificationStatus: true,
      profilePhotoUrl: true,
      yearsExperience: true,
      city: true,
      country: true,
      user: { select: { fullName: true, profilePhotoUrl: true } },
    },
  },
  booking: {
    select: {
      id: true,
      bookingRef: true,
      status: true,
      scheduledDate: true,
      invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
    },
  },
  claim: { select: { id: true, status: true, claimedAt: true } },
} satisfies Prisma.JobInclude;

const serializeJob = (
  job: Prisma.JobGetPayload<{ include: typeof jobInclude }>
) => {
  const offerApplied = Boolean(job.offer);
  const traderDisplayName =
    job.trader?.businessName || job.trader?.user?.fullName || null;

  return {
    id: job.id,
    jobRef: job.jobRef,
    customerId: job.customerId,
    categoryId: job.categoryId,
    subcategoryId: job.subcategoryId,
    offerId: job.offerId,
    /** Alias used by Post a New Job / claim flow. */
    appliedTraderOfferId: job.offerId,
    claimId: job.claimId,
    traderId: job.traderId,
    title: job.title,
    description: job.description,
    addressId: job.addressId,
    addressLine: job.addressLine,
    city: job.city,
    postcode: job.postcode,
    latitude: job.latitude,
    longitude: job.longitude,
    timeSlot: job.timeSlot,
    durationLabel: job.durationLabel,
    phoneNumber: job.phoneNumber,
    serviceCharge: job.serviceCharge != null ? money(job.serviceCharge) : null,
    status: job.status,
    scheduledDate: job.scheduledDate,
    qaFormAnswers: job.qaFormAnswers,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    photos: job.photos.map((p) => ({ id: p.id, photoUrl: p.photoUrl, createdAt: p.createdAt })),
    coverPhotoUrl: job.photos[0]?.photoUrl ?? null,
    category: job.category,
    subcategory: job.subcategory,
    /** True when an offer banner should show on job screens. */
    offerApplied,
    offer: job.offer
      ? {
          id: job.offer.id,
          offerCode: job.offer.offerCode,
          title: job.offer.title,
          discountType: job.offer.discountType,
          discountValue: money(job.offer.discountValue),
          discountLabel: job.offer.discountLabel,
          currencyCode: job.offer.currencyCode,
          offerType: job.offer.offerType,
          traderId: job.offer.traderId,
          bannerImageUrl: job.offer.bannerImageUrl,
          /** Banner fields for "Offer Applied" chip on job form. */
          bannerTitle: job.offer.title,
          bannerSubtitle: job.offer.discountLabel,
        }
      : null,
    address: job.address
      ? {
          id: job.address.id,
          label: job.address.label ?? job.address.addressType,
          addressType: job.address.addressType,
          houseNumber: job.address.houseNumber,
          addressLine1: job.address.addressLine1,
          addressLine2: job.address.addressLine2,
          city: job.address.city,
          county: job.address.county,
          eircode: job.address.eircode,
          country: job.address.country,
          latitude: job.address.latitude,
          longitude: job.address.longitude,
          isDefault: job.address.isDefault,
        }
      : null,
    trader: job.trader
      ? {
          id: job.trader.id,
          businessName: job.trader.businessName,
          fullName: job.trader.user?.fullName ?? null,
          displayName: traderDisplayName,
          traderType: job.trader.traderType,
          avgRating: Number(job.trader.avgRating),
          topRated: job.trader.topRated,
          yearsExperience: job.trader.yearsExperience ?? 0,
          experienceLabel:
            (job.trader.yearsExperience ?? 0) > 0
              ? `${job.trader.yearsExperience}+ Yrs`
              : null,
          city: job.trader.city ?? null,
          country: job.trader.country ?? null,
          location:
            [job.trader.city, job.trader.country].filter(Boolean).join(', ') || null,
          profilePhotoUrl:
            job.trader.profilePhotoUrl ?? job.trader.user?.profilePhotoUrl ?? null,
        }
      : null,
    claim: job.claim,
    bookingId: job.booking?.id ?? null,
    invoiceId: job.booking?.invoice?.id ?? null,
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
                totalAmount: money(job.booking.invoice.totalAmount),
              }
            : null,
        }
      : null,
    /** Next-step hints for the mobile wizard. */
    nextSteps: {
      needsLocation: !job.addressId,
      canPublish: Boolean(job.addressId) && job.status === JobStatus.DRAFT,
      canPay: Boolean(job.booking?.invoice?.id),
      invoiceId: job.booking?.invoice?.id ?? null,
      bookingId: job.booking?.id ?? null,
    },
  };
};

const getOwnedJob = async (customerId: string, jobId: string) => {
  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId },
    include: jobInclude,
  });
  if (!job) throw new NotFoundError('Job not found.');
  return job;
};

const assertDraft = (status: JobStatus) => {
  if (status !== JobStatus.DRAFT) {
    throw new BadRequestError('Only draft jobs can be updated.');
  }
};

export const createJob = async (customerId: string, input: CreateJobInput) => {
  const offerId = input.offerId ?? input.appliedTraderOfferId ?? null;
  let traderId = input.traderId ?? null;
  let claimId = input.claimId ?? null;
  let resolvedOffer: {
    id: string;
    traderId: string | null;
    title: string;
    discountType: DiscountType;
    discountValue: Prisma.Decimal;
    currencyCode: string;
  } | null = null;

  if (offerId) {
    const offer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) throw new NotFoundError('Offer not found.');
    resolvedOffer = offer;
    traderId = offer.traderId ?? traderId;

    if (!claimId) {
      const claim = await prisma.offerClaim.findUnique({
        where: { offerId_userId: { offerId, userId: customerId } },
      });
      if (claim && claim.status === OfferClaimStatus.CLAIMED) {
        claimId = claim.id;
      }
    }
  }

  if (claimId) {
    const claim = await prisma.offerClaim.findFirst({
      where: { id: claimId, userId: customerId },
    });
    if (!claim) throw new NotFoundError('Offer claim not found.');
    if (claim.status !== OfferClaimStatus.CLAIMED) {
      throw new BadRequestError('This offer claim is not available to use.');
    }
    if (offerId && claim.offerId !== offerId) {
      throw new BadRequestError('Claim does not belong to the selected offer.');
    }
  }

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new NotFoundError('Category not found.');

  if (input.subcategoryId) {
    const subcategory = await prisma.subcategory.findFirst({
      where: { id: input.subcategoryId, categoryId: input.categoryId },
    });
    if (!subcategory) throw new BadRequestError('Subcategory does not belong to the category.');
  }

  if (traderId) {
    const trader = await prisma.trader.findUnique({ where: { id: traderId } });
    if (!trader) throw new NotFoundError('Trader not found.');
  }

  const title =
    input.title?.trim() ||
    resolvedOffer?.title ||
    category.name;

  let jobRef = generateJobRef();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.job.findUnique({ where: { jobRef } });
    if (!exists) break;
    jobRef = generateJobRef();
  }

  const created = await prisma.$transaction(
    async (tx) => {
      const job = await tx.job.create({
        data: {
          jobRef,
          customerId,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId ?? undefined,
          offerId: offerId ?? undefined,
          claimId: claimId ?? undefined,
          traderId: traderId ?? undefined,
          title,
          description: input.description,
          scheduledDate: input.scheduledDate,
          timeSlot: input.timeSlot,
          durationLabel: input.durationLabel,
          phoneNumber: input.phoneNumber,
          serviceCharge: input.serviceCharge,
          qaFormAnswers: input.qaFormAnswers as Prisma.InputJsonValue | undefined,
          status: JobStatus.DRAFT,
          photos: input.photoUrls?.length
            ? {
                create: input.photoUrls.map((photoUrl) => ({ photoUrl })),
              }
            : undefined,
        },
      });

      if (claimId) {
        await tx.offerClaim.update({
          where: { id: claimId },
          data: { jobId: job.id },
        });
      }

      return job;
    },
    { timeout: 20000 }
  );

  return getJob(customerId, created.id);
};

export const listJobs = async (customerId: string, status?: JobStatus) => {
  const jobs = await prisma.job.findMany({
    where: {
      customerId,
      ...(status ? { status } : {}),
    },
    include: jobInclude,
    orderBy: { createdAt: 'desc' },
  });
  return { jobs: jobs.map(serializeJob) };
};

export const getJob = async (customerId: string, jobId: string) => {
  const job = await getOwnedJob(customerId, jobId);
  return serializeJob(job);
};

export const updateJob = async (customerId: string, jobId: string, input: UpdateJobInput) => {
  const existing = await getOwnedJob(customerId, jobId);
  assertDraft(existing.status);

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundError('Category not found.');
  }

  const categoryId = input.categoryId ?? existing.categoryId;
  if (input.subcategoryId) {
    const subcategory = await prisma.subcategory.findFirst({
      where: { id: input.subcategoryId, categoryId },
    });
    if (!subcategory) throw new BadRequestError('Subcategory does not belong to the category.');
  }

  if (input.traderId) {
    const trader = await prisma.trader.findUnique({ where: { id: input.traderId } });
    if (!trader) throw new NotFoundError('Trader not found.');
  }

  const job = await prisma.$transaction(async (tx) => {
    if (input.photoUrls) {
      await tx.jobPhoto.deleteMany({ where: { jobId } });
      if (input.photoUrls.length) {
        await tx.jobPhoto.createMany({
          data: input.photoUrls.map((photoUrl) => ({ jobId, photoUrl })),
        });
      }
    }

    return tx.job.update({
      where: { id: jobId },
      data: {
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId === undefined ? undefined : input.subcategoryId,
        title: input.title,
        description: input.description,
        scheduledDate: input.scheduledDate === undefined ? undefined : input.scheduledDate,
        timeSlot: input.timeSlot === undefined ? undefined : input.timeSlot,
        durationLabel: input.durationLabel === undefined ? undefined : input.durationLabel,
        phoneNumber: input.phoneNumber === undefined ? undefined : input.phoneNumber,
        serviceCharge: input.serviceCharge === undefined ? undefined : input.serviceCharge,
        traderId: input.traderId === undefined ? undefined : input.traderId,
        qaFormAnswers:
          input.qaFormAnswers === undefined
            ? undefined
            : (input.qaFormAnswers as Prisma.InputJsonValue | typeof Prisma.JsonNull),
      },
      include: jobInclude,
    });
  });

  return serializeJob(job);
};

export const setJobLocation = async (
  customerId: string,
  jobId: string,
  input: SetJobLocationInput
) => {
  const existing = await getOwnedJob(customerId, jobId);
  assertDraft(existing.status);

  const address = await prisma.address.findFirst({
    where: { id: input.addressId, userId: customerId },
  });
  if (!address) throw new NotFoundError('Address not found.');

  const job = await prisma.job.update({
    where: { id: jobId },
    data: {
      addressId: address.id,
      addressLine: formatAddressLine(address),
      city: address.city,
      postcode: address.eircode,
      latitude: address.latitude,
      longitude: address.longitude,
    },
    include: jobInclude,
  });

  return serializeJob(job);
};

export const publishJob = async (
  customerId: string,
  jobId: string,
  input: PublishJobInput
) => {
  const existing = await getOwnedJob(customerId, jobId);
  if (existing.status !== JobStatus.DRAFT) {
    throw new BadRequestError('Only draft jobs can be published.');
  }

  let addressId = input.addressId ?? existing.addressId;
  if (input.addressId) {
    const address = await prisma.address.findFirst({
      where: { id: input.addressId, userId: customerId },
    });
    if (!address) throw new NotFoundError('Address not found.');
    addressId = address.id;
  }

  if (!addressId) {
    throw new BadRequestError('Address is required to publish a job.');
  }

  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: customerId },
  });
  if (!address) throw new NotFoundError('Address not found.');

  const traderId = existing.traderId;
  const serviceChargeRaw =
    input.serviceCharge ??
    (existing.serviceCharge != null ? money(existing.serviceCharge) : null);

  if (traderId && (serviceChargeRaw == null || Number.isNaN(serviceChargeRaw))) {
    throw new BadRequestError('Service charge is required for Direct Trader jobs.');
  }

  const result = await prisma.$transaction(
    async (tx) => {
    const job = await tx.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.PUBLISHED,
        addressId: address.id,
        addressLine: formatAddressLine(address),
        city: address.city,
        postcode: address.eircode,
        latitude: address.latitude,
        longitude: address.longitude,
        ...(serviceChargeRaw != null ? { serviceCharge: serviceChargeRaw } : {}),
      },
      include: jobInclude,
    });

    let booking = null;
    let invoice = null;

    if (traderId && serviceChargeRaw != null) {
      const offer = job.offerId
        ? await tx.offer.findUnique({ where: { id: job.offerId } })
        : null;

      const traderOfferDiscount = computeTraderOfferDiscount(
        serviceChargeRaw,
        offer?.discountType,
        offer ? money(offer.discountValue) : 0
      );
      const breakdown = computeInvoiceBreakdown({
        serviceCharge: serviceChargeRaw,
        traderOfferDiscount,
        promoDiscount: 0,
        currencyCode: offer?.currencyCode ?? 'EUR',
      });

      await tx.quote.create({
        data: {
          jobId: job.id,
          traderId,
          quotedAmount: breakdown.serviceCharge,
          currencyCode: breakdown.currencyCode,
          status: QuoteStatus.ACCEPTED,
          notes: 'Direct Trader offer — auto-accepted on publish.',
        },
      });

      const scheduledDate = job.scheduledDate ?? new Date();
      const createdBooking = await tx.booking.create({
        data: {
          bookingRef: generateBookingRef(),
          jobId: job.id,
          traderId,
          customerId,
          scheduledDate,
          status: BookingStatus.SCHEDULED,
        },
      });

      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNumber: generateInvoiceNumber(),
          bookingId: createdBooking.id,
          serviceCharge: breakdown.serviceCharge,
          traderOfferDiscount: breakdown.traderOfferDiscount,
          promoDiscount: breakdown.promoDiscount,
          platformFee: breakdown.platformFee,
          tax: breakdown.tax,
          totalAmount: breakdown.totalAmount,
          currencyCode: breakdown.currencyCode,
          status: InvoiceStatus.UNPAID,
        },
      });

      await tx.job.update({
        where: { id: job.id },
        data: { status: JobStatus.SCHEDULED },
      });

      if (job.claimId) {
        await tx.offerClaim.update({
          where: { id: job.claimId },
          data: {
            status: OfferClaimStatus.USED,
            usedAt: new Date(),
            jobId: job.id,
          },
        });
      }

      booking = {
        id: createdBooking.id,
        bookingRef: createdBooking.bookingRef,
        status: createdBooking.status,
        scheduledDate: createdBooking.scheduledDate,
        traderId: createdBooking.traderId,
        jobId: createdBooking.jobId,
      };

      invoice = {
        id: createdInvoice.id,
        invoiceNumber: createdInvoice.invoiceNumber,
        bookingId: createdInvoice.bookingId,
        status: createdInvoice.status,
        ...breakdown,
      };
    }

    const refreshed = await tx.job.findUniqueOrThrow({
      where: { id: job.id },
      include: jobInclude,
    });

    return {
      job: serializeJob(refreshed),
      booking,
      invoiceId: invoice?.id ?? null,
      invoice,
    };
  },
    { timeout: 30000 }
  );

  // Reload full invoice payload (lineItems, payNowLabel, serviceSummary) for Payment Details UI.
  if (result.invoiceId) {
    const { getInvoice } = await import('../checkout/checkout.service');
    const fullInvoice = await getInvoice(customerId, result.invoiceId);
    return {
      job: result.job,
      booking: result.booking,
      invoice: fullInvoice,
    };
  }

  return {
    job: result.job,
    booking: result.booking,
    invoice: null,
  };
};
