import { OfferClaimStatus, OfferStatus, OfferType } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { effectiveStatus, enrichOfferWithCurrency, offerInclude, serializeOfferWithMeta } from './offers.serializers';
import { buildOfferWhere, normalizeOfferListFilters } from './offers.query';
import { resolveUserCurrency } from '../../services/currency.service';
import { buildJobFormConfig, buildOfferAppliedBanner, buildNextJobPrefill } from '../jobs/jobs.form-config';

const publicInclude = {
  ...offerInclude,
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

  const [total, offers] = await Promise.all([
    prisma.offer.count({ where }),
    prisma.offer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: publicInclude,
    }),
  ]);

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

export const getPublicOffer = async (id: string, userId?: string) => {
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: publicInclude,
  });
  if (!offer) {
    throw new NotFoundError('Offer not found.');
  }

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

  return {
    ...enriched,
    /**
     * Mobile UI flow:
     * Offers list "Claim Now" → this detail screen (GET) — navigate only.
     * Detail "Accept Offer" → optional POST /accept (prefill) OR navigate with offerId to Post Job.
     * Offer is claimed (USED) only on Payment Successful — no separate claim API required.
     */
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
        note: 'Optional prefill only — does NOT claim. Pass offerId on POST /jobs. Claim = Payment Successful.',
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
 * Accept Offer / optional prefill helper — **never claims** a trader offer.
 * Frontend can skip this and use GET /trader-offers/{id} + GET /jobs/form-config instead.
 * Offer is applied (claim → USED) only on payment confirm (or marketplace publish with no pay).
 * Platform (Brisk) offers still create a CLAIMED wallet row on /brisk-offers/{id}/claim.
 */
export const claimOffer = async (userId: string, offerId: string, expectedType?: OfferType) => {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: publicInclude,
  });
  if (!offer) {
    throw new NotFoundError('Offer not found.');
  }
  if (expectedType && offer.offerType !== expectedType) {
    throw new BadRequestError(
      expectedType === OfferType.TRADER
        ? 'This endpoint is for trader-authored offers. Use POST /brisk-offers/:id/claim for platform offers.'
        : 'This endpoint is for Brisk/platform offers. Use POST /trader-offers/:id/accept for trader offers.'
    );
  }

  const status = effectiveStatus(offer.status, offer.validUntil);
  if (status !== OfferStatus.ACTIVE || offer.validFrom.getTime() > Date.now()) {
    throw new BadRequestError('This offer is not currently available.');
  }

  const flags = await resolveClaimFlags(userId, offerId);
  if (!flags.canApply) {
    throw new ConflictError('You have already used this offer.');
  }

  const isPlatform = offer.offerType === OfferType.PLATFORM;

  // Platform promo wallet only — trader Accept never writes a claim row.
  let claim: {
    id: string;
    status: string;
    claimedAt: string;
    jobId: string;
  } = { id: '', status: '', claimedAt: '', jobId: '' };

  if (isPlatform) {
    const existing = await prisma.offerClaim.findUnique({
      where: { offerId_userId: { offerId, userId } },
    });
    if (existing && existing.status === OfferClaimStatus.USED) {
      throw new ConflictError('You have already used this offer.');
    }
    const saved = existing
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
    claim = {
      id: saved.id,
      status: saved.status,
      claimedAt: saved.claimedAt ? saved.claimedAt.toISOString() : '',
      jobId: saved.jobId ?? '',
    };
  }

  const viewerCurrency = await resolveUserCurrency(userId);
  const resolvedOffer = await enrichOfferWithCurrency(
    {
      ...(await serializeOfferWithMeta(offer)),
      claimed: false,
      canApply: true,
    },
    viewerCurrency
  );

  const categoryId = offer.categories[0]?.categoryId ?? null;
  const subcategoryId = offer.subcategories[0]?.subcategoryId ?? null;
  const subcategory = subcategoryId
    ? await prisma.subcategory.findUnique({ where: { id: subcategoryId } })
    : null;

  const discountLabelText =
    resolvedOffer.displayDiscountLabel ?? resolvedOffer.discountLabel ?? null;
  const offerBanner = buildOfferAppliedBanner({
    discountType: offer.discountType,
    discountValue: Number(offer.discountValue),
    discountLabel: discountLabelText,
    currencyCode: offer.currencyCode,
  });

  const jobFormConfig = buildJobFormConfig({
    offerApplied: true,
    subcategory,
    entryPoint: 'OFFER',
    currencyCode: offer.currencyCode,
    offerBanner,
  });

  const afterLocation =
    jobFormConfig.showSiteVisitFee || offer.traderId
      ? 'SITE_VISIT_PAY_FEE'
      : 'WAITING_FOR_QUOTES';

  return {
    claim,
    offer: resolvedOffer,
    navigation: {
      nextScreen: 'POST_NEW_JOB',
      afterJobForm: 'CHOOSE_LOCATION',
      afterLocation,
      afterPublish: afterLocation,
      afterPayment: 'SUCCESS',
    },
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
    jobFormConfig,
    claimTiming: {
      claimOnAccept: false,
      softClaimOnPublish: false,
      claimUsedOnPaymentConfirm: true,
      claimRequiredApi: false,
      publishPath: 'POST /jobs/{jobId}/publish',
      confirmPaymentPath: 'POST /payments/{paymentId}/confirm',
      note:
        'No separate claim API for trader offers. Accept is optional prefill only. Pass offerId on POST /jobs. Offer is claimed (USED) on Payment Successful (POST /payments/{id}/confirm).',
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

export const listPromoCodes = async (categoryId?: string) => {
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

  const filtered = categoryId
    ? codes.filter((code) => {
        if (!code.categoryScope) return true;
        return code.categoryScope.split(',').includes(categoryId);
      })
    : codes;

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
