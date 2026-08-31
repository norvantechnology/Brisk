import { ActorType, DiscountType, OfferStatus, OfferType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { offerInclude, serializeOfferWithMeta } from './offers.serializers';
import { nextOfferCode } from './offers.query';
import { currencyForNewRecord, getBaseCurrencyCode } from '../../services/currency.service';

export type OfferWriteInput = {
  title: string;
  couponCode?: string | null;
  shortDescription?: string | null;
  /** Alias for fullDescription — mobile "Description & Terms" field. */
  description?: string | null;
  fullDescription?: string | null;
  bannerImageUrl?: string | null;
  badgeTag?: string | null;
  discountType: DiscountType | 'FLAT' | 'PERCENTAGE' | 'FREE_SERVICE';
  discountValue: number;
  discountLabel?: string | null;
  validFrom?: string | Date;
  validUntil: string | Date;
  categoryIds?: string[];
  subcategoryIds?: string[];
  traderId?: string | null;
  ctaLabel?: string | null;
  ctaAction?: 'CLAIM' | 'BOOK_INSPECTION';
  status?: OfferStatus | 'ACTIVE' | 'DISABLED' | 'EXPIRED';
};

const resolveFullDescription = (body: {
  description?: string | null;
  fullDescription?: string | null;
}) => body.fullDescription ?? body.description ?? null;

const asDiscountType = (value: OfferWriteInput['discountType']): DiscountType =>
  value as DiscountType;

export const attachOfferTaxonomy = async (
  offerId: string,
  categoryIds: string[] = [],
  subcategoryIds: string[] = []
) => {
  if (categoryIds.length) {
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    if (categories.length !== categoryIds.length) {
      throw new BadRequestError('One or more categoryIds are invalid.');
    }
  }

  if (subcategoryIds.length) {
    const subcategories = await prisma.subcategory.findMany({
      where: { id: { in: subcategoryIds } },
      select: { id: true, categoryId: true },
    });
    if (subcategories.length !== subcategoryIds.length) {
      throw new BadRequestError('One or more subcategoryIds are invalid.');
    }
  }

  await prisma.$transaction([
    prisma.offerCategory.deleteMany({ where: { offerId } }),
    prisma.offerSubcategory.deleteMany({ where: { offerId } }),
    ...(categoryIds.length
      ? [
          prisma.offerCategory.createMany({
            data: categoryIds.map((categoryId) => ({ offerId, categoryId })),
          }),
        ]
      : []),
    ...(subcategoryIds.length
      ? [
          prisma.offerSubcategory.createMany({
            data: subcategoryIds.map((subcategoryId) => ({ offerId, subcategoryId })),
          }),
        ]
      : []),
  ]);
};

export const loadOffer = async (id: string) => {
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: offerInclude,
  });
  if (!offer) {
    throw new NotFoundError('Offer not found.');
  }
  return serializeOfferWithMeta(offer);
};

export const createOfferRecord = async (input: {
  offerType: OfferType;
  createdById?: string | null;
  traderId?: string | null;
  creatorUserId?: string | null;
  body: OfferWriteInput;
}) => {
  const validFrom = input.body.validFrom ? new Date(input.body.validFrom) : new Date();
  const validUntil = new Date(input.body.validUntil);
  if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) {
    throw new BadRequestError('validFrom and validUntil must be valid dates.');
  }
  if (validUntil <= validFrom) {
    throw new BadRequestError('validUntil (expiry) must be after validFrom (start).');
  }

  if (input.offerType === OfferType.TRADER && !input.traderId) {
    throw new BadRequestError('Trader offers require traderId.');
  }

  if (input.body.couponCode) {
    const existingCoupon = await prisma.offer.findFirst({
      where: { couponCode: input.body.couponCode.trim() },
    });
    if (existingCoupon) {
      throw new ConflictError('Coupon code is already in use.');
    }
  }

  const currencyCode = input.creatorUserId
    ? await currencyForNewRecord(input.creatorUserId)
    : await getBaseCurrencyCode();

  const offer = await prisma.offer.create({
    data: {
      offerCode: await nextOfferCode(),
      offerType: input.offerType,
      title: input.body.title.trim(),
      couponCode: input.body.couponCode?.trim() || null,
      shortDescription: input.body.shortDescription ?? null,
      fullDescription: resolveFullDescription(input.body),
      bannerImageUrl: input.body.bannerImageUrl ?? null,
      badgeTag: input.body.badgeTag ?? null,
      discountType: asDiscountType(input.body.discountType),
      discountValue: new Prisma.Decimal(input.body.discountValue),
      currencyCode,
      discountLabel: input.body.discountLabel ?? null,
      createdById: input.createdById ?? null,
      traderId: input.traderId ?? input.body.traderId ?? null,
      validFrom,
      validUntil,
      status: validUntil < new Date() ? OfferStatus.EXPIRED : ((input.body.status as OfferStatus) ?? OfferStatus.ACTIVE),
      ctaLabel: input.body.ctaLabel ?? null,
      ctaAction: input.body.ctaAction ?? 'CLAIM',
    },
  });

  await attachOfferTaxonomy(offer.id, input.body.categoryIds ?? [], input.body.subcategoryIds ?? []);

  if (input.body.couponCode) {
    await prisma.promoCode.create({
      data: {
        offerId: offer.id,
        code: input.body.couponCode.trim(),
        discountType: asDiscountType(input.body.discountType),
        discountValue: new Prisma.Decimal(input.body.discountValue),
        currencyCode,
        categoryScope: (input.body.categoryIds ?? []).join(',') || null,
        validFrom,
        validUntil,
        active: true,
      },
    });
  }

  return loadOffer(offer.id);
};

export const updateOfferRecord = async (id: string, body: Partial<OfferWriteInput>) => {
  const existing = await prisma.offer.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Offer not found.');
  }

  const validFrom = body.validFrom ? new Date(body.validFrom) : existing.validFrom;
  const validUntil = body.validUntil ? new Date(body.validUntil) : existing.validUntil;
  if (validUntil <= validFrom) {
    throw new BadRequestError('validUntil must be after validFrom.');
  }

  if (body.couponCode && body.couponCode !== existing.couponCode) {
    const conflict = await prisma.offer.findFirst({
      where: { couponCode: body.couponCode.trim(), NOT: { id } },
    });
    if (conflict) {
      throw new ConflictError('Coupon code is already in use.');
    }
  }

  await prisma.offer.update({
    where: { id },
    data: {
      title: body.title?.trim(),
      couponCode: body.couponCode === undefined ? undefined : body.couponCode?.trim() || null,
      shortDescription: body.shortDescription,
      fullDescription:
        body.fullDescription !== undefined || body.description !== undefined
          ? resolveFullDescription(body)
          : undefined,
      bannerImageUrl: body.bannerImageUrl,
      badgeTag: body.badgeTag,
      discountType: body.discountType ? asDiscountType(body.discountType) : undefined,
      discountValue: body.discountValue !== undefined ? new Prisma.Decimal(body.discountValue) : undefined,
      discountLabel: body.discountLabel,
      validFrom: body.validFrom ? validFrom : undefined,
      validUntil: body.validUntil ? validUntil : undefined,
      traderId: body.traderId === undefined ? undefined : body.traderId,
      ctaLabel: body.ctaLabel,
      ctaAction: body.ctaAction,
      status: body.status as OfferStatus | undefined,
    },
  });

  if (body.categoryIds !== undefined || body.subcategoryIds !== undefined) {
    const links = await prisma.offer.findUnique({
      where: { id },
      include: { categories: true, subcategories: true },
    });
    await attachOfferTaxonomy(
      id,
      body.categoryIds ?? links?.categories.map((item) => item.categoryId) ?? [],
      body.subcategoryIds ?? links?.subcategories.map((item) => item.subcategoryId) ?? []
    );
  }

  if (body.couponCode !== undefined || body.discountType || body.discountValue !== undefined || body.validFrom || body.validUntil) {
    const updated = await prisma.offer.findUnique({ where: { id } });
    if (updated) {
      const existingPromo = await prisma.promoCode.findFirst({ where: { offerId: id } });
      const code = (body.couponCode === undefined ? updated.couponCode : body.couponCode)?.trim() || null;
      if (!code) {
        if (existingPromo) {
          await prisma.promoCode.update({ where: { id: existingPromo.id }, data: { active: false } });
        }
      } else {
        const promoData = {
          code,
          discountType: updated.discountType,
          discountValue: updated.discountValue,
          validFrom: updated.validFrom,
          validUntil: updated.validUntil,
          active: updated.status === OfferStatus.ACTIVE,
        };
        if (existingPromo) {
          await prisma.promoCode.update({ where: { id: existingPromo.id }, data: promoData });
        } else {
          await prisma.promoCode.create({ data: { offerId: id, ...promoData } });
        }
      }
    }
  }

  return loadOffer(id);
};

export const writeOfferAudit = async (
  adminId: string,
  adminLabel: string,
  eventType: string,
  offerId: string,
  description: string
) => {
  await prisma.auditLog.create({
    data: {
      eventType,
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType: 'Offer',
      subjectId: offerId,
      description,
    },
  });
};

export { OfferStatus, OfferType, DiscountType };
