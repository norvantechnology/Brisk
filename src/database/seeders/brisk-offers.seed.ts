/**
 * Ensures active PLATFORM (Brisk Offers) rows exist for GET /brisk-offers.
 * Run: npx ts-node src/database/seeders/brisk-offers.seed.ts
 * Or invoke seedBriskOffers() from the main seeder / one-off on VPS.
 */
import { DiscountType, OfferCtaAction, OfferStatus, OfferType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BRISK_OFFERS = [
  {
    couponCode: 'BRISK10HOME',
    title: '10% off Home Services',
    shortDescription: 'Save on verified local home jobs this month.',
    fullDescription: 'Valid on selected home service categories. One claim per customer.',
    badgeTag: 'special_local_promo',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    discountLabel: '10% OFF',
    ctaAction: OfferCtaAction.CLAIM,
    ctaLabel: 'Claim Offer',
  },
  {
    couponCode: 'BRISK15CLEAN',
    title: '15% off Cleaning',
    shortDescription: 'Book a cleaner and save with BRISK.',
    fullDescription: 'Applies to cleaning subcategories. Cannot combine with other Brisk promos.',
    badgeTag: 'limited_availability',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 15,
    discountLabel: '15% OFF',
    ctaAction: OfferCtaAction.CLAIM,
    ctaLabel: 'Claim Offer',
  },
  {
    couponCode: 'SITEVISIT5',
    title: '€5 off Site Visit',
    shortDescription: 'Flat discount on your site visit fee.',
    fullDescription: 'Use at Payment Details when paying a site visit fee.',
    badgeTag: 'special_local_promo',
    discountType: DiscountType.FLAT,
    discountValue: 5,
    discountLabel: '€5 OFF',
    ctaAction: OfferCtaAction.CLAIM,
    ctaLabel: 'Claim Offer',
  },
  {
    couponCode: 'FREEVISIT',
    title: 'Free first site visit',
    shortDescription: 'Inspection fee waived for first-time bookers.',
    fullDescription: 'Applies when the linked offer / job uses FREE_SERVICE site visit.',
    badgeTag: 'limited_availability',
    discountType: DiscountType.FREE_SERVICE,
    discountValue: 0,
    discountLabel: 'FREE VISIT',
    ctaAction: OfferCtaAction.BOOK_INSPECTION,
    ctaLabel: 'Book Inspection',
  },
  {
    couponCode: 'BRISK20PLUMB',
    title: '20% off Plumbing',
    shortDescription: 'Seasonal plumbing discount on BRISK.',
    fullDescription: 'Active platform promo for plumbing jobs. Claim then apply at checkout if prompted.',
    badgeTag: 'special_local_promo',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 20,
    discountLabel: '20% OFF',
    ctaAction: OfferCtaAction.CLAIM,
    ctaLabel: 'Claim Offer',
  },
];

export const seedBriskOffers = async () => {
  const validFrom = new Date('2026-01-01T00:00:00.000Z');
  const validUntil = new Date('2027-12-31T23:59:59.000Z');

  // Keep existing PLATFORM offers visible longer + add badges where missing.
  await prisma.offer.updateMany({
    where: { offerType: OfferType.PLATFORM, status: OfferStatus.ACTIVE },
    data: { validFrom, validUntil },
  });

  const category = await prisma.category.findFirst({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
    select: { id: true },
  });

  for (const item of BRISK_OFFERS) {
    const existing = await prisma.offer.findFirst({
      where: { couponCode: item.couponCode },
    });
    if (existing) {
      await prisma.offer.update({
        where: { id: existing.id },
        data: {
          offerType: OfferType.PLATFORM,
          title: item.title,
          shortDescription: item.shortDescription,
          fullDescription: item.fullDescription,
          badgeTag: item.badgeTag,
          discountType: item.discountType,
          discountValue: item.discountValue,
          discountLabel: item.discountLabel,
          ctaAction: item.ctaAction,
          ctaLabel: item.ctaLabel,
          status: OfferStatus.ACTIVE,
          validFrom,
          validUntil,
          traderId: null,
        },
      });
      continue;
    }

    const count = await prisma.offer.count();
    const offer = await prisma.offer.create({
      data: {
        offerCode: `OFF-B${(count + 2001).toString()}`,
        offerType: OfferType.PLATFORM,
        title: item.title,
        couponCode: item.couponCode,
        shortDescription: item.shortDescription,
        fullDescription: item.fullDescription,
        badgeTag: item.badgeTag,
        discountType: item.discountType,
        discountValue: item.discountValue,
        currencyCode: 'EUR',
        discountLabel: item.discountLabel,
        validFrom,
        validUntil,
        status: OfferStatus.ACTIVE,
        ctaAction: item.ctaAction,
        ctaLabel: item.ctaLabel,
      },
    });

    if (category) {
      await prisma.offerCategory.create({
        data: { offerId: offer.id, categoryId: category.id },
      });
    }

    await prisma.promoCode.upsert({
      where: { code: item.couponCode },
      update: {
        offerId: offer.id,
        discountType: item.discountType,
        discountValue: item.discountValue,
        validFrom,
        validUntil,
        active: true,
      },
      create: {
        offerId: offer.id,
        code: item.couponCode,
        discountType: item.discountType,
        discountValue: item.discountValue,
        currencyCode: 'EUR',
        validFrom,
        validUntil,
        active: true,
      },
    });
  }

  console.log(`Brisk PLATFORM offers ready (${BRISK_OFFERS.length} curated + existing refreshed).`);
};

if (require.main === module) {
  seedBriskOffers()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
