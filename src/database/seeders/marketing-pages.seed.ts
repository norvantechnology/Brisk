import { CmsPublishStatus, PrismaClient } from '@prisma/client';

export const seedMarketingPages = async (prisma: PrismaClient) => {
  const page = await prisma.cmsMarketingPage.upsert({
    where: { slug: 'customers' },
    update: { title: 'For Customers', status: CmsPublishStatus.PUBLISHED },
    create: {
      slug: 'customers',
      title: 'For Customers',
      status: CmsPublishStatus.PUBLISHED,
    },
  });

  const hero = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'hero' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'hero',
      sectionKey: 'hero',
      title: 'For Customers',
      description:
        'Post jobs, receive competitive offers, and hire verified traders with total transparency.',
      primaryButtonText: 'Download App',
      primaryButtonUrl: '/download',
      secondaryButtonText: 'Find A Trader',
      secondaryButtonUrl: '/traders',
      backgroundVideo: 'customer-hero.mp4',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 1,
    },
  });

  const whyCustomers = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'why-customers' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'feature_grid',
      sectionKey: 'why-customers',
      title: 'Why Customers Love BRISK',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 2,
    },
  });

  const whyItems = [
    {
      title: 'Receive Multiple Offers',
      description:
        'Traders compete for your business, ensuring you receive optimized competitive quotes tailored to your scope.',
      icon: 'multiple-offers.svg',
      sortOrder: 1,
    },
    {
      title: 'Compare Traders',
      description: 'Review ratings, experience, and pricing before you hire.',
      icon: 'compare-traders.svg',
      sortOrder: 2,
    },
    {
      title: 'Track Progress',
      description: 'Follow your job from quote to completion in one place.',
      icon: 'track-progress.svg',
      sortOrder: 3,
    },
    {
      title: 'Transparent Workflow',
      description: 'Clear pricing, secure payments, and verified professionals.',
      icon: 'transparent-workflow.svg',
      sortOrder: 4,
    },
  ];

  for (const item of whyItems) {
    const existing = await prisma.cmsPageSectionItem.findFirst({
      where: { sectionId: whyCustomers.id, title: item.title },
    });
    if (!existing) {
      await prisma.cmsPageSectionItem.create({
        data: { sectionId: whyCustomers.id, ...item, status: CmsPublishStatus.PUBLISHED },
      });
    }
  }

  const journey = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'journey' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'journey',
      sectionKey: 'journey',
      title: 'Customer Journey',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 3,
    },
  });

  const journeySteps = [
    {
      stepNumber: 1,
      title: 'Schedule Job',
      description: 'List your job details and choose a suitable time.',
      icon: 'schedule.svg',
      sortOrder: 1,
    },
    {
      stepNumber: 2,
      title: 'Quote Received',
      description: 'Receive quotes from verified local traders.',
      icon: 'quote.svg',
      sortOrder: 2,
    },
    {
      stepNumber: 3,
      title: 'Offers Received',
      description: 'Compare offers and pick the best fit.',
      icon: 'offers.svg',
      sortOrder: 3,
    },
    {
      stepNumber: 4,
      title: 'Job Accepted',
      description: 'Confirm your booking and secure payment.',
      icon: 'accepted.svg',
      sortOrder: 4,
    },
    {
      stepNumber: 5,
      title: 'Job Completed',
      description: 'Rate your experience and close the job.',
      icon: 'completed.svg',
      sortOrder: 5,
    },
  ];

  for (const step of journeySteps) {
    const existing = await prisma.cmsPageSectionItem.findFirst({
      where: { sectionId: journey.id, stepNumber: step.stepNumber },
    });
    if (!existing) {
      await prisma.cmsPageSectionItem.create({
        data: { sectionId: journey.id, ...step, status: CmsPublishStatus.PUBLISHED },
      });
    }
  }

  const peaceOfMind = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'peace-of-mind' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'feature_grid',
      sectionKey: 'peace-of-mind',
      title: 'Features Built For Peace of Mind',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 4,
    },
  });

  const peaceItems = [
    {
      title: 'Vetted Local Network',
      description:
        'Our verification team cross-references licenses, insurance coverage, and credit references.',
      icon: 'verified.svg',
      sortOrder: 1,
    },
    {
      title: 'Secured Interactions',
      description: 'Your payments and communications are protected end-to-end.',
      icon: 'secured.svg',
      sortOrder: 2,
    },
    {
      title: 'Real-time Alerts',
      description: 'Stay updated on quotes, bookings, and job progress.',
      icon: 'alerts.svg',
      sortOrder: 3,
    },
  ];

  for (const item of peaceItems) {
    const existing = await prisma.cmsPageSectionItem.findFirst({
      where: { sectionId: peaceOfMind.id, title: item.title },
    });
    if (!existing) {
      await prisma.cmsPageSectionItem.create({
        data: { sectionId: peaceOfMind.id, ...item, status: CmsPublishStatus.PUBLISHED },
      });
    }
  }

  await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'app-download' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'cta',
      sectionKey: 'app-download',
      title: 'Download the BRISK App',
      description: 'Post jobs and manage bookings from your phone.',
      primaryButtonText: 'Download App',
      primaryButtonUrl: '/download',
      appStoreUrl: 'https://apps.apple.com/',
      googlePlayUrl: 'https://play.google.com/',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 5,
    },
  });

  // silence unused variable warning for hero if needed
  void hero;
};
