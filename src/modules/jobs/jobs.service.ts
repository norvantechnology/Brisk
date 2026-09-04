import {
  DiscountType,
  JobQuoteType,
  JobStatus,
  OfferClaimStatus,
  OfferStatus,
  Prisma,
  QuoteStatus,
  BookingStatus,
  InvoiceStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import {
  buildJobFormConfig,
  buildNextJobPrefill,
  buildOfferAppliedBanner,
  resolveQuoteTypeForCreate,
  resolveSiteVisitFee,
  str,
} from './jobs.form-config';
import type {
  CreateJobInput,
  PublishJobInput,
  SetJobLocationInput,
  UpdateJobInput,
} from './jobs.validation';
import type { JobFormEntryPoint } from './jobs.form-config';

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
  /** Site visit fee invoices: no platform fee markup (Figma Pay Fee = flat fee). */
  purpose?: 'SERVICE' | 'SITE_VISIT_FEE';
}) => {
  const serviceCharge = round2(input.serviceCharge);
  const traderOfferDiscount = round2(Math.min(input.traderOfferDiscount, serviceCharge));
  const promoDiscount = round2(input.promoDiscount ?? 0);
  const postOffer = Math.max(serviceCharge - traderOfferDiscount, 0);
  const platformFee =
    input.purpose === 'SITE_VISIT_FEE' ? 0 : round2(postOffer * 0.1);
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
    purpose: input.purpose ?? 'SERVICE',
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
  subcategory: {
    select: {
      id: true,
      name: true,
      siteVisitEnabled: true,
      siteVisitFee: true,
      priceEnabled: true,
      priceEnteredBy: true,
      qaFormSchema: true,
    },
  },
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
    jobRef: str(job.jobRef),
    customerId: job.customerId,
    categoryId: job.categoryId,
    subcategoryId: str(job.subcategoryId),
    offerId: str(job.offerId),
    appliedTraderOfferId: str(job.offerId),
    claimId: str(job.claimId),
    traderId: str(job.traderId),
    title: str(job.title),
    description: str(job.description),
    addressId: str(job.addressId),
    addressLine: str(job.addressLine),
    city: str(job.city),
    postcode: str(job.postcode),
    latitude: job.latitude ?? 0,
    longitude: job.longitude ?? 0,
    timeSlot: str(job.timeSlot),
    durationLabel: str(job.durationLabel),
    phoneNumber: str(job.phoneNumber),
    serviceCharge: job.serviceCharge != null ? money(job.serviceCharge) : 0,
    quoteType: job.quoteType ?? JobQuoteType.REMOTE,
    minBudget: job.minBudget != null ? money(job.minBudget) : 0,
    maxBudget: job.maxBudget != null ? money(job.maxBudget) : 0,
    siteVisitRequested: job.siteVisitRequested,
    siteVisitFee: job.siteVisitFee != null ? money(job.siteVisitFee) : 0,
    status: job.status,
    scheduledDate: job.scheduledDate ? job.scheduledDate.toISOString() : '',
    qaFormAnswers: job.qaFormAnswers ?? {},
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    photos: job.photos.map((p) => ({ id: p.id, photoUrl: p.photoUrl, createdAt: p.createdAt })),
    coverPhotoUrl: str(job.photos[0]?.photoUrl),
    category: job.category ?? { id: '', name: '' },
    subcategory: job.subcategory
      ? {
          id: job.subcategory.id,
          name: job.subcategory.name,
          siteVisitEnabled: job.subcategory.siteVisitEnabled,
          siteVisitFee:
            job.subcategory.siteVisitFee != null
              ? money(job.subcategory.siteVisitFee)
              : 0,
          priceEnabled: job.subcategory.priceEnabled,
          priceEnteredBy: job.subcategory.priceEnteredBy,
          qaFormSchema: job.subcategory.qaFormSchema ?? [],
        }
      : {
          id: '',
          name: '',
          siteVisitEnabled: false,
          siteVisitFee: 0,
          priceEnabled: true,
          priceEnteredBy: 'CUSTOMER',
          qaFormSchema: [],
        },
    offerApplied,
    formConfig: buildJobFormConfig({
      offerApplied,
      subcategory: job.subcategory,
      entryPoint: offerApplied ? 'OFFER' : 'DIRECT',
      currencyCode: job.offer?.currencyCode,
      offerBanner: job.offer
        ? buildOfferAppliedBanner({
            discountType: job.offer.discountType,
            discountValue: money(job.offer.discountValue),
            discountLabel: job.offer.discountLabel,
            currencyCode: job.offer.currencyCode,
          })
        : null,
    }),
    offer: job.offer
      ? (() => {
          const banner = buildOfferAppliedBanner({
            discountType: job.offer.discountType,
            discountValue: money(job.offer.discountValue),
            discountLabel: job.offer.discountLabel,
            currencyCode: job.offer.currencyCode,
          });
          return {
            id: job.offer.id,
            offerCode: str(job.offer.offerCode),
            title: str(job.offer.title),
            discountType: job.offer.discountType,
            discountValue: money(job.offer.discountValue),
            discountLabel: str(job.offer.discountLabel),
            currencyCode: str(job.offer.currencyCode) || 'EUR',
            offerType: job.offer.offerType,
            traderId: str(job.offer.traderId),
            bannerImageUrl: str(job.offer.bannerImageUrl),
            bannerTitle: banner.title,
            bannerSubtitle: banner.discountLabel,
            bannerMessage: banner.message,
            offerBanner: banner,
          };
        })()
      : {
          id: '',
          offerCode: '',
          title: '',
          discountType: '',
          discountValue: 0,
          discountLabel: '',
          currencyCode: 'EUR',
          offerType: '',
          traderId: '',
          bannerImageUrl: '',
          bannerTitle: '',
          bannerSubtitle: '',
          bannerMessage: '',
          offerBanner: { title: '', message: '', discountLabel: '' },
        },
    address: job.address
      ? {
          id: job.address.id,
          label: str(job.address.label ?? job.address.addressType),
          addressType: str(job.address.addressType),
          houseNumber: str(job.address.houseNumber),
          addressLine1: str(job.address.addressLine1),
          addressLine2: str(job.address.addressLine2),
          city: str(job.address.city),
          county: str(job.address.county),
          eircode: str(job.address.eircode),
          country: str(job.address.country),
          latitude: job.address.latitude ?? 0,
          longitude: job.address.longitude ?? 0,
          isDefault: job.address.isDefault,
        }
      : {
          id: '',
          label: '',
          addressType: '',
          houseNumber: '',
          addressLine1: '',
          addressLine2: '',
          city: '',
          county: '',
          eircode: '',
          country: '',
          latitude: 0,
          longitude: 0,
          isDefault: false,
        },
    trader: job.trader
      ? {
          id: job.trader.id,
          businessName: str(job.trader.businessName),
          fullName: str(job.trader.user?.fullName),
          displayName: str(traderDisplayName),
          traderType: str(job.trader.traderType),
          avgRating: Number(job.trader.avgRating),
          topRated: job.trader.topRated,
          yearsExperience: job.trader.yearsExperience ?? 0,
          experienceLabel:
            (job.trader.yearsExperience ?? 0) > 0
              ? `${job.trader.yearsExperience}+ Yrs`
              : '',
          city: str(job.trader.city),
          country: str(job.trader.country),
          location:
            [job.trader.city, job.trader.country].filter(Boolean).join(', ') || '',
          profilePhotoUrl: str(
            job.trader.profilePhotoUrl ?? job.trader.user?.profilePhotoUrl
          ),
        }
      : {
          id: '',
          businessName: '',
          fullName: '',
          displayName: '',
          traderType: '',
          avgRating: 0,
          topRated: false,
          yearsExperience: 0,
          experienceLabel: '',
          city: '',
          country: '',
          location: '',
          profilePhotoUrl: '',
        },
    claim: job.claim
      ? {
          id: job.claim.id,
          status: job.claim.status,
          claimedAt: job.claim.claimedAt ? job.claim.claimedAt.toISOString() : '',
        }
      : { id: '', status: '', claimedAt: '' },
    bookingId: str(job.booking?.id),
    invoiceId: str(job.booking?.invoice?.id),
    booking: job.booking
      ? {
          id: job.booking.id,
          bookingRef: str(job.booking.bookingRef),
          status: job.booking.status,
          scheduledDate: job.booking.scheduledDate
            ? job.booking.scheduledDate.toISOString()
            : '',
          invoice: job.booking.invoice
            ? {
                id: job.booking.invoice.id,
                invoiceNumber: str(job.booking.invoice.invoiceNumber),
                status: job.booking.invoice.status,
                totalAmount: money(job.booking.invoice.totalAmount),
              }
            : { id: '', invoiceNumber: '', status: '', totalAmount: 0 },
        }
      : {
          id: '',
          bookingRef: '',
          status: '',
          scheduledDate: '',
          invoice: { id: '', invoiceNumber: '', status: '', totalAmount: 0 },
        },
    nextSteps: {
      needsLocation: !job.addressId,
      canPublish: Boolean(job.addressId) && job.status === JobStatus.DRAFT,
      canPay: Boolean(job.booking?.invoice?.id),
      invoiceId: str(job.booking?.invoice?.id),
      bookingId: str(job.booking?.id),
      publishCtaLabel: '',
      chooseLocationCtaLabel: '',
      nextAfterLocation:
        offerApplied ||
        job.quoteType === JobQuoteType.ONSITE ||
        job.siteVisitRequested
          ? 'SITE_VISIT_PAY_FEE'
          : 'WAITING_FOR_QUOTES',
      paymentScreen:
        job.quoteType === JobQuoteType.ONSITE || job.siteVisitRequested
          ? 'SITE_VISIT_PAY_FEE'
          : 'PAYMENT_DETAILS',
      nextScreen: !job.addressId
        ? 'CHOOSE_LOCATION'
        : job.booking?.invoice?.id
          ? job.quoteType === JobQuoteType.ONSITE || job.siteVisitRequested
            ? 'SITE_VISIT_PAY_FEE'
            : 'PAYMENT_DETAILS'
          : job.status === JobStatus.DRAFT
            ? 'PUBLISH'
            : '',
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
    if (offer.status !== OfferStatus.ACTIVE) {
      throw new BadRequestError('This offer is not active.');
    }
    const now = new Date();
    if (offer.validFrom > now || offer.validUntil < now) {
      throw new BadRequestError('This offer is not currently valid.');
    }
    resolvedOffer = offer;
    traderId = offer.traderId ?? traderId;

    // Soft-link offerId only. Claim is created as USED on Payment Successful — not here.
    // Ignore client claimId for trader flow (no separate claim API).
    const existingClaim = await prisma.offerClaim.findUnique({
      where: { offerId_userId: { offerId, userId: customerId } },
    });
    if (existingClaim?.status === OfferClaimStatus.USED) {
      throw new ConflictError('You have already used this offer.');
    }
    claimId = null;
  }

  if (claimId && !offerId) {
    const claim = await prisma.offerClaim.findFirst({
      where: { id: claimId, userId: customerId },
      include: { offer: true },
    });
    if (!claim) throw new NotFoundError('Offer claim not found.');
    if (claim.status === OfferClaimStatus.USED) {
      throw new BadRequestError('This offer has already been used.');
    }
  }

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new NotFoundError('Category not found.');

  let subcategoryFlags = null;
  if (input.subcategoryId) {
    const subcategory = await prisma.subcategory.findFirst({
      where: { id: input.subcategoryId, categoryId: input.categoryId },
    });
    if (!subcategory) throw new BadRequestError('Subcategory does not belong to the category.');
    subcategoryFlags = subcategory;
  }

  if (traderId) {
    const trader = await prisma.trader.findUnique({ where: { id: traderId } });
    if (!trader) throw new NotFoundError('Trader not found.');
  }

  const offerApplied = Boolean(offerId);
  const formConfig = buildJobFormConfig({
    offerApplied,
    subcategory: subcategoryFlags
      ? {
          ...subcategoryFlags,
          siteVisitFee:
            subcategoryFlags.siteVisitFee != null
              ? money(subcategoryFlags.siteVisitFee)
              : null,
        }
      : null,
    entryPoint: offerApplied ? 'OFFER' : 'DIRECT',
  });
  const quoteType = resolveQuoteTypeForCreate({
    quoteType: input.quoteType,
    formDefault: formConfig.defaultQuoteType,
  });
  const siteVisitRequested =
    input.siteVisitRequested ?? quoteType === JobQuoteType.ONSITE;
  const siteVisitFee =
    siteVisitRequested || quoteType === JobQuoteType.ONSITE
      ? resolveSiteVisitFee(
          subcategoryFlags
            ? {
                siteVisitEnabled: subcategoryFlags.siteVisitEnabled,
                siteVisitFee:
                  subcategoryFlags.siteVisitFee != null
                    ? money(subcategoryFlags.siteVisitFee)
                    : null,
                priceEnabled: subcategoryFlags.priceEnabled,
                priceEnteredBy: subcategoryFlags.priceEnteredBy,
              }
            : { siteVisitEnabled: true, priceEnabled: true, priceEnteredBy: 'CUSTOMER' }
        )
      : null;

  if (
    input.minBudget != null &&
    input.maxBudget != null &&
    input.maxBudget < input.minBudget
  ) {
    throw new BadRequestError('maxBudget must be greater than or equal to minBudget.');
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
          quoteType,
          minBudget: input.minBudget ?? undefined,
          maxBudget: input.maxBudget ?? undefined,
          siteVisitRequested,
          siteVisitFee: siteVisitFee ?? undefined,
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
        quoteType: input.quoteType === undefined ? undefined : input.quoteType,
        minBudget: input.minBudget === undefined ? undefined : input.minBudget,
        maxBudget: input.maxBudget === undefined ? undefined : input.maxBudget,
        siteVisitRequested:
          input.siteVisitRequested === undefined ? undefined : input.siteVisitRequested,
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
  const isSiteVisit =
    existing.quoteType === JobQuoteType.ONSITE || existing.siteVisitRequested;

  const siteVisitFeeRaw =
    existing.siteVisitFee != null
      ? money(existing.siteVisitFee)
      : resolveSiteVisitFee(
          existing.subcategory
            ? {
                siteVisitEnabled: existing.subcategory.siteVisitEnabled,
                siteVisitFee:
                  existing.subcategory.siteVisitFee != null
                    ? money(existing.subcategory.siteVisitFee)
                    : null,
                priceEnabled: existing.subcategory.priceEnabled,
                priceEnteredBy: existing.subcategory.priceEnteredBy,
              }
            : null
        );

  const serviceChargeRaw = isSiteVisit
    ? siteVisitFeeRaw
    : input.serviceCharge ??
      (existing.serviceCharge != null ? money(existing.serviceCharge) : null) ??
      (existing.maxBudget != null ? money(existing.maxBudget) : null);

  if (isSiteVisit && !traderId) {
    throw new BadRequestError(
      'A trader is required to publish a Site Visit job (from offer or trader selection).'
    );
  }

  if (traderId && (serviceChargeRaw == null || Number.isNaN(serviceChargeRaw))) {
    throw new BadRequestError(
      isSiteVisit
        ? 'Site visit fee is required to publish.'
        : 'Service charge (or maxBudget) is required for Direct Trader jobs.'
    );
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
        ...(isSiteVisit
          ? {
              siteVisitFee: siteVisitFeeRaw,
              siteVisitRequested: true,
              serviceCharge: siteVisitFeeRaw,
            }
          : serviceChargeRaw != null
            ? { serviceCharge: serviceChargeRaw }
            : {}),
      },
      include: jobInclude,
    });

    let booking = null;
    let invoice = null;

    // Soft-link offerId only. Do NOT claim here — claim → USED on payment confirm
    // (or immediately below when this publish has no invoice / no pay step).
    if (job.offerId) {
      const existingClaim = await tx.offerClaim.findUnique({
        where: { offerId_userId: { offerId: job.offerId, userId: customerId } },
      });
      if (existingClaim?.status === OfferClaimStatus.USED) {
        throw new ConflictError('You have already used this offer.');
      }
    }

    if (traderId && serviceChargeRaw != null) {
      const offer = job.offerId
        ? await tx.offer.findUnique({ where: { id: job.offerId } })
        : null;

      /**
       * Site Visit Pay Fee: charge flat visit fee. Job offer (€5 etc.) applies to
       * the eventual service — not this facilitation fee (matches Figma).
       * FREE_SERVICE (free visit) still zeros the visit fee.
       */
      const traderOfferDiscount = isSiteVisit
        ? offer?.discountType === DiscountType.FREE_SERVICE
          ? serviceChargeRaw
          : 0
        : computeTraderOfferDiscount(
            serviceChargeRaw,
            offer?.discountType,
            offer ? money(offer.discountValue) : 0
          );

      const breakdown = computeInvoiceBreakdown({
        serviceCharge: serviceChargeRaw,
        traderOfferDiscount,
        promoDiscount: 0,
        currencyCode: offer?.currencyCode ?? 'EUR',
        purpose: isSiteVisit ? 'SITE_VISIT_FEE' : 'SERVICE',
      });

      await tx.quote.create({
        data: {
          jobId: job.id,
          traderId,
          quotedAmount: breakdown.serviceCharge,
          currencyCode: breakdown.currencyCode,
          status: QuoteStatus.ACCEPTED,
          notes: isSiteVisit
            ? 'Site visit fee — auto-accepted on publish.'
            : 'Direct Trader offer — auto-accepted on publish.',
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

      // Claim stays unset until Payment Successful (confirmPayment).

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
        purpose: isSiteVisit ? 'SITE_VISIT_FEE' : 'SERVICE',
      };
    } else if (job.offerId) {
      // No payment step (e.g. waiting for quotes) — claim offer as USED when job goes live.
      const existingClaim = await tx.offerClaim.findUnique({
        where: { offerId_userId: { offerId: job.offerId, userId: customerId } },
      });
      if (existingClaim?.status === OfferClaimStatus.USED) {
        throw new ConflictError('You have already used this offer.');
      }
      const claimId = existingClaim
        ? (
            await tx.offerClaim.update({
              where: { id: existingClaim.id },
              data: {
                status: OfferClaimStatus.USED,
                usedAt: new Date(),
                claimedAt: existingClaim.claimedAt ?? new Date(),
                jobId: job.id,
              },
            })
          ).id
        : (
            await tx.offerClaim.create({
              data: {
                offerId: job.offerId,
                userId: customerId,
                status: OfferClaimStatus.USED,
                claimedAt: new Date(),
                usedAt: new Date(),
                jobId: job.id,
              },
            })
          ).id;
      if (!existingClaim) {
        await tx.offer.update({
          where: { id: job.offerId },
          data: { claimsCount: { increment: 1 } },
        });
      }
      await tx.job.update({
        where: { id: job.id },
        data: { claimId },
      });
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
      booking: result.booking ?? {
        id: '',
        bookingRef: '',
        status: '',
        scheduledDate: '',
        traderId: '',
        jobId: '',
      },
      invoiceId: result.invoiceId,
      invoice: fullInvoice,
    };
  }

  return {
    job: result.job,
    booking: result.booking ?? {
      id: '',
      bookingRef: '',
      status: '',
      scheduledDate: '',
      traderId: '',
      jobId: '',
    },
    invoiceId: '',
    invoice: {
      id: '',
      invoiceNumber: '',
      bookingId: '',
      status: '',
      purpose: '',
      totalAmount: 0,
      siteVisitFee: 0,
      screenTitle: '',
      confirmPayLabel: '',
      payNowLabel: '',
      feeNote: '',
    },
  };
};

/**
 * Unified Post a New Job form config for every entry point
 * (home category, offer accept, trader profile).
 */
export const getJobFormConfig = async (
  customerId: string,
  query: {
    categoryId?: string;
    subcategoryId?: string;
    offerId?: string;
    entryPoint?: JobFormEntryPoint;
  }
) => {
  let offerApplied = false;
  let categoryId = query.categoryId ?? null;
  let subcategoryId = query.subcategoryId ?? null;
  let traderId: string | null = null;
  let offerMeta: {
    id: string;
    title: string;
    discountLabel: string | null;
    bannerImageUrl: string | null;
    discountType: DiscountType;
    discountValue: number;
    currencyCode: string;
  } | null = null;

  if (query.offerId) {
    const offer = await prisma.offer.findUnique({
      where: { id: query.offerId },
      include: {
        categories: { select: { categoryId: true }, take: 1 },
        subcategories: { select: { subcategoryId: true }, take: 1 },
      },
    });
    if (!offer) throw new NotFoundError('Offer not found.');

    const claim = await prisma.offerClaim.findUnique({
      where: { offerId_userId: { offerId: offer.id, userId: customerId } },
    });
    if (claim?.status === OfferClaimStatus.USED) {
      throw new ConflictError('You have already used this offer.');
    }

    offerApplied = true;
    traderId = offer.traderId;
    categoryId = categoryId ?? offer.categories[0]?.categoryId ?? null;
    subcategoryId = subcategoryId ?? offer.subcategories[0]?.subcategoryId ?? null;
    offerMeta = {
      id: offer.id,
      title: offer.title,
      discountLabel: offer.discountLabel,
      bannerImageUrl: offer.bannerImageUrl,
      discountType: offer.discountType,
      discountValue: money(offer.discountValue),
      currencyCode: offer.currencyCode,
    };
  }

  let subcategoryFlags = null;
  if (subcategoryId) {
    const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
    if (!subcategory) throw new NotFoundError('Subcategory not found.');
    if (categoryId && subcategory.categoryId !== categoryId) {
      throw new BadRequestError('Subcategory does not belong to the category.');
    }
    categoryId = categoryId ?? subcategory.categoryId;
    subcategoryFlags = subcategory;
  }

  let category = null;
  if (categoryId) {
    category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundError('Category not found.');
  }

  const entryPoint: JobFormEntryPoint =
    query.entryPoint ??
    (offerApplied
      ? 'OFFER'
      : query.subcategoryId
        ? 'HOME_SUBCATEGORY'
        : query.categoryId
          ? 'HOME_CATEGORY'
          : 'DIRECT');

  const offerBanner = offerMeta
    ? buildOfferAppliedBanner({
        discountType: offerMeta.discountType,
        discountValue: offerMeta.discountValue,
        discountLabel: offerMeta.discountLabel,
        currencyCode: offerMeta.currencyCode,
      })
    : { title: '', message: '', discountLabel: '' };

  const formConfig = buildJobFormConfig({
    offerApplied,
    subcategory: subcategoryFlags,
    entryPoint,
    currencyCode: offerMeta?.currencyCode,
    offerBanner: offerApplied ? offerBanner : null,
  });

  const emptyOffer = {
    id: '',
    title: '',
    discountLabel: '',
    bannerImageUrl: '',
    bannerTitle: '',
    bannerSubtitle: '',
    bannerMessage: '',
    offerBanner: { title: '', message: '', discountLabel: '' },
  };

  return {
    entryPoint,
    categoryId: str(categoryId),
    subcategoryId: str(subcategoryId),
    traderId: str(traderId),
    offerId: str(offerMeta?.id),
    offerApplied,
    category: category
      ? { id: category.id, name: str(category.name) }
      : { id: '', name: '' },
    subcategory: subcategoryFlags
      ? {
          id: subcategoryFlags.id,
          name: str(subcategoryFlags.name),
          siteVisitEnabled: subcategoryFlags.siteVisitEnabled,
          siteVisitFee: resolveSiteVisitFee(subcategoryFlags),
          priceEnabled: subcategoryFlags.priceEnabled,
          priceEnteredBy: subcategoryFlags.priceEnteredBy,
        }
      : {
          id: '',
          name: '',
          siteVisitEnabled: false,
          siteVisitFee: 0,
          priceEnabled: true,
          priceEnteredBy: 'CUSTOMER',
        },
    offer: offerMeta
      ? {
          id: offerMeta.id,
          title: str(offerMeta.title),
          discountLabel: str(offerMeta.discountLabel),
          bannerImageUrl: str(offerMeta.bannerImageUrl),
          bannerTitle: str(offerBanner.title),
          bannerSubtitle: str(offerBanner.discountLabel),
          bannerMessage: str(offerBanner.message),
          offerBanner,
        }
      : emptyOffer,
    prefill: offerMeta
      ? buildNextJobPrefill({
          offerId: offerMeta.id,
          traderId,
          categoryId,
          subcategoryId,
          offerApplied: true,
          bannerTitle: offerBanner.title,
          bannerSubtitle: offerBanner.discountLabel,
          bannerMessage: offerBanner.message,
          discountLabel: offerMeta.discountLabel,
          bannerImageUrl: offerMeta.bannerImageUrl,
          title: offerMeta.title,
          quoteType: formConfig.defaultQuoteType,
          formConfig,
        })
      : buildNextJobPrefill({
          offerId: '',
          traderId,
          categoryId,
          subcategoryId,
          offerApplied: false,
          quoteType: formConfig.defaultQuoteType,
          formConfig,
        }),
    formConfig,
    navigation: {
      nextScreen: 'POST_NEW_JOB',
      afterJobForm: formConfig.nextAfterJobForm,
      afterLocation: formConfig.nextAfterLocation,
      afterPublish: formConfig.nextAfterLocation,
      afterPayment: 'SUCCESS',
    },
  };
};
