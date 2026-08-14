import { CmsPublishStatus, CmsTestimonialPageType, Prisma, PrismaClient } from '@prisma/client';

const PLACEHOLDER = 'https://brisk-next.netlify.app';

const upsertSectionItem = async (
  prisma: PrismaClient,
  sectionId: string,
  match: { title?: string; stepNumber?: number },
  data: {
    title?: string;
    description?: string;
    icon?: string;
    image?: string;
    stepNumber?: number;
    sortOrder: number;
    metadata?: Prisma.InputJsonValue;
  }
) => {
  const existing = await prisma.cmsPageSectionItem.findFirst({
    where: {
      sectionId,
      ...(match.title ? { title: match.title } : {}),
      ...(match.stepNumber !== undefined ? { stepNumber: match.stepNumber } : {}),
    },
  });

  if (!existing) {
    await prisma.cmsPageSectionItem.create({
      data: {
        sectionId,
        title: data.title,
        description: data.description,
        icon: data.icon,
        image: data.image,
        stepNumber: data.stepNumber,
        sortOrder: data.sortOrder,
        status: CmsPublishStatus.PUBLISHED,
        metadata: data.metadata ?? undefined,
      },
    });
  }
};

const removeLegacyHomeV2Page = async (prisma: PrismaClient) => {
  const legacy = await prisma.cmsMarketingPage.findUnique({ where: { slug: 'home-v2' } });
  if (!legacy) return;

  const home = await prisma.cmsMarketingPage.findUnique({ where: { slug: 'home' } });
  if (home) {
    await prisma.cmsMarketingPage.delete({ where: { id: legacy.id } });
  } else {
    await prisma.cmsMarketingPage.update({
      where: { id: legacy.id },
      data: { slug: 'home', title: 'Home' },
    });
  }
};

export const seedHomePage = async (prisma: PrismaClient) => {
  await removeLegacyHomeV2Page(prisma);

  const page = await prisma.cmsMarketingPage.upsert({
    where: { slug: 'home' },
    update: { title: 'Home', status: CmsPublishStatus.PUBLISHED },
    create: {
      slug: 'home',
      title: 'Home',
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
      title: 'The Future Of Local Trade Starts With Trust',
      description:
        'BRISK transforms local services into a structured digital marketplace where customers and traders connect, negotiate, agree, and complete work through a transparent and governed ecosystem.',
      backgroundVideo: `${PLACEHOLDER}/assets/videos/hero-video.mp4`,
      backgroundImage: `${PLACEHOLDER}/assets/images/hero-phone.png`,
      appStoreUrl: 'https://apps.apple.com/app/brisk',
      googlePlayUrl: 'https://play.google.com/store/apps/details?id=com.brisk',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 1,
    },
  });

  const heroBadges = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'hero_badges' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'badge_list',
      sectionKey: 'hero_badges',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 2,
    },
  });

  for (const badge of [
    { title: 'Verified Traders', icon: `${PLACEHOLDER}/assets/icons/verified-traders.svg`, sortOrder: 1 },
    { title: 'Secure Negotiation', icon: `${PLACEHOLDER}/assets/icons/secure-negotiation.svg`, sortOrder: 2 },
    { title: 'Transparent Process', icon: `${PLACEHOLDER}/assets/icons/transparent-process.svg`, sortOrder: 3 },
  ]) {
    await upsertSectionItem(prisma, heroBadges.id, { title: badge.title }, badge);
  }

  const jobProcess = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'job_process' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'workflow',
      sectionKey: 'job_process',
      title: 'From Job Post To Completion',
      description:
        'A transparent journey connecting customers and traders through every stage of the process.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 3,
    },
  });

  for (const step of [
    { stepNumber: 1, title: 'Review Job', description: 'Browse active listings matching your location and skills.', icon: `${PLACEHOLDER}/assets/icons/review-job.svg`, sortOrder: 1 },
    { stepNumber: 2, title: 'Quote Submit', description: 'Send personalized estimates with pricing and timeline details.', icon: `${PLACEHOLDER}/assets/icons/quote-submit.svg`, sortOrder: 2 },
    { stepNumber: 3, title: 'Job Accepted', description: 'Secure the booking with automatic digital contract activation.', icon: `${PLACEHOLDER}/assets/icons/job-accepted.svg`, sortOrder: 3 },
    { stepNumber: 4, title: 'Job Completed', description: 'Finish work and submit proof for payment release verification.', icon: `${PLACEHOLDER}/assets/icons/job-completed-trader.svg`, sortOrder: 4 },
  ]) {
    await upsertSectionItem(prisma, jobProcess.id, { stepNumber: step.stepNumber }, step);
  }

  const customerWorkflow = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'customer_workflow' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'workflow',
      sectionKey: 'customer_workflow',
      title: 'Customer Workflow',
      description: 'Every step from posting a job to successful completion.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 4,
    },
  });

  for (const step of [
    { stepNumber: 1, title: 'Schedule Job', description: 'List your job details and choose a suitable time.', icon: `${PLACEHOLDER}/assets/icons/schedule-job.svg`, sortOrder: 1 },
    { stepNumber: 2, title: 'Quote Received', description: 'Receive and compare quotes from interested traders.', icon: `${PLACEHOLDER}/assets/icons/quote-received.svg`, sortOrder: 2 },
    { stepNumber: 3, title: 'Offers Received', description: 'Review offers, discuss terms and select the best one.', icon: `${PLACEHOLDER}/assets/icons/offers-received.svg`, sortOrder: 3 },
    { stepNumber: 4, title: 'Job Accepted', description: 'Accept the offer and confirm the job agreement.', icon: `${PLACEHOLDER}/assets/icons/job-accepted-customer.svg`, sortOrder: 4 },
    { stepNumber: 5, title: 'Job Completed', description: "Job is completed successfully. You're all set!", icon: `${PLACEHOLDER}/assets/icons/job-completed-customer.svg`, sortOrder: 5 },
  ]) {
    await upsertSectionItem(prisma, customerWorkflow.id, { stepNumber: step.stepNumber }, step);
  }

  const connectedMarketplace = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'connected_marketplace' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'feature_cards',
      sectionKey: 'connected_marketplace',
      title: 'A Connected Marketplace',
      description:
        'Every element of the BRISK ecosystem works together to create a seamless, trusted experience.',
      primaryButtonText: 'Learn More',
      primaryButtonUrl: '/about',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 5,
    },
  });

  for (const card of [
    { title: 'Connected Ecosystem', description: 'Customers and traders work together through one trusted digital marketplace.', icon: `${PLACEHOLDER}/assets/icons/connected-ecosystem.svg`, sortOrder: 1 },
    { title: 'Verified & Transparent', description: 'Every interaction is secure, trackable and built on complete transparency.', icon: `${PLACEHOLDER}/assets/icons/verified-transparent.svg`, sortOrder: 2 },
    { title: 'Real-Time Collaboration', description: 'Negotiate faster, communicate clearly and complete work efficiently.', icon: `${PLACEHOLDER}/assets/icons/realtime-collab.svg`, sortOrder: 3 },
  ]) {
    await upsertSectionItem(prisma, connectedMarketplace.id, { title: card.title }, card);
  }

  const serviceCategories = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'service_categories' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'category_grid',
      sectionKey: 'service_categories',
      title: 'Service Categories',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 6,
    },
  });

  for (const cat of [
    { name: 'Cleaning', slug: 'cleaning', icon: `${PLACEHOLDER}/assets/icons/cleaning.svg`, sortOrder: 1 },
    { name: 'AC Service', slug: 'ac-service', icon: `${PLACEHOLDER}/assets/icons/ac-service.svg`, sortOrder: 2 },
    { name: 'Carpentry', slug: 'carpentry', icon: `${PLACEHOLDER}/assets/icons/carpentry.svg`, sortOrder: 3 },
    { name: 'Plumbing', slug: 'plumbing', icon: `${PLACEHOLDER}/assets/icons/plumbing.svg`, sortOrder: 4 },
    { name: 'Painting', slug: 'painting', icon: `${PLACEHOLDER}/assets/icons/painting.svg`, sortOrder: 5 },
    { name: 'Electrician', slug: 'electrician', icon: `${PLACEHOLDER}/assets/icons/electrician.svg`, sortOrder: 6 },
  ]) {
    await upsertSectionItem(prisma, serviceCategories.id, { title: cat.name }, {
      title: cat.name,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
      metadata: { slug: cat.slug, link: `/services/${cat.slug}` },
    });
  }

  const whyBrisk = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'why_brisk' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'feature_grid',
      sectionKey: 'why_brisk',
      title: 'Why BRISK Is Different',
      description:
        'Built on principles that put trust, transparency, and fairness at the center of every transaction.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 7,
    },
  });

  for (const feature of [
    { title: 'Trust First', description: 'Every interaction on BRISK is governed by a trust framework — verified identities, transparent processes, and platform-managed accountability ensure both parties are protected from start to finish.', icon: `${PLACEHOLDER}/assets/icons/trust-first.svg`, sortOrder: 1 },
    { title: 'Verified Traders', description: 'Every service provider is vetted and verified before joining the marketplace.', icon: `${PLACEHOLDER}/assets/icons/verified-traders-feature.svg`, sortOrder: 2 },
    { title: 'Negotiation Driven', description: 'Negotiate pricing, timelines, and scope directly with no rigid structures.', icon: `${PLACEHOLDER}/assets/icons/negotiation.svg`, sortOrder: 3 },
    { title: 'Transparent Lifecycle', description: 'Track every stage from job posting through to completion and review.', icon: `${PLACEHOLDER}/assets/icons/lifecycle.svg`, sortOrder: 4 },
    { title: 'Platform Governance', description: 'Built-in rules and protections keep every transaction fair and accountable.', icon: `${PLACEHOLDER}/assets/icons/governance.svg`, sortOrder: 5 },
  ]) {
    await upsertSectionItem(prisma, whyBrisk.id, { title: feature.title }, feature);
  }

  const customer = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'customer' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'customer_promo',
      sectionKey: 'customer',
      subtitle: 'FOR CUSTOMERS',
      title: 'Find Trusted Professionals',
      description: 'Post jobs, receive competitive offers, and choose with full confidence.',
      primaryButtonText: 'Find A Trader',
      primaryButtonUrl: '/register?role=customer',
      backgroundImage: `${PLACEHOLDER}/assets/images/customer-dashboard.png`,
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 8,
    },
  });

  for (const feature of [
    { title: 'Post jobs and describe exactly what you need', sortOrder: 1 },
    { title: 'Receive offers from verified traders', sortOrder: 2 },
    { title: 'Compare and negotiate directly', sortOrder: 3 },
    { title: 'Choose confidently with full transparency', sortOrder: 4 },
  ]) {
    await upsertSectionItem(prisma, customer.id, { title: feature.title }, feature);
  }

  const trader = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'trader' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'trader_promo',
      sectionKey: 'trader',
      subtitle: 'FOR TRADERS',
      title: 'Grow Your Business',
      description: 'Discover local opportunities, send proposals, and build your reputation.',
      primaryButtonText: 'Become A Trader',
      primaryButtonUrl: '/register?role=trader',
      backgroundImage: `${PLACEHOLDER}/assets/images/trader-dashboard.png`,
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 9,
    },
  });

  for (const feature of [
    { title: 'Discover local jobs in your area', sortOrder: 1 },
    { title: 'Send proposals and stand out', sortOrder: 2 },
    { title: 'Grow your business consistently', sortOrder: 3 },
    { title: 'Build reputation with verified reviews', sortOrder: 4 },
  ]) {
    await upsertSectionItem(prisma, trader.id, { title: feature.title }, feature);
  }

  const statistics = await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'statistics' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'statistics',
      sectionKey: 'statistics',
      title: 'Built For Confidence',
      description:
        'Numbers that reflect a platform designed around trust, transparency, and customer satisfaction.',
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 10,
    },
  });

  for (const stat of [
    { value: '100%', label: 'Platform Managed', icon: `${PLACEHOLDER}/assets/icons/platform-managed.svg`, sortOrder: 1 },
    { value: 'Verified', label: 'Professionals Only', icon: `${PLACEHOLDER}/assets/icons/professionals.svg`, sortOrder: 2 },
    { value: 'Tracked', label: 'Transparent Process', icon: `${PLACEHOLDER}/assets/icons/tracked.svg`, sortOrder: 3 },
    { value: 'Secure', label: 'End-to-End Comms', icon: `${PLACEHOLDER}/assets/icons/secure-comms.svg`, sortOrder: 4 },
    { value: '4.7', label: 'Brisk Review Rating', icon: `${PLACEHOLDER}/assets/icons/rating.svg`, sortOrder: 5 },
    { value: '100K+', label: 'Customers', icon: `${PLACEHOLDER}/assets/icons/customers.svg`, sortOrder: 6 },
    { value: '5K+', label: 'Traders', icon: `${PLACEHOLDER}/assets/icons/traders.svg`, sortOrder: 7 },
  ]) {
    await upsertSectionItem(prisma, statistics.id, { title: stat.value }, {
      title: stat.value,
      description: stat.label,
      icon: stat.icon,
      sortOrder: stat.sortOrder,
      metadata: { value: stat.value, label: stat.label },
    });
  }

  await prisma.cmsPageSection.upsert({
    where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'app_download' } },
    update: {},
    create: {
      pageId: page.id,
      sectionType: 'app_cta',
      sectionKey: 'app_download',
      title: 'Everything You Need In One App',
      description:
        'Post jobs, receive offers, negotiate with trusted traders, track progress and complete work directly from your mobile device.',
      appStoreUrl: 'https://apps.apple.com/app/brisk',
      googlePlayUrl: 'https://play.google.com/store/apps/details?id=com.brisk',
      backgroundImage: `${PLACEHOLDER}/assets/images/app-download-phones.png`,
      status: CmsPublishStatus.PUBLISHED,
      sortOrder: 12,
    },
  });

  for (const review of [
    { authorName: 'Edward Alexander', authorRole: 'Trader', badgeLabel: 'Trader', authorAvatarUrl: `${PLACEHOLDER}/assets/images/reviewers/edward.jpg`, quoteText: 'They have awesome customer service and the platform makes winning local jobs straightforward.', rating: 4.9, displayOrder: 1 },
    { authorName: 'Diana Johnston', authorRole: 'Verified Trader', badgeLabel: 'Verified Business User', authorAvatarUrl: `${PLACEHOLDER}/assets/images/reviewers/diana.jpg`, quoteText: 'As a registered trader, BRISK has completely changed how I win clients. The platform ensures my quotes are seen, and milestone payments protect my hard work.', rating: 4.8, displayOrder: 2, isVerified: true },
    { authorName: 'David Thorne', authorRole: 'Verified Trader', badgeLabel: 'Verified Trader', authorAvatarUrl: `${PLACEHOLDER}/assets/images/reviewers/david.jpg`, quoteText: 'BRISK helped me grow my business with steady leads and transparent job workflows.', rating: 4.8, displayOrder: 3, isVerified: true },
  ]) {
    const existing = await prisma.cmsTestimonial.findFirst({
      where: { authorName: review.authorName, pageType: CmsTestimonialPageType.HOME },
    });
    if (!existing) {
      await prisma.cmsTestimonial.create({
        data: {
          ...review,
          pageType: CmsTestimonialPageType.HOME,
          status: CmsPublishStatus.PUBLISHED,
          isVerified: review.isVerified ?? false,
        },
      });
    }
  }

  void hero;
};
