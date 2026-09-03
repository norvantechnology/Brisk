import { OfferClaimStatus, OfferStatus, OfferType } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { effectiveStatus, enrichOfferWithCurrency, offerInclude, serializeOfferWithMeta } from './offers.serializers';
import { buildOfferWhere, normalizeOfferListFilters } from './offers.query';
import { resolveUserCurrency } from '../../services/currency.service';

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
  if (userId && offers.length) {
    const claims = await prisma.offerClaim.findMany({
      where: {
        userId,
        offerId: { in: offers.map((offer) => offer.id) },
        status: { in: [OfferClaimStatus.CLAIMED, OfferClaimStatus.USED] },
      },
      select: { offerId: true },
    });
    claims.forEach((claim) => claimedIds.add(claim.offerId));
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

  const serializedOffers = await Promise.all(
    offers.map(async (offer) => {
      const base = {
        ...(await serializeOfferWithMeta(offer)),
        claimed: claimedIds.has(offer.id),
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

  const claimed = userId
    ? Boolean(
        await prisma.offerClaim.findUnique({
          where: { offerId_userId: { offerId: id, userId } },
        })
      )
    : false;

  const viewerCurrency = userId ? await resolveUserCurrency(userId) : null;
  const base = {
    ...(await serializeOfferWithMeta(offer)),
    claimed,
  };
  return enrichOfferWithCurrency(base, viewerCurrency);
};

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
        : 'This endpoint is for Brisk/platform offers. Use POST /trader-offers/:id/claim for trader offers.'
    );
  }

  const status = effectiveStatus(offer.status, offer.validUntil);
  if (status !== OfferStatus.ACTIVE || offer.validFrom.getTime() > Date.now()) {
    throw new BadRequestError('This offer is not currently claimable.');
  }

  const existing = await prisma.offerClaim.findUnique({
    where: { offerId_userId: { offerId, userId } },
  });
  if (existing && existing.status !== OfferClaimStatus.CANCELLED) {
    throw new ConflictError('You have already claimed this offer.');
  }

  const claim = existing
    ? await prisma.offerClaim.update({
        where: { id: existing.id },
        data: { status: OfferClaimStatus.CLAIMED, claimedAt: new Date(), usedAt: null },
      })
    : await prisma.offerClaim.create({
        data: { offerId, userId, status: OfferClaimStatus.CLAIMED },
      });

  await prisma.offer.update({
    where: { id: offerId },
    data: { claimsCount: { increment: existing ? 0 : 1 } },
  });

  const viewerCurrency = await resolveUserCurrency(userId);
  const resolvedOffer = await enrichOfferWithCurrency(
    { ...(await serializeOfferWithMeta(offer)), claimed: true },
    viewerCurrency
  );

  return {
    claim: {
      id: claim.id,
      status: claim.status,
      claimedAt: claim.claimedAt,
      jobId: claim.jobId,
    },
    offer: resolvedOffer,
    nextJobPrefill: {
      claimId: claim.id,
      appliedTraderOfferId: offer.id,
      offerId: offer.id,
      traderId: offer.traderId,
      categoryId: offer.categories[0]?.categoryId ?? null,
      categoryIds: offer.categories.map((item) => item.categoryId),
      subcategoryId: offer.subcategories[0]?.subcategoryId ?? null,
      subcategoryIds: offer.subcategories.map((item) => item.subcategoryId),
      ctaAction: resolvedOffer.ctaAction,
      /** "Offer Applied" banner on Post a New Job. */
      offerApplied: true,
      bannerTitle: offer.title,
      bannerSubtitle: resolvedOffer.displayDiscountLabel ?? resolvedOffer.discountLabel,
      discountLabel: resolvedOffer.displayDiscountLabel ?? resolvedOffer.discountLabel,
      bannerImageUrl: offer.bannerImageUrl,
      title: offer.title,
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
          { ...(await serializeOfferWithMeta(claim.offer)), claimed: true },
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
