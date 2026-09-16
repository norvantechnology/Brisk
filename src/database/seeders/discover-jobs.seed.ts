import {
  JobQuoteType,
  JobStatus,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { logger } from '../../utils/logger';

/** Mobile QA coords — Himmatnagar / Gujarat area */
const ORIGIN = { lat: 24.1724333, lng: 72.43458 };

/**
 * Seeds 3 PUBLISHED Discover jobs within ~5km of ORIGIN:
 * 1) Normal (quote / budget) — badge null
 * 2) Site Visit — badge "Site Visit"
 * 3) Reschedule — site visit with past scheduledDate → badge "Reschedule"
 *
 * Idempotent via stable jobRef values.
 */
export async function seedDiscoverJobs(prisma: PrismaClient): Promise<void> {
  const customer = await prisma.user.findFirst({
    where: { role: UserRole.CUSTOMER, email: 'customer@brisk.com' },
  });
  if (!customer) {
    logger.warn('⚠️ skip discover jobs seed — customer@brisk.com not found');
    return;
  }

  const category = await prisma.category.findFirst({
    where: { categoryCode: 'CAT-PLUMB' },
    include: {
      subcategories: { orderBy: { name: 'asc' }, take: 3 },
    },
  });
  if (!category || category.subcategories.length === 0) {
    logger.warn('⚠️ skip discover jobs seed — Plumbing category missing');
    return;
  }

  const subNormal = category.subcategories[0];
  const subSite =
    category.subcategories.find((s) => s.name.toLowerCase().includes('boiler')) ||
    category.subcategories[1] ||
    subNormal;

  // Ensure site-visit subcategory flag for realism
  await prisma.subcategory.update({
    where: { id: subSite.id },
    data: { siteVisitEnabled: true },
  });

  // Point demo trader at this region so Discover works without lat/lng too
  const traderUser = await prisma.user.findUnique({
    where: { email: 'trader@brisk.com' },
    include: { traderProfile: true },
  });
  if (traderUser?.traderProfile) {
    await prisma.trader.update({
      where: { id: traderUser.traderProfile.id },
      data: {
        serviceCenterLat: ORIGIN.lat,
        serviceCenterLng: ORIGIN.lng,
        serviceRadiusKm: 50,
        serviceCenterLabel: 'Himmatnagar / Gujarat (QA)',
        categoryId: category.id,
      },
    });
    await prisma.traderCategory.upsert({
      where: {
        traderId_categoryId: {
          traderId: traderUser.traderProfile.id,
          categoryId: category.id,
        },
      },
      create: {
        traderId: traderUser.traderProfile.id,
        categoryId: category.id,
      },
      update: {},
    });
  }

  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 3);
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);

  const jobs = [
    {
      jobRef: 'DISCOVER-QA-NORMAL',
      title: 'Kitchen Tap Replacement',
      description:
        'Replace leaking kitchen mixer tap. Parts can be supplied by trader. Normal quote job for Discover QA.',
      quoteType: JobQuoteType.BUDGET_RANGE,
      siteVisitRequested: false,
      siteVisitFee: null as number | null,
      minBudget: 800,
      maxBudget: 1500,
      serviceCharge: null as number | null,
      scheduledDate: futureDate,
      latitude: ORIGIN.lat + 0.008, // ~0.9 km
      longitude: ORIGIN.lng + 0.006,
      city: 'Himmatnagar',
      addressLine: '12 Station Road',
      postcode: '383001',
      subcategoryId: subNormal.id,
      timeSlot: 'Morning',
      durationLabel: '2 Hours',
    },
    {
      jobRef: 'DISCOVER-QA-SITEVISIT',
      title: 'Boiler Inspection — Site Visit',
      description:
        'Need an on-site boiler inspection and quote. Site visit fee applies. Use Discover site-visit date/time flow.',
      quoteType: JobQuoteType.ONSITE,
      siteVisitRequested: true,
      siteVisitFee: 499,
      minBudget: null,
      maxBudget: null,
      serviceCharge: null,
      scheduledDate: futureDate,
      latitude: ORIGIN.lat - 0.01, // ~1.1 km
      longitude: ORIGIN.lng + 0.012,
      city: 'Himmatnagar',
      addressLine: '45 Civil Hospital Road',
      postcode: '383001',
      subcategoryId: subSite.id,
      timeSlot: 'Afternoon',
      durationLabel: '1 Hour',
    },
    {
      jobRef: 'DISCOVER-QA-RESCHEDULE',
      title: 'Drainage Survey — Reschedule Needed',
      description:
        'Site visit was missed / past preferred date. Discover should show Reschedule badge for this job.',
      quoteType: JobQuoteType.ONSITE,
      siteVisitRequested: true,
      siteVisitFee: 350,
      minBudget: null,
      maxBudget: null,
      serviceCharge: null,
      scheduledDate: pastDate,
      latitude: ORIGIN.lat + 0.015, // ~1.7 km
      longitude: ORIGIN.lng - 0.008,
      city: 'Idar Road',
      addressLine: '8 Bypass Circle',
      postcode: '383110',
      subcategoryId: subSite.id,
      timeSlot: 'Anytime',
      durationLabel: '1 Hour',
    },
  ];

  for (const j of jobs) {
    await prisma.job.upsert({
      where: { jobRef: j.jobRef },
      create: {
        jobRef: j.jobRef,
        customerId: customer.id,
        categoryId: category.id,
        subcategoryId: j.subcategoryId,
        title: j.title,
        description: j.description,
        status: JobStatus.PUBLISHED,
        traderId: null,
        quoteType: j.quoteType,
        siteVisitRequested: j.siteVisitRequested,
        siteVisitFee: j.siteVisitFee,
        minBudget: j.minBudget,
        maxBudget: j.maxBudget,
        serviceCharge: j.serviceCharge,
        scheduledDate: j.scheduledDate,
        latitude: j.latitude,
        longitude: j.longitude,
        city: j.city,
        addressLine: j.addressLine,
        postcode: j.postcode,
        timeSlot: j.timeSlot,
        durationLabel: j.durationLabel,
        phoneNumber: '+919876543210',
      },
      update: {
        customerId: customer.id,
        categoryId: category.id,
        subcategoryId: j.subcategoryId,
        title: j.title,
        description: j.description,
        status: JobStatus.PUBLISHED,
        traderId: null,
        quoteType: j.quoteType,
        siteVisitRequested: j.siteVisitRequested,
        siteVisitFee: j.siteVisitFee,
        minBudget: j.minBudget,
        maxBudget: j.maxBudget,
        serviceCharge: j.serviceCharge,
        scheduledDate: j.scheduledDate,
        latitude: j.latitude,
        longitude: j.longitude,
        city: j.city,
        addressLine: j.addressLine,
        postcode: j.postcode,
        timeSlot: j.timeSlot,
        durationLabel: j.durationLabel,
      },
    });
  }

  logger.info(
    `✅ Discover QA jobs seeded near ${ORIGIN.lat},${ORIGIN.lng} (NORMAL / SITEVISIT / RESCHEDULE)`
  );
}
