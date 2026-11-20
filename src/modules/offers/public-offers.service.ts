import { InvoiceStatus, JobStatus, OfferClaimStatus, OfferStatus, OfferType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { effectiveStatus, enrichOfferWithCurrency, offerInclude, serializeOfferWithMeta } from './offers.serializers';
import { buildOfferWhere, normalizeOfferListFilters } from './offers.query';
import { resolveUserCurrency } from '../../services/currency.service';
import { buildJobFormConfig, buildOfferAppliedBanner, buildNextJobPrefill } from '../jobs/jobs.form-config';

const publicInclude = {
  ...offerInclude,
};

type OfferWithPublicInclude = {
  id: string;
  traderId: string | null;
  discountType: import('@prisma/client').DiscountType;
  discountValue: { toString(): string } | number;
  currencyCode: string | null;
  bannerImageUrl: string | null;
  title: string;
  categories: Array<{ categoryId: string }>;
  subcategories: Array<{
    subcategoryId: string;
    subcategory: {
      id: string;
      name: string;
      categoryId: string;
      siteVisitEnabled: boolean;
      siteVisitFee: { toString(): string } | number | null;
      priceEnabled: boolean;
      priceEnteredBy: string | null;
    };
  }>;
};

/** Build Post Job navigation payload from an already-loaded offer (no extra API needed on mobile). */
const buildOfferJobNavigation = (
  offer: OfferWithPublicInclude,
  resolvedOffer: {
    displayDiscountLabel?: string;
    discountLabel?: string;
    ctaAction?: string;
  }
) => {
  const categoryId = offer.categories[0]?.categoryId ?? null;
  const subcategory = offer.subcategories[0]?.subcategory ?? null;
  const subcategoryId = subcategory?.id ?? offer.subcategories[0]?.subcategoryId ?? null;

  const discountLabelText =
    resolvedOffer.displayDiscountLabel ?? resolvedOffer.discountLabel ?? null;
  const offerBanner = buildOfferAppliedBanner({
    discountType: offer.discountType,
    discountValue: Number(offer.discountValue),
    discountLabel: discountLabelText,
    currencyCode: offer.currencyCode ?? undefined,
  });

  const jobFormConfig = buildJobFormConfig({
    offerApplied: true,
    subcategory: subcategory
      ? {
          id: subcategory.id,
          name: subcategory.name,
          siteVisitEnabled: subcategory.siteVisitEnabled,
          siteVisitFee: subcategory.siteVisitFee,
          priceEnabled: subcategory.priceEnabled,
          priceEnteredBy:
            (subcategory.priceEnteredBy as 'CUSTOMER' | 'TRADER') || 'CUSTOMER',
        }
      : null,
    entryPoint: 'OFFER',
    currencyCode: offer.currencyCode ?? undefined,
    offerBanner,
  });

  const afterLocation =
    jobFormConfig.showSiteVisitFee || offer.traderId
      ? 'SITE_VISIT_PAY_FEE'
      : 'WAITING_FOR_QUOTES';

  return {
    jobFormConfig,
    nextJobPrefill: buildNextJobPrefill({
      claimId: '',
      offerId: offer.id,
      traderId: offer.traderId,
      categoryId,
      categoryIds: offer.categories.map((item) => item.categoryId),
      subcategoryId,
      subcategoryIds: offer.subcategories.map((item) => item.subcategoryId),
      ctaAction: resolvedOffer.ctaAction,
      offerApplied: true,
      bannerTitle: offerBanner.title,
      bannerSubtitle: offerBanner.discountLabel,
      bannerMessage: offerBanner.message,
      discountLabel: discountLabelText,
      bannerImageUrl: offer.bannerImageUrl,
      title: offer.title,
      quoteType: jobFormConfig.defaultQuoteType,
      formConfig: jobFormConfig,
    }),
    navigation: {
      nextScreen: 'POST_NEW_JOB',
      afterJobForm: 'CHOOSE_LOCATION',
      afterLocation,
      afterPublish: afterLocation,
      afterPayment: 'SUCCESS',
    },
  };
};

/**
 * Returns all offer IDs and uppercase promo code strings that have been used
 * by this customer across claims, jobs, bookings, and invoices.
 */
export const getUsedOffersAndPromoCodesForUser = async (userId: string) => {
  const usedOfferIds = new Set<string>();
  const usedPromoCodes = new Set<string>();

  // 1. Claims marked USED or attached to a job
  const claims = await prisma.offerClaim.findMany({
    where: {
      userId,
      OR: [{ status: OfferClaimStatus.USED }, { jobId: { not: null } }],
    },
    select: { offerId: true },
  });
  claims.forEach((c) => {
    if (c.offerId) usedOfferIds.add(c.offerId);
  });

  // 2. Jobs posted by this customer with an offer attached (active/completed jobs)
  const jobs = await prisma.job.findMany({
    where: {
      customerId: userId,
      offerId: { not: null },
      status: { notIn: [JobStatus.DRAFT, JobStatus.CANCELLED] },
    },
    select: { offerId: true },
  });
  jobs.forEach((j) => {
    if (j.offerId) usedOfferIds.add(j.offerId);
  });

  // 3. Invoices for this customer where a promo code was applied or promo discount was granted
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { notIn: [InvoiceStatus.CANCELLED] },
      OR: [{ appliedPromoCode: { not: null } }, { promoDiscount: { gt: 0 } }],
      AND: [
        {
          OR: [
            { booking: { customerId: userId } },
            { booking: { job: { customerId: userId } } },
            { paymentRequest: { customerId: userId } },
            { paymentRequest: { job: { customerId: userId } } },
            { payments: { some: { userId } } },
          ],
        },
      ],
    },
    select: {
      appliedPromoCode: true,
      booking: {
        select: {
          job: {
            select: { offerId: true },
          },
        },
      },
    },
  });

  invoices.forEach((inv) => {
    const code = inv.appliedPromoCode?.trim().toUpperCase();
    if (code) usedPromoCodes.add(code);
    const jobOfferId = inv.booking?.job?.offerId;
    if (jobOfferId) usedOfferIds.add(jobOfferId);
  });

  // 4. Expand: match collected usedPromoCodes to linked offer IDs and aliases
  if (usedPromoCodes.size > 0) {
    const codesList = Array.from(usedPromoCodes);

    const [matchingPromoCodes, matchingOffers] = await Promise.all([
      prisma.promoCode.findMany({
        where: {
          OR: [
            { code: { in: codesList } },
            ...codesList.map((c) => ({
              code: { equals: c, mode: 'insensitive' as const },
            })),
          ],
        },
        select: { code: true, offerId: true },
      }),
      prisma.offer.findMany({
        where: {
          offerType: OfferType.PLATFORM,
          OR: [
            { couponCode: { in: codesList } },
            { offerCode: { in: codesList } },
            ...codesList.flatMap((c) => [
              { couponCode: { equals: c, mode: 'insensitive' as const } },
              { offerCode: { equals: c, mode: 'insensitive' as const } },
              { title: { contains: c, mode: 'insensitive' as const } },
            ]),
            {
              promoCodes: {
                some: {
                  OR: [
                    { code: { in: codesList } },
                    ...codesList.map((c) => ({
                      code: { equals: c, mode: 'insensitive' as const },
                    })),
                  ],
                },
              },
            },
          ],
        },
        select: { id: true, couponCode: true, offerCode: true },
      }),
    ]);

    matchingPromoCodes.forEach((pc) => {
      usedPromoCodes.add(pc.code.toUpperCase());
      if (pc.offerId) usedOfferIds.add(pc.offerId);
    });

    matchingOffers.forEach((o) => {
      usedOfferIds.add(o.id);
      if (o.couponCode) usedPromoCodes.add(o.couponCode.toUpperCase());
      if (o.offerCode) usedPromoCodes.add(o.offerCode.toUpperCase());
    });
  }

  // 5. Expand: match collected usedOfferIds to all linked promo codes
  if (usedOfferIds.size > 0) {
    const offerIdsList = Array.from(usedOfferIds);
    const [linkedOffers, linkedPromoCodes] = await Promise.all([
      prisma.offer.findMany({
        where: { id: { in: offerIdsList } },
        select: {
          id: true,
          couponCode: true,
          offerCode: true,
          promoCodes: { select: { code: true } },
        },
      }),
      prisma.promoCode.findMany({
        where: { offerId: { in: offerIdsList } },
        select: { code: true },
      }),
    ]);

    linkedOffers.forEach((o) => {
      if (o.couponCode) usedPromoCodes.add(o.couponCode.toUpperCase());
      if (o.offerCode) usedPromoCodes.add(o.offerCode.toUpperCase());
      o.promoCodes.forEach((pc) => usedPromoCodes.add(pc.code.toUpperCase()));
    });
    linkedPromoCodes.forEach((pc) => {
      usedPromoCodes.add(pc.code.toUpperCase());
    });
  }

  return { usedOfferIds, usedPromoCodes };
};

export const listPublicOffers = async (
  kind: OfferType,
  query: Record<string, unknown>,
  userId?: string
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const where = buildOfferWhere(
    normalizeOfferListFilters(query, { forceOfferType: kind, publicOnly: true })
  );

  let usedOfferIds = new Set<string>();
  let usedPromoCodes = new Set<string>();

  // For [GET] /brisk-offers: remove promo codes / offers that have been successfully used by this customer
  if (kind === OfferType.PLATFORM && userId) {
    const used = await getUsedOffersAndPromoCodesForUser(userId);
    usedOfferIds = used.usedOfferIds;
    usedPromoCodes = used.usedPromoCodes;

    const excludeOr: Prisma.OfferWhereInput[] = [];
    if (usedOfferIds.size > 0) {
      excludeOr.push({ id: { in: Array.from(usedOfferIds) } });
    }
    if (usedPromoCodes.size > 0) {
      const codes = Array.from(usedPromoCodes);
      excludeOr.push(
        { couponCode: { in: codes } },
        { offerCode: { in: codes } },
        ...codes.flatMap((c) => [
          { couponCode: { equals: c, mode: 'insensitive' as const } },
          { offerCode: { equals: c, mode: 'insensitive' as const } },
        ]),
        {
          promoCodes: {
            some: {
              OR: [
                { code: { in: codes } },
                ...codes.map((c) => ({ code: { equals: c, mode: 'insensitive' as const } })),
              ],
            },
          },
        }
      );
    }

    if (excludeOr.length > 0) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { NOT: { OR: excludeOr } },
      ];
    }
  }

  const [total, rawOffers] = await Promise.all([
    prisma.offer.count({ where }),
    prisma.offer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: publicInclude,
    }),
  ]);

  const offers =
    kind === OfferType.PLATFORM && userId && (usedOfferIds.size > 0 || usedPromoCodes.size > 0)
      ? rawOffers.filter((offer) => {
          if (usedOfferIds.has(offer.id)) return false;
          if (offer.couponCode && usedPromoCodes.has(offer.couponCode.trim().toUpperCase())) return false;
          if (offer.offerCode && usedPromoCodes.has(offer.offerCode.trim().toUpperCase())) return false;
          if (offer.promoCodes?.some((pc) => usedPromoCodes.has(pc.code.trim().toUpperCase()))) return false;
          return true;
        })
      : rawOffers;

  const claimedIds = new Set<string>();
  const softClaimedIds = new Set<string>();
  if (userId && offers.length) {
    const claims = await prisma.offerClaim.findMany({
      where: {
        userId,
        offerId: { in: offers.map((offer) => offer.id) },
        status: { in: [OfferClaimStatus.CLAIMED, OfferClaimStatus.USED] },
      },
      select: { offerId: true, status: true },
    });
    claims.forEach((claim) => {
      if (claim.status === OfferClaimStatus.USED) claimedIds.add(claim.offerId);
      else if (claim.status === OfferClaimStatus.CLAIMED) softClaimedIds.add(claim.offerId);
    });
  }

  let pointsBalance = 0;
  const viewerCurrency = userId ? await resolveUserCurrency(userId) : null;
  if (kind === OfferType.PLATFORM && userId) {
    const loyalty = await prisma.loyaltyAccount.findUnique({
      where: { userId },
      select: { pointsBalance: true },
    });
    pointsBalance = loyalty?.pointsBalance ?? 0;
  }

  const inProgressIds = new Set<string>();
  if (userId && softClaimedIds.size) {
    const softClaims = await prisma.offerClaim.findMany({
      where: {
        userId,
        offerId: { in: [...softClaimedIds] },
        status: OfferClaimStatus.CLAIMED,
        jobId: { not: null },
      },
      select: { offerId: true },
    });
    softClaims.forEach((c) => inProgressIds.add(c.offerId));
  }

  const serializedOffers = await Promise.all(
    offers.map(async (offer) => {
      const used = claimedIds.has(offer.id);
      const inProgress = inProgressIds.has(offer.id);
      const base = {
        ...(await serializeOfferWithMeta(offer)),
        claimed: used,
        canApply: !used && !inProgress,
        hasAbandonedClaim: softClaimedIds.has(offer.id) && !inProgress,
        inProgress,
      };
      return enrichOfferWithCurrency(base, viewerCurrency);
    })
  );

  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    pointsBalance: kind === OfferType.PLATFORM ? pointsBalance : undefined,
    preferredCurrency: viewerCurrency ?? undefined,
    offers: serializedOffers,
  };
};

/**
 * Live offers valid for a main category (linked to it, or to one of its sub-categories).
 * Brisk (PLATFORM) offers first, then newest. Offers the viewer already used are skipped.
 */
export const listApplicableOffersForCategory = async (
  categoryId: string,
  userId?: string | null,
  categoryName?: string | null
) => {
  const offers = await prisma.offer.findMany({
    where: {
      AND: [
        buildOfferWhere({ publicOnly: true }),
        {
          OR: [
            { categories: { some: { categoryId } } },
            { subcategories: { some: { subcategory: { categoryId } } } },
          ],
        },
      ],
    },
    orderBy: [{ offerType: 'asc' }, { createdAt: 'desc' }],
    include: publicInclude,
  });
  if (!offers.length) return [];

  const blockedIds = new Set<string>();
  if (userId) {
    const { usedOfferIds, usedPromoCodes } = await getUsedOffersAndPromoCodesForUser(userId);
    usedOfferIds.forEach((id) => blockedIds.add(id));
    offers.forEach((offer) => {
      if (offer.couponCode && usedPromoCodes.has(offer.couponCode.trim().toUpperCase())) {
        blockedIds.add(offer.id);
      }
      if (offer.offerCode && usedPromoCodes.has(offer.offerCode.trim().toUpperCase())) {
        blockedIds.add(offer.id);
      }
      if (offer.promoCodes?.some((pc) => usedPromoCodes.has(pc.code.trim().toUpperCase()))) {
        blockedIds.add(offer.id);
      }
    });
  }

  const viewerCurrency = userId ? await resolveUserCurrency(userId) : null;
  return Promise.all(
    offers
      .filter((offer) => !blockedIds.has(offer.id))
      .map(async (offer) => {
        const data = await enrichOfferWithCurrency(
          { ...(await serializeOfferWithMeta(offer)), claimed: false, canApply: true },
          viewerCurrency
        );
        const validSubcategories = data.subcategories.filter((sub) => sub.categoryId === categoryId);
        const validCategory = data.categories.find((cat) => cat.id === categoryId);
        return {
          id: data.id,
          offerId: data.offerId,
          offerCode: data.offerCode,
          offerType: data.offerType,
          title: data.title,
          shortDescription: data.shortDescription,
          discountType: data.discountType,
          discountValue: data.discountValue,
          currencyCode: data.currencyCode,
          discountLabel: data.displayDiscountLabel ?? data.discountLabel,
          validUntil: data.validUntil,
          validCategoryId: categoryId,
          validCategoryName: validCategory?.name ?? categoryName ?? null,
          validSubcategoryIds: validSubcategories.map((sub) => sub.id),
          validSubcategoryName: validSubcategories.map((sub) => sub.name).join(', ') || null,
          traderId: data.traderId,
          bannerImageUrl: data.bannerImageUrl,
          isActive: data.status === OfferStatus.ACTIVE,
        };
      })
  );
};

const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

export const resolveOfferByIdOrCode = async (rawIdOrCode: string) => {
  const trimmed = rawIdOrCode.trim();
  if (!trimmed) {
    throw new BadRequestError('Offer ID or promotion code is required.');
  }

  // 1. If it's a UUID, check Offer by ID
  if (isUuid(trimmed)) {
    const offerById = await prisma.offer.findUnique({
      where: { id: trimmed },
      include: publicInclude,
    });
    if (offerById) return offerById;
  }

  const normalizedCode = trimmed.toUpperCase();

  // 2. Check PromoCode table (which links to offerId)
  const promo = await prisma.promoCode.findFirst({
    where: { code: { equals: normalizedCode, mode: 'insensitive' } },
    include: { offer: { include: publicInclude } },
  });
  if (promo?.offer) {
    return promo.offer;
  }

  // 3. Check Offer table by couponCode or offerCode
  const offerByCode = await prisma.offer.findFirst({
    where: {
      OR: [
        { couponCode: { equals: normalizedCode, mode: 'insensitive' } },
        { offerCode: { equals: normalizedCode, mode: 'insensitive' } },
        { couponCode: { equals: trimmed, mode: 'insensitive' } },
        { offerCode: { equals: trimmed, mode: 'insensitive' } },
      ],
    },
    include: publicInclude,
  });

  if (offerByCode) {
    return offerByCode;
  }

  return null;
};

export const getPublicOffer = async (idOrCode: string, userId?: string) => {
  const offer = await resolveOfferByIdOrCode(idOrCode);
  if (!offer) {
    throw new NotFoundError('Offer not found.');
  }
  const id = offer.id;

  const claimFlags = userId ? await resolveClaimFlags(userId, id) : {
    claimed: false,
    canApply: true,
    claimId: null as string | null,
    claimStatus: null as OfferClaimStatus | null,
  };

  const viewerCurrency = userId ? await resolveUserCurrency(userId) : null;
  const base = {
    ...(await serializeOfferWithMeta(offer)),
    claimed: claimFlags.claimed,
    canApply: claimFlags.canApply,
  };
  const enriched = await enrichOfferWithCurrency(base, viewerCurrency);
  const jobNav = buildOfferJobNavigation(offer, enriched);

  return {
    ...enriched,
    /**
     * Mobile UI flow:
     * Offers list "Claim Now" → this detail screen (GET) — navigate only.
     * Detail "Accept Offer" → optional POST /accept (prefill) OR navigate with offerId to Post Job.
     * Prefer `jobFormConfig` + `nextJobPrefill` from THIS response — do not wait on a second
     * form-config call on Post Job (avoids late/missing response breaking the flow).
     * Offer is claimed (USED) only on Payment Successful — no separate claim API required.
     */
    jobFormConfig: jobNav.jobFormConfig,
    nextJobPrefill: jobNav.nextJobPrefill,
    navigation: jobNav.navigation,
    actions: {
      claimNow: {
        type: 'NAVIGATE',
        screen: 'OFFER_DETAIL',
        note: 'List CTA only — open this detail. Do not call any claim API.',
      },
      acceptOffer: {
        type: 'OPTIONAL',
        method: 'POST',
        path: `/trader-offers/${id}/accept`,
        alternatePath: `/trader-offers/${id}/claim`,
        nextScreen: 'POST_NEW_JOB',
        note: 'Optional. Prefer jobFormConfig/nextJobPrefill from this GET. Pass offerId on POST /jobs. Claim = Payment Successful.',
      },
    },
  };
};

/**
 * Resolve offer usage flags for a customer.
 * - claimed = true only when USED (Payment Successful)
 * - canApply = false when USED (or legacy soft CLAIMED+jobId)
 */
const resolveClaimFlags = async (userId: string, offerId: string) => {
  const claim = await prisma.offerClaim.findUnique({
    where: { offerId_userId: { offerId, userId } },
  });
  if (!claim || claim.status === OfferClaimStatus.CANCELLED) {
    return { claimed: false, canApply: true, claimId: null, claimStatus: null };
  }
  if (claim.status === OfferClaimStatus.USED) {
    return {
      claimed: true,
      canApply: false,
      claimId: claim.id,
      claimStatus: claim.status,
    };
  }
  // Legacy soft CLAIMED + job (old publish path) — treat as in-progress
  if (claim.status === OfferClaimStatus.CLAIMED && claim.jobId) {
    return {
      claimed: false,
      canApply: false,
      claimId: claim.id,
      claimStatus: claim.status,
      inProgress: true,
    };
  }
  // Platform wallet CLAIMED / abandoned — reusable for trader job flow until USED
  return {
    claimed: false,
    canApply: true,
    claimId: claim.id,
    claimStatus: claim.status,
  };
};

/**
 * Claim an offer / promo code into the customer's wallet.
 * Supports both UUIDs and promo code strings (e.g. PEST10BRISK).
 * Applies to both Trader and Brisk (platform) offers.
 */
export const claimOffer = async (
  userId: string,
  offerIdOrCode: string,
  expectedType?: OfferType,
  bodyCode?: string
) => {
  const target = (bodyCode?.trim() || offerIdOrCode).trim();
  const offer = await resolveOfferByIdOrCode(target);
  if (!offer) {
    throw new NotFoundError('Invalid promotion code or offer not found.');
  }

  const offerId = offer.id;
  const isCodeLookup = !isUuid(target);
  if (expectedType && offer.offerType !== expectedType && !isCodeLookup) {
    throw new BadRequestError(
      expectedType === OfferType.TRADER
        ? 'This endpoint is for trader-authored offers. Use POST /brisk-offers/:id/claim for platform offers.'
        : 'This endpoint is for Brisk/platform offers. Use POST /trader-offers/:id/accept for trader offers.'
    );
  }

  const status = effectiveStatus(offer.status, offer.validUntil);
  if (status !== OfferStatus.ACTIVE || offer.validFrom.getTime() > Date.now()) {
    throw new BadRequestError('This offer is not currently active or has expired.');
  }

  const existing = await prisma.offerClaim.findUnique({
    where: { offerId_userId: { offerId, userId } },
  });
  if (existing && existing.status === OfferClaimStatus.USED) {
    throw new ConflictError('You have already used this offer.');
  }

  // Idempotent wallet claim
  let alreadyClaimed = false;
  let savedClaim = existing;

  if (existing && existing.status === OfferClaimStatus.CLAIMED) {
    alreadyClaimed = true;
  } else {
    savedClaim = existing
      ? await prisma.offerClaim.update({
          where: { id: existing.id },
          data: { status: OfferClaimStatus.CLAIMED, claimedAt: new Date(), usedAt: null },
        })
      : await prisma.offerClaim.create({
          data: { offerId, userId, status: OfferClaimStatus.CLAIMED },
        });

    if (!existing) {
      await prisma.offer.update({
        where: { id: offerId },
        data: { claimsCount: { increment: 1 } },
      });
    }
  }

  const claim = {
    id: savedClaim?.id ?? '',
    status: savedClaim?.status ?? OfferClaimStatus.CLAIMED,
    claimedAt: savedClaim?.claimedAt ? savedClaim.claimedAt.toISOString() : new Date().toISOString(),
    jobId: savedClaim?.jobId ?? '',
  };

  const viewerCurrency = await resolveUserCurrency(userId);
  const resolvedOffer = await enrichOfferWithCurrency(
    {
      ...(await serializeOfferWithMeta(offer)),
      claimed: true,
      canApply: true,
    },
    viewerCurrency
  );

  const jobNav = buildOfferJobNavigation(offer, resolvedOffer);

  return {
    alreadyClaimed,
    claim,
    offer: resolvedOffer,
    navigation: jobNav.navigation,
    nextJobPrefill: jobNav.nextJobPrefill,
    jobFormConfig: jobNav.jobFormConfig,
    claimTiming: {
      claimOnAccept: false,
      softClaimOnPublish: false,
      claimUsedOnPaymentConfirm: true,
      claimRequiredApi: false,
      publishPath: 'POST /jobs/{jobId}/publish',
      confirmPaymentPath: 'POST /payments/{paymentId}/confirm',
      note: 'Offer claimed to wallet. Discount applies at job checkout / payment confirmation.',
    },
  };
};

export const listMyClaims = async (userId: string, offerType?: OfferType) => {
  const viewerCurrency = await resolveUserCurrency(userId);
  const claims = await prisma.offerClaim.findMany({
    where: {
      userId,
      status: { in: [OfferClaimStatus.CLAIMED, OfferClaimStatus.USED] },
      ...(offerType ? { offer: { offerType } } : {}),
    },
    orderBy: { claimedAt: 'desc' },
    include: {
      offer: { include: publicInclude },
    },
  });

  return {
    preferredCurrency: viewerCurrency,
    claims: await Promise.all(
      claims.map(async (claim) => ({
        id: claim.id,
        status: claim.status,
        claimedAt: claim.claimedAt,
        usedAt: claim.usedAt,
        jobId: claim.jobId,
        offer: await enrichOfferWithCurrency(
          {
            ...(await serializeOfferWithMeta(claim.offer)),
            claimed: claim.status === OfferClaimStatus.USED,
            canApply: claim.status !== OfferClaimStatus.USED,
          },
          viewerCurrency
        ),
      }))
    ),
  };
};

export const listPromoCodes = async (categoryId?: string, userId?: string) => {
  const now = new Date();
  const codes = await prisma.promoCode.findMany({
    where: {
      active: true,
      validFrom: { lte: now },
      validUntil: { gte: now },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      offer: {
        select: {
          id: true,
          title: true,
          offerType: true,
          categories: { select: { categoryId: true } },
        },
      },
    },
  });

  let filtered = categoryId
    ? codes.filter((code) => {
        if (!code.categoryScope) return true;
        return code.categoryScope.split(',').includes(categoryId);
      })
    : codes;

  if (userId) {
    const { usedOfferIds, usedPromoCodes } = await getUsedOffersAndPromoCodesForUser(userId);
    if (usedOfferIds.size > 0 || usedPromoCodes.size > 0) {
      filtered = filtered.filter((code) => {
        const codeUpper = code.code.trim().toUpperCase();
        if (usedPromoCodes.has(codeUpper)) return false;
        if (code.offerId && usedOfferIds.has(code.offerId)) return false;
        return true;
      });
    }
  }

  return {
    promoCodes: filtered.map((code) => ({
      id: code.id,
      code: code.code,
      discountType: code.discountType,
      discountValue: Number(code.discountValue),
      currencyCode: code.currencyCode,
      categoryScope: code.categoryScope,
      validFrom: code.validFrom,
      validUntil: code.validUntil,
      offerId: code.offerId,
      offerTitle: code.offer?.title ?? null,
    })),
  };
};

export const validatePromoCode = async (userId: string, code: string, categoryId?: string) => {
  const promo = await prisma.promoCode.findFirst({
    where: { code: { equals: code.trim(), mode: 'insensitive' } },
    include: { offer: { include: publicInclude } },
  });

  if (!promo || !promo.active) {
    throw new BadRequestError('Promo code is invalid.');
  }

  const now = new Date();
  if (promo.validFrom > now || promo.validUntil < now) {
    throw new BadRequestError('Promo code is outside its validity window.');
  }

  if (categoryId && promo.categoryScope) {
    const allowed = promo.categoryScope.split(',').filter(Boolean);
    if (allowed.length && !allowed.includes(categoryId)) {
      throw new BadRequestError('Promo code does not apply to this category.');
    }
  }

  const viewerCurrency = await resolveUserCurrency(userId);

  return {
    valid: true,
    applyAt: 'invoice_checkout',
    preferredCurrency: viewerCurrency,
    promoCode: {
      id: promo.id,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: Number(promo.discountValue),
      currencyCode: promo.currencyCode,
      categoryScope: promo.categoryScope,
      validFrom: promo.validFrom,
      validUntil: promo.validUntil,
    },
    offer: promo.offer
      ? await enrichOfferWithCurrency(await serializeOfferWithMeta(promo.offer), viewerCurrency)
      : null,
    note: 'Apply this code at invoice checkout via POST /invoices/:id/apply-promo once invoices are available. Codes are not bound to a job when claimed.',
    customerId: userId,
  };
};
