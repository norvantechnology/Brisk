import { CmsPublishStatus, PrismaClient } from '@prisma/client';

const seedCustomersPage = async (prisma: PrismaClient) => {
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

const seedTradersPage = async (prisma: PrismaClient) => {
  const page = await prisma.cmsMarketingPage.upsert({
    where: { slug: 'traders' },
    update: { title: 'For Traders', status: CmsPublishStatus.PUBLISHED },
    create: {
      slug: 'traders',
      title: 'For Traders',
      status: CmsPublishStatus.PUBLISHED,
    },
  });

  await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'trader_hero' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'trader_hero',
      sectionKey: 'trader_hero',
      title: 'Grow Your Business with BRISK',
      subtitle: 'Connect with customers looking for trusted professionals',
      description:
        'Find local jobs, submit competitive offers and build your professional reputation.',
      primaryButtonText: 'Join BRISK',
      primaryButtonUrl: '/register',
      secondaryButtonText: 'Learn More',
      secondaryButtonUrl: '/how-it-works',
      backgroundImage: 'trader-hero.jpg',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 1,
    },
  });

  const benefits = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'trader_benefits' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'trader_benefits',
      sectionKey: 'trader_benefits',
      title: 'Why Traders Choose BRISK',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 2,
    },
  });

  const benefitItems = [
    {
      title: 'Find Local Jobs',
      description:
        'Discover relevant jobs in your local area based on your trade and availability.',
      icon: 'location-search.svg',
      sortOrder: 1,
    },
    {
      title: 'Submit Offers',
      description: 'Submit competitive offers directly to customers and win more work.',
      icon: 'offer.svg',
      sortOrder: 2,
    },
    {
      title: 'Build Reputation',
      description: 'Earn ratings and reviews that help you win future jobs.',
      icon: 'reputation.svg',
      sortOrder: 3,
    },
    {
      title: 'Grow Business',
      description: 'Scale your trade with steady local demand and transparent workflows.',
      icon: 'growth.svg',
      sortOrder: 4,
    },
  ];

  for (const item of benefitItems) {
    const existing = await prisma.cmsPageSectionItem.findFirst({
      where: { sectionId: benefits.id, title: item.title },
    });
    if (!existing) {
      await prisma.cmsPageSectionItem.create({
        data: { sectionId: benefits.id, ...item, status: CmsPublishStatus.PUBLISHED },
      });
    }
  }

  const workflow = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'trader_workflow' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'trader_workflow',
      sectionKey: 'trader_workflow',
      title: 'How It Works for Traders',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 3,
    },
  });

  const workflowSteps = [
    {
      stepNumber: 1,
      title: 'Find Local Jobs',
      description: 'Browse jobs that match your trade, location and availability.',
      icon: 'search-job.svg',
      sortOrder: 1,
    },
    {
      stepNumber: 2,
      title: 'Review Job Details',
      description: 'Understand customer requirements before you quote.',
      icon: 'review-job.svg',
      sortOrder: 2,
    },
    {
      stepNumber: 3,
      title: 'Submit Your Offer',
      description: 'Review customer requirements and submit your best offer.',
      icon: 'submit-offer.svg',
      sortOrder: 3,
    },
    {
      stepNumber: 4,
      title: 'Get Selected',
      description: 'Customers compare offers and choose the best fit.',
      icon: 'selected.svg',
      sortOrder: 4,
    },
    {
      stepNumber: 5,
      title: 'Complete The Job',
      description: 'Deliver quality work and keep customers updated.',
      icon: 'complete-job.svg',
      sortOrder: 5,
    },
    {
      stepNumber: 6,
      title: 'Build Your Reputation',
      description: 'Collect reviews and grow your profile on BRISK.',
      icon: 'build-reputation.svg',
      sortOrder: 6,
    },
  ];

  for (const step of workflowSteps) {
    const existing = await prisma.cmsPageSectionItem.findFirst({
      where: { sectionId: workflow.id, stepNumber: step.stepNumber },
    });
    if (!existing) {
      await prisma.cmsPageSectionItem.create({
        data: { sectionId: workflow.id, ...step, status: CmsPublishStatus.PUBLISHED },
      });
    }
  }

  const potential = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'professional_potential' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'professional_potential',
      sectionKey: 'professional_potential',
      title: 'Unlock Your Professional Potential',
      description:
        'BRISK helps professionals find quality work and build long-term customer relationships.',
      backgroundImage: 'professional-potential.jpg',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 4,
    },
  });

  const potentialItems = [
    {
      title: 'More Local Opportunities',
      description: 'Access a steady stream of jobs in your service area.',
      icon: 'opportunities.svg',
      sortOrder: 1,
    },
    {
      title: 'Better Customer Connections',
      description: 'Communicate directly with customers through BRISK.',
      icon: 'connections.svg',
      sortOrder: 2,
    },
    {
      title: 'Transparent Job Process',
      description: 'Clear scope, pricing, and milestones from start to finish.',
      icon: 'transparent.svg',
      sortOrder: 3,
    },
    {
      title: 'Professional Growth',
      description: 'Build your brand with verified credentials and reviews.',
      icon: 'growth.svg',
      sortOrder: 4,
    },
  ];

  for (const item of potentialItems) {
    const existing = await prisma.cmsPageSectionItem.findFirst({
      where: { sectionId: potential.id, title: item.title },
    });
    if (!existing) {
      await prisma.cmsPageSectionItem.create({
        data: { sectionId: potential.id, ...item, status: CmsPublishStatus.PUBLISHED },
      });
    }
  }

  await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'trader_cta' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'trader_cta',
      sectionKey: 'trader_cta',
      title: 'Ready to Grow Your Business?',
      description: 'Join BRISK and start connecting with customers in your local area.',
      primaryButtonText: 'Join BRISK',
      primaryButtonUrl: '/register',
      secondaryButtonText: 'Download App',
      secondaryButtonUrl: '/download',
      backgroundImage: 'trader-cta.jpg',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 5,
    },
  });
};

import { seedHomePage } from './home.seed';

export const seedMarketingPages = async (prisma: PrismaClient) => {
  await seedCustomersPage(prisma);
  await seedTradersPage(prisma);
  await seedHomePage(prisma);
};
