import { CmsPublishStatus, PrismaClient } from '@prisma/client';
import { seedHomePage } from './home.seed';

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

const seedAboutBriskPage = async (prisma: PrismaClient) => {
  const page = await prisma.cmsMarketingPage.upsert({
    where: { slug: 'about-brisk' },
    update: { title: 'About Us', status: CmsPublishStatus.PUBLISHED },
    create: {
      slug: 'about-brisk',
      title: 'About Us',
      status: CmsPublishStatus.PUBLISHED,
    },
  });

  await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'hero' } },
    update: {
      title: 'About BRISK',
      subtitle: 'Making Things Quicker',
      description: 'BRISK connects customers with verified local traders across Ireland.',
      primaryButtonText: 'Get Started',
      primaryButtonUrl: '/customers',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 1,
    },
    create: {
      pageId: page.id,
      sectionType: 'hero',
      sectionKey: 'hero',
      title: 'About BRISK',
      subtitle: 'Making Things Quicker',
      description: 'BRISK connects customers with verified local traders across Ireland.',
      primaryButtonText: 'Get Started',
      primaryButtonUrl: '/customers',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 1,
    },
  });

  await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'mission' } },
    update: {
      title: 'Our Mission',
      description:
        'To make hiring trusted trade professionals simple, transparent, and fast for every household and business.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 2,
    },
    create: {
      pageId: page.id,
      sectionType: 'content',
      sectionKey: 'mission',
      title: 'Our Mission',
      description:
        'To make hiring trusted trade professionals simple, transparent, and fast for every household and business.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 2,
    },
  });

  await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'vision' } },
    update: {
      title: 'Our Vision',
      description:
        'A marketplace where quality work, fair pricing, and verified professionals are the standard.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 3,
    },
    create: {
      pageId: page.id,
      sectionType: 'content',
      sectionKey: 'vision',
      title: 'Our Vision',
      description:
        'A marketplace where quality work, fair pricing, and verified professionals are the standard.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 3,
    },
  });

  const core = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'core_values' } },
    update: {
      title: 'Core Values',
      description: 'The principles that guide BRISK every day.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 4,
    },
    create: {
      pageId: page.id,
      sectionType: 'feature_grid',
      sectionKey: 'core_values',
      title: 'Core Values',
      description: 'The principles that guide BRISK every day.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 4,
    },
  });

  const values = [
    { title: 'Trust', description: 'Verified traders and transparent workflows.', sortOrder: 1 },
    { title: 'Speed', description: 'Faster hiring and clearer job progress.', sortOrder: 2 },
    { title: 'Quality', description: 'Ratings and reviews that keep standards high.', sortOrder: 3 },
    { title: 'Fairness', description: 'Competitive offers that work for both sides.', sortOrder: 4 },
  ];
  for (const item of values) {
    const existing = await prisma.cmsPageSectionItem.findFirst({
      where: { sectionId: core.id, title: item.title },
    });
    if (!existing) {
      await prisma.cmsPageSectionItem.create({
        data: {
          sectionId: core.id,
          title: item.title,
          description: item.description,
          sortOrder: item.sortOrder,
          status: CmsPublishStatus.PUBLISHED,
        },
      });
    }
  }
};

const seedContactBriskPage = async (prisma: PrismaClient) => {
  const page = await prisma.cmsMarketingPage.upsert({
    where: { slug: 'contact-brisk' },
    update: { title: 'Contact Us', status: CmsPublishStatus.PUBLISHED },
    create: {
      slug: 'contact-brisk',
      title: 'Contact Us',
      status: CmsPublishStatus.PUBLISHED,
    },
  });

  await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'hero' } },
    update: {
      title: 'Contact Us',
      subtitle: 'We are here to help',
      description: 'Reach the BRISK team for support, partnerships, or general enquiries.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 1,
    },
    create: {
      pageId: page.id,
      sectionType: 'hero',
      sectionKey: 'hero',
      title: 'Contact Us',
      subtitle: 'We are here to help',
      description: 'Reach the BRISK team for support, partnerships, or general enquiries.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 1,
    },
  });

  await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'contact_info' } },
    update: {
      title: 'Get in Touch',
      description: 'Send a message and our team will respond as soon as possible.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 2,
    },
    create: {
      pageId: page.id,
      sectionType: 'contact_info',
      sectionKey: 'contact_info',
      title: 'Get in Touch',
      description: 'Send a message and our team will respond as soon as possible.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 2,
    },
  });

  const help = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'help_desks' } },
    update: {
      title: 'Help Desks',
      description: 'Choose the right channel for your question.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 3,
    },
    create: {
      pageId: page.id,
      sectionType: 'feature_grid',
      sectionKey: 'help_desks',
      title: 'Help Desks',
      description: 'Choose the right channel for your question.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 3,
    },
  });

  await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'map' } },
    update: {
      title: 'Find Us',
      description: 'BRISK — Ireland',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 4,
    },
    create: {
      pageId: page.id,
      sectionType: 'map',
      sectionKey: 'map',
      title: 'Find Us',
      description: 'BRISK — Ireland',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 4,
    },
  });

  const desks = [
    { title: 'Customer Support', description: 'Help with jobs, bookings, and payments.', sortOrder: 1 },
    { title: 'Trader Support', description: 'Onboarding, offers, and account help.', sortOrder: 2 },
    { title: 'Partnerships', description: 'Business and media enquiries.', sortOrder: 3 },
  ];
  for (const item of desks) {
    const existing = await prisma.cmsPageSectionItem.findFirst({
      where: { sectionId: help.id, title: item.title },
    });
    if (!existing) {
      await prisma.cmsPageSectionItem.create({
        data: {
          sectionId: help.id,
          title: item.title,
          description: item.description,
          sortOrder: item.sortOrder,
          status: CmsPublishStatus.PUBLISHED,
        },
      });
    }
  }
};

const seedHowItWorksPage = async (prisma: PrismaClient) => {
  const page = await prisma.cmsMarketingPage.upsert({
    where: { slug: 'how-it-works' },
    update: { title: 'How It Works', status: CmsPublishStatus.PUBLISHED },
    create: {
      slug: 'how-it-works',
      title: 'How It Works',
      status: CmsPublishStatus.PUBLISHED,
    },
  });

  const hero = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'hero' } },
    update: {
      title: 'How BRISK Works',
      subtitle: 'Transparent Marketplace',
      description:
        'A transparent process connecting customers and traders from job posting to completion.',
      primaryButtonText: 'Explore Steps',
      primaryButtonUrl: '#timeline',
      secondaryButtonText: 'Get Support',
      secondaryButtonUrl: '/contact-brisk',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 1,
    },
    create: {
      pageId: page.id,
      sectionType: 'hero',
      sectionKey: 'hero',
      title: 'How BRISK Works',
      subtitle: 'Transparent Marketplace',
      description:
        'A transparent process connecting customers and traders from job posting to completion.',
      primaryButtonText: 'Explore Steps',
      primaryButtonUrl: '#timeline',
      secondaryButtonText: 'Get Support',
      secondaryButtonUrl: '/contact-brisk',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 1,
    },
  });

  const heroOrbitSteps = [
    { stepNumber: 1, title: 'Post Job', sortOrder: 1 },
    { stepNumber: 2, title: 'Receive Offers', sortOrder: 2 },
    { stepNumber: 3, title: 'Negotiate', sortOrder: 3 },
    { stepNumber: 4, title: 'Agreement', sortOrder: 4 },
    { stepNumber: 5, title: 'Work Started', sortOrder: 5 },
    { stepNumber: 6, title: 'Completed', sortOrder: 6 },
  ];

  for (const step of heroOrbitSteps) {
    const existing = await prisma.cmsPageSectionItem.findFirst({
      where: { sectionId: hero.id, stepNumber: step.stepNumber },
    });
    if (!existing) {
      await prisma.cmsPageSectionItem.create({
        data: { sectionId: hero.id, ...step, status: CmsPublishStatus.PUBLISHED },
      });
    }
  }

  const roadmap = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'interactive_roadmap' } },
    update: {
      title: 'The Step-By-Step Journey',
      subtitle: 'Interactive Roadmap',
      description:
        'Follow a clear, governed pathway that ensures safety, quality, and fair pricing for everyone.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 2,
    },
    create: {
      pageId: page.id,
      sectionType: 'journey',
      sectionKey: 'interactive_roadmap',
      title: 'The Step-By-Step Journey',
      subtitle: 'Interactive Roadmap',
      description:
        'Follow a clear, governed pathway that ensures safety, quality, and fair pricing for everyone.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 2,
    },
  });

  const roadmapSteps = [
    {
      stepNumber: 1,
      title: 'Publish Job',
      description:
        'Describe your project, add images, specify timelines, and post it to our verified trader network instantly.',
      sortOrder: 1,
    },
    {
      stepNumber: 2,
      title: 'Receive Offers',
      description: 'Local traders examine the specifications and send personalized quotes.',
      sortOrder: 2,
    },
    {
      stepNumber: 3,
      title: 'Direct Chat',
      description: 'Negotiate terms, modify scopes, and discuss milestones securely.',
      sortOrder: 3,
    },
    {
      stepNumber: 4,
      title: 'Project Sign-off',
      description: 'Accept a proposal to lock in scope, prices, and completion dates.',
      sortOrder: 4,
    },
  ];

  for (const step of roadmapSteps) {
    const existing = await prisma.cmsPageSectionItem.findFirst({
      where: { sectionId: roadmap.id, stepNumber: step.stepNumber },
    });
    if (!existing) {
      await prisma.cmsPageSectionItem.create({
        data: { sectionId: roadmap.id, ...step, status: CmsPublishStatus.PUBLISHED },
      });
    }
  }

  const roleWorkflows = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'role_workflows' } },
    update: {
      title: 'Tailored Journeys for Both Sides',
      subtitle: 'Role Workflows',
      description:
        'How the BRISK app guides each stakeholder from first login to final job completion.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 3,
    },
    create: {
      pageId: page.id,
      sectionType: 'role_workflows',
      sectionKey: 'role_workflows',
      title: 'Tailored Journeys for Both Sides',
      subtitle: 'Role Workflows',
      description:
        'How the BRISK app guides each stakeholder from first login to final job completion.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 3,
    },
  });

  /**
   * Customer / Trader journey cards + steps (How It Works screenshot).
   * Section title/description = card heading; items[] = numbered steps (admin-manageable).
   */
  const journeySections = [
    {
      sectionKey: 'customer_journey',
      sectionType: 'journey',
      sortOrder: 31,
      title: 'Customer Journey',
      subtitle: 'For Customers',
      description: 'Hire with confidence, manage quotes, and rate with peace of mind.',
      label: 'For Customers',
      role: 'customer',
      steps: [
        {
          stepNumber: 1,
          title: 'Define requirements',
          description: 'Use our structured form to describe what service you need done.',
          sortOrder: 1,
        },
        {
          stepNumber: 2,
          title: 'Compare quotes',
          description: 'Filter traders by ratings, experience, price, and portfolios.',
          sortOrder: 2,
        },
        {
          stepNumber: 3,
          title: 'Secure hire',
          description: 'Accept the offer. Milestones and scope are securely stored.',
          sortOrder: 3,
        },
      ],
    },
    {
      sectionKey: 'trader_journey',
      sectionType: 'journey',
      sortOrder: 32,
      title: 'Trader Journey',
      subtitle: 'For Traders',
      description: 'Find genuine leads, win deals, and build a premium digital reputation.',
      label: 'For Traders',
      role: 'trader',
      steps: [
        {
          stepNumber: 1,
          title: 'Browse verified leads',
          description: 'See detailed job cards matching your skills.',
          sortOrder: 1,
        },
        {
          stepNumber: 2,
          title: 'Send structured proposals',
          description: 'Draft detailed estimates and outline terms.',
          sortOrder: 2,
        },
        {
          stepNumber: 3,
          title: 'Collect payments & reviews',
          description: 'Build your profile credibility.',
          sortOrder: 3,
        },
      ],
    },
  ];

  for (const journey of journeySections) {
    const section = await prisma.cmsPageSection.upsert({
      where: { pageId_sectionKey: { pageId: page.id, sectionKey: journey.sectionKey } },
      update: {
        title: journey.title,
        subtitle: journey.subtitle,
        description: journey.description,
        status: CmsPublishStatus.PUBLISHED,
        sortOrder: journey.sortOrder,
      },
      create: {
        pageId: page.id,
        sectionType: journey.sectionType,
        sectionKey: journey.sectionKey,
        title: journey.title,
        subtitle: journey.subtitle,
        description: journey.description,
        status: CmsPublishStatus.PUBLISHED,
        sortOrder: journey.sortOrder,
      },
    });

    for (const step of journey.steps) {
      const existing = await prisma.cmsPageSectionItem.findFirst({
        where: { sectionId: section.id, stepNumber: step.stepNumber },
      });
      if (existing) {
        await prisma.cmsPageSectionItem.update({
          where: { id: existing.id },
          data: {
            title: step.title,
            description: step.description,
            sortOrder: step.sortOrder,
            status: CmsPublishStatus.PUBLISHED,
            metadata: { role: journey.role, label: journey.label },
          },
        });
      } else {
        await prisma.cmsPageSectionItem.create({
          data: {
            sectionId: section.id,
            stepNumber: step.stepNumber,
            title: step.title,
            description: step.description,
            sortOrder: step.sortOrder,
            status: CmsPublishStatus.PUBLISHED,
            metadata: { role: journey.role, label: journey.label },
          },
        });
      }
    }

    // Legacy: keep one summary card under role_workflows for older frontends (no nested steps).
    const legacyCard = await prisma.cmsPageSectionItem.findFirst({
      where: { sectionId: roleWorkflows.id, title: journey.title },
    });
    if (legacyCard) {
      await prisma.cmsPageSectionItem.update({
        where: { id: legacyCard.id },
        data: {
          description: journey.description,
          sortOrder: journey.role === 'customer' ? 1 : 2,
          status: CmsPublishStatus.PUBLISHED,
          metadata: { role: journey.role, label: journey.label },
        },
      });
    } else {
      await prisma.cmsPageSectionItem.create({
        data: {
          sectionId: roleWorkflows.id,
          title: journey.title,
          description: journey.description,
          sortOrder: journey.role === 'customer' ? 1 : 2,
          status: CmsPublishStatus.PUBLISHED,
          metadata: { role: journey.role, label: journey.label },
        },
      });
    }
  }

  const governance = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'governance_layer' } },
    update: {
      title: 'A Governance Layer',
      subtitle: 'Trust Architecture',
      description:
        "BRISK isn't just a noticeboard. We govern each transaction to eliminate common friction points.",
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 4,
    },
    create: {
      pageId: page.id,
      sectionType: 'feature_grid',
      sectionKey: 'governance_layer',
      title: 'A Governance Layer',
      subtitle: 'Trust Architecture',
      description:
        "BRISK isn't just a noticeboard. We govern each transaction to eliminate common friction points.",
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 4,
    },
  });

  const governanceItems = [
    {
      title: 'Vetting & Verification',
      description:
        'Every trader undergoes background checks, license verification, and reference validation prior to active bidding.',
      icon: 'shield-check.svg',
      sortOrder: 1,
    },
    {
      title: 'Secured Communications',
      description:
        'Chats are saved on the platform, providing clear documentation of agreed terms.',
      icon: 'chat-secure.svg',
      sortOrder: 2,
    },
    {
      title: 'Protected Negotiations',
      description:
        'Mutually approved milestones govern releases, so traders know they will get paid.',
      icon: 'lock-milestone.svg',
      sortOrder: 3,
    },
    {
      title: 'Live Progress Tracking',
      description:
        'Receive status notifications, uploaded photos of milestones, and direct task updates.',
      icon: 'progress-clock.svg',
      sortOrder: 4,
    },
  ];

  for (const item of governanceItems) {
    const existing = await prisma.cmsPageSectionItem.findFirst({
      where: { sectionId: governance.id, title: item.title },
    });
    if (!existing) {
      await prisma.cmsPageSectionItem.create({
        data: { sectionId: governance.id, ...item, status: CmsPublishStatus.PUBLISHED },
      });
    }
  }
};

export const seedMarketingPages = async (prisma: PrismaClient) => {
  await seedCustomersPage(prisma);
  await seedTradersPage(prisma);
  await seedHomePage(prisma);
  await seedAboutBriskPage(prisma);
  await seedContactBriskPage(prisma);
  await seedHowItWorksPage(prisma);
};
