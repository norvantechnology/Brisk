import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import {
  CmsActiveStatus,
  CmsAudience,
  CmsPublishStatus,
  Prisma,
} from '@prisma/client';
import {
  serializePublicArticleCard,
  serializePublicArticleDetail,
  serializePublicBlogCategory,
  serializePublicFaq,
  serializePublicFaqCategory,
  serializePublicLegalDetail,
  serializePublicLegalSummary,
  serializePublicPage,
  serializePublicPageSummary,
  serializePublicSectionCard,
  serializePublicSectionDetail,
  serializePublicSeo,
  serializePublicSocialLink,
  serializePublicTestimonial,
} from './cms.serializers';
import { parseCmsPageType } from './cms-page-type';

// ==========================================
// HELPERS
// ==========================================

const audienceFilter = (audience?: string): Prisma.EnumCmsAudienceFilter | undefined => {
  if (!audience) return undefined;
  const normalized = audience.trim().toUpperCase();
  if (!Object.values(CmsAudience).includes(normalized as CmsAudience)) {
    return undefined;
  }
  const value = normalized as CmsAudience;
  if (value === CmsAudience.BOTH) {
    return { equals: CmsAudience.BOTH };
  }
  return { in: [CmsAudience.BOTH, value] };
};

const parseFeatured = (value?: string | boolean): boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const parsePageLimit = (query: {
  page?: string | number;
  per_page?: string | number;
  limit?: string | number;
}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.max(1, Math.min(50, Number(query.per_page ?? query.limit) || 12));
  return { page, perPage, skip: (page - 1) * perPage };
};

/** Live content: PUBLISHED, or SCHEDULED whose publish date has arrived. */
const livePublishWhere = (): Prisma.CmsBlogPostWhereInput => ({
  deletedAt: null,
  OR: [
    { status: CmsPublishStatus.PUBLISHED },
    {
      status: CmsPublishStatus.SCHEDULED,
      publishedAt: { lte: new Date() },
    },
  ],
});

const liveGuideWhere = (): Prisma.CmsKnowledgeGuideWhereInput => ({
  deletedAt: null,
  status: CmsPublishStatus.PUBLISHED,
});

const blogCategorySelect = {
  id: true,
  name: true,
  slug: true,
  iconName: true,
} as const;

/** Card/list fields — excludes heavy HTML `content`. */
const blogCardSelect = {
  id: true,
  title: true,
  slug: true,
  categoryId: true,
  coverImageUrl: true,
  excerpt: true,
  authorName: true,
  authorRole: true,
  readingTime: true,
  publishedAt: true,
  isFeatured: true,
  seoTitle: true,
  seoDescription: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  createdById: true,
  category: { select: blogCategorySelect },
} as const;

// ==========================================
// WEBSITE BOOTSTRAP (homepage / layout)
// ==========================================

export const getWebsiteBootstrap = async (audience?: string) => {
  const targetAudience = audienceFilter(audience);

  const [seo, socialLinks, featuredArticle, featuredTestimonials, navPages] = await Promise.all([
    prisma.cmsSeoSettings.findFirst({
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.cmsSocialLink.findMany({
      where: { status: CmsActiveStatus.ACTIVE },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        platform: true,
        profileUrl: true,
        sortOrder: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.cmsBlogPost.findFirst({
      where: { ...livePublishWhere(), isFeatured: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: blogCardSelect,
    }),
    prisma.cmsTestimonial.findMany({
      where: {
        status: CmsPublishStatus.PUBLISHED,
        isFeatured: true,
        ...(targetAudience ? { targetAudience } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      take: 8,
    }),
    prisma.cmsStaticPage.findMany({
      where: {
        status: CmsPublishStatus.PUBLISHED,
        isActive: true,
        ...(targetAudience ? { targetAudience } : {}),
      },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        targetAudience: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    seo: seo ? serializePublicSeo(seo) : null,
    social_links: socialLinks.map(serializePublicSocialLink),
    featured_article: featuredArticle
      ? serializePublicArticleCard(featuredArticle as never)
      : null,
    featured_testimonials: featuredTestimonials.map(serializePublicTestimonial),
    pages: navPages.map(serializePublicPageSummary),
  };
};

// ==========================================
// PAGES
// ==========================================

export const listPublishedPages = async (audience?: string) => {
  const targetAudience = audienceFilter(audience);
  const pages = await prisma.cmsStaticPage.findMany({
    where: {
      status: CmsPublishStatus.PUBLISHED,
      isActive: true,
      ...(targetAudience ? { targetAudience } : {}),
    },
    orderBy: { title: 'asc' },
    select: {
      id: true,
      title: true,
      slug: true,
      targetAudience: true,
      updatedAt: true,
    },
  });

  return { items: pages.map(serializePublicPageSummary) };
};

export const getPublishedPageBySlug = async (slug: string, audience?: string) => {
  const targetAudience = audienceFilter(audience);
  const page = await prisma.cmsStaticPage.findFirst({
    where: {
      slug,
      status: CmsPublishStatus.PUBLISHED,
      isActive: true,
      ...(targetAudience ? { targetAudience } : {}),
    },
  });

  if (!page) {
    throw new NotFoundError('Page not found.');
  }

  return serializePublicPage(page);
};

// ==========================================
// SOCIAL
// ==========================================

export const listActiveSocialLinks = async () => {
  const links = await prisma.cmsSocialLink.findMany({
    where: { status: CmsActiveStatus.ACTIVE },
    orderBy: { sortOrder: 'asc' },
  });

  return { items: links.map(serializePublicSocialLink) };
};

// ==========================================
// KNOWLEDGE HUB
// ==========================================

export const listPublishedKnowledgeHub = async () => {
  const guides = await prisma.cmsKnowledgeGuide.findMany({
    where: liveGuideWhere(),
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      graphicImageUrl: true,
      iconName: true,
      ctaButtonText: true,
      ctaUrl: true,
      sortOrder: true,
      updatedAt: true,
      detailedContent: true,
      seoTitle: true,
      seoDescription: true,
      status: true,
      deletedAt: true,
      createdAt: true,
      _count: { select: { blocks: true } },
    },
  });

  return { items: guides.map((g) => serializePublicSectionCard(g as never)) };
};

export const getPublishedKnowledgeBySlug = async (slug: string) => {
  const guide = await prisma.cmsKnowledgeGuide.findFirst({
    where: { ...liveGuideWhere(), slug },
    include: {
      blocks: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!guide) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  return serializePublicSectionDetail(guide);
};

// ==========================================
// BLOG
// ==========================================

export type PublicBlogPostFilters = {
  page?: string | number;
  per_page?: string | number;
  limit?: string | number;
  search?: string;
  category_id?: string;
  categoryId?: string;
  category_slug?: string;
  featured?: string | boolean;
};

export const listActiveBlogCategories = async () => {
  const categories = await prisma.cmsBlogCategory.findMany({
    where: { status: CmsActiveStatus.ACTIVE },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: {
          posts: { where: livePublishWhere() },
        },
      },
    },
  });

  return { items: categories.map(serializePublicBlogCategory) };
};

export const listPublishedBlogPosts = async (filters: PublicBlogPostFilters = {}) => {
  const { page, perPage, skip } = parsePageLimit(filters);
  const where: Prisma.CmsBlogPostWhereInput = {
    AND: [livePublishWhere()],
  };

  if (filters.search?.trim()) {
    const search = filters.search.trim();
    where.AND = [
      ...(where.AND as Prisma.CmsBlogPostWhereInput[]),
      {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { excerpt: { contains: search, mode: 'insensitive' } },
          { authorName: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const categoryId = filters.category_id ?? filters.categoryId;
  if (categoryId) {
    where.categoryId = categoryId;
  } else if (filters.category_slug) {
    where.category = { slug: filters.category_slug, status: CmsActiveStatus.ACTIVE };
  }

  const featured = parseFeatured(filters.featured);
  if (featured !== undefined) {
    where.isFeatured = featured;
  }

  const [total, posts] = await Promise.all([
    prisma.cmsBlogPost.count({ where }),
    prisma.cmsBlogPost.findMany({
      where,
      skip,
      take: perPage,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: blogCardSelect,
    }),
  ]);

  return {
    items: posts.map((p) => serializePublicArticleCard(p as never)),
    pagination: {
      current_page: page,
      per_page: perPage,
      total,
      last_page: Math.max(1, Math.ceil(total / perPage) || 1),
    },
  };
};

export const getPublishedBlogPostBySlug = async (slug: string) => {
  const post = await prisma.cmsBlogPost.findFirst({
    where: {
      slug,
      ...livePublishWhere(),
    },
    include: {
      category: { select: blogCategorySelect },
    },
  });

  if (!post) {
    throw new NotFoundError('Blog post not found.');
  }

  return serializePublicArticleDetail(post);
};

export const getFeaturedBlogPost = async () => {
  const post = await prisma.cmsBlogPost.findFirst({
    where: { ...livePublishWhere(), isFeatured: true },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: blogCardSelect,
  });

  return {
    item: post ? serializePublicArticleCard(post as never) : null,
  };
};

// ==========================================
// FAQ
// ==========================================

export const listPublishedFaqCategories = async (audience?: string) => {
  const targetAudience = audienceFilter(audience);
  const categories = await prisma.cmsFaqCategory.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          faqs: {
            where: {
              status: CmsPublishStatus.PUBLISHED,
              ...(targetAudience ? { targetAudience } : {}),
            },
          },
        },
      },
    },
  });

  return {
    items: categories
      .filter((c) => (c._count?.faqs ?? 0) > 0)
      .map(serializePublicFaqCategory),
  };
};

export const listPublishedFaqs = async (filters: {
  audience?: string;
  category_id?: string;
  category_slug?: string;
  pageType?: string;
  type?: string;
}) => {
  const targetAudience = audienceFilter(filters.audience);
  const where: Prisma.CmsFaqWhereInput = {
    status: CmsPublishStatus.PUBLISHED,
    ...(targetAudience ? { targetAudience } : {}),
  };

  const pageType = parseCmsPageType(filters.pageType ?? filters.type);
  if (pageType) {
    where.pageType = pageType;
  }

  if (filters.category_id) {
    where.categoryId = filters.category_id;
  } else if (filters.category_slug) {
    where.category = { slug: filters.category_slug };
  }

  const faqs = await prisma.cmsFaq.findMany({
    where,
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return { items: faqs.map(serializePublicFaq) };
};

// ==========================================
// TESTIMONIALS
// ==========================================

export const listPublishedTestimonials = async (filters: {
  featured?: string | boolean;
  audience?: string;
  type?: string;
  status?: string;
  limit?: string | number;
}) => {
  const where: Prisma.CmsTestimonialWhereInput = {
    status: CmsPublishStatus.PUBLISHED,
  };

  const statusFilter = filters.status?.trim().toUpperCase();
  if (statusFilter && Object.values(CmsPublishStatus).includes(statusFilter as CmsPublishStatus)) {
    where.status = statusFilter as CmsPublishStatus;
  }

  const featuredFlag = parseFeatured(filters.featured);
  if (featuredFlag !== undefined) {
    where.isFeatured = featuredFlag;
  }

  // Standard filter: audience=CUSTOMER|TRADER|BOTH
  // CUSTOMER → CUSTOMER + BOTH; TRADER → TRADER + BOTH; BOTH → BOTH only.
  // Legacy `type` maps to the same audience semantics when `audience` is omitted.
  let audienceParam = filters.audience?.trim();
  if (!audienceParam && filters.type) {
    const typeNorm = filters.type.trim().toLowerCase();
    if (typeNorm === 'customer') audienceParam = CmsAudience.CUSTOMER;
    else if (typeNorm === 'trader') audienceParam = CmsAudience.TRADER;
    else if (typeNorm === 'home') audienceParam = CmsAudience.BOTH;
  }

  const targetAudience = audienceFilter(audienceParam);
  if (targetAudience) {
    where.targetAudience = targetAudience;
  }

  const take = Math.min(Math.max(Number(filters.limit) || 20, 1), 50);

  const testimonials = await prisma.cmsTestimonial.findMany({
    where,
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    take,
  });

  return { items: testimonials.map(serializePublicTestimonial) };
};

// ==========================================
// LEGAL
// ==========================================

export const listPublishedLegalPolicies = async () => {
  const policies = await prisma.cmsLegalPolicy.findMany({
    orderBy: { name: 'asc' },
    include: {
      versions: {
        where: { status: CmsPublishStatus.PUBLISHED },
        orderBy: [{ publishedAt: 'desc' }, { effectiveDate: 'desc' }],
        take: 1,
        select: {
          versionLabel: true,
          effectiveDate: true,
          publishedAt: true,
        },
      },
    },
  });

  return {
    items: policies
      .filter((p) => p.versions.length > 0)
      .map(serializePublicLegalSummary),
  };
};

export const getPublishedLegalBySlug = async (slug: string) => {
  const policy = await prisma.cmsLegalPolicy.findUnique({
    where: { slug },
    include: {
      versions: {
        where: { status: CmsPublishStatus.PUBLISHED },
        orderBy: [{ publishedAt: 'desc' }, { effectiveDate: 'desc' }, { createdAt: 'desc' }],
        take: 1,
      },
    },
  });

  if (!policy || policy.versions.length === 0) {
    throw new NotFoundError('Legal policy not found.');
  }

  return serializePublicLegalDetail(policy, policy.versions[0]);
};

/** Same BRISK light theme tokens as Swagger — readable mobile WebView layout. */
const wrapHtmlPage = (title: string, bodyHtml: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${title}</title>
  <style>
    :root {
      --brisk-text: #0f172a;
      --brisk-muted: #475569;
      --brisk-border: #e2e8f0;
      --brisk-surface: #ffffff;
      --brisk-soft: #f8fafc;
      --brisk-accent: #1e293b;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--brisk-soft);
      color: var(--brisk-text);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 17px;
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
    }
    .page {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
      padding: 28px 20px 48px;
    }
    .sheet {
      background: var(--brisk-surface);
      border: 1px solid var(--brisk-border);
      border-radius: 16px;
      padding: 28px 24px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      line-height: 1.25;
      font-weight: 700;
      color: var(--brisk-accent);
      letter-spacing: -0.02em;
    }
    .subtitle {
      margin: 0 0 24px;
      font-size: 15px;
      color: var(--brisk-muted);
    }
    h2 {
      margin: 28px 0 10px;
      font-size: 20px;
      line-height: 1.3;
      font-weight: 650;
      color: var(--brisk-accent);
    }
    h3 {
      margin: 20px 0 8px;
      font-size: 17px;
      font-weight: 600;
      color: var(--brisk-text);
    }
    p { margin: 0 0 14px; color: var(--brisk-text); }
    ul, ol { margin: 0 0 16px; padding-left: 1.25em; color: var(--brisk-text); }
    li { margin-bottom: 8px; }
    a { color: var(--brisk-accent); font-weight: 600; }
    .card {
      display: block;
      width: 100%;
      margin: 0 0 14px;
      padding: 16px 16px;
      background: var(--brisk-soft);
      border: 1px solid var(--brisk-border);
      border-radius: 12px;
    }
    .card:last-child { margin-bottom: 0; }
    .q {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 650;
      color: var(--brisk-accent);
      line-height: 1.35;
    }
    .a {
      margin: 0;
      font-size: 15px;
      color: var(--brisk-muted);
      line-height: 1.55;
    }
    @media (min-width: 480px) {
      .page { padding: 36px 28px 64px; }
      .sheet { padding: 36px 32px; }
      h1 { font-size: 32px; }
      body { font-size: 18px; }
    }
  </style>
</head>
<body>
  <main class="page"><article class="sheet">${bodyHtml}</article></main>
</body>
</html>`;

/** HTML for in-app WebView (Terms / Privacy). Ensures defaults exist on first hit. */
export const getLegalHtmlBySlug = async (slug: string) => {
  const { ensureLegalPoliciesPublished } = await import('../../database/seeders/legal.seed');
  await ensureLegalPoliciesPublished(prisma);

  const policy = await getPublishedLegalBySlug(slug);
  const title = policy.name;
  const content = policy.version?.content || '<p>Content unavailable.</p>';
  return wrapHtmlPage(title, content);
};

/** HTML Help Center for in-app WebView — published FAQs. */
export const getHelpCenterHtml = async () => {
  const faqs = await prisma.cmsFaq.findMany({
    where: { status: CmsPublishStatus.PUBLISHED },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    take: 50,
    include: { category: { select: { name: true } } },
  });

  const defaultCards = [
    {
      q: 'How do I update my profile?',
      a: 'Open Profile and edit Personal Information, Bank Details, Categories, or Documents.',
    },
    {
      q: 'How do offers work?',
      a: 'Create offers from Profile → Offers. Customers can claim active offers from the Offers tab.',
    },
    {
      q: 'How do I verify my email or mobile?',
      a: 'Use the verify options on your profile. Status is shown as emailVerified / mobileVerified.',
    },
  ];

  const items =
    faqs.length > 0
      ? faqs
          .map(
            (faq) =>
              `<div class="card"><div class="q">${escapeHtml(faq.question)}</div><div class="a">${faq.answer}</div></div>`
          )
          .join('')
      : defaultCards
          .map(
            (item) =>
              `<div class="card"><div class="q">${escapeHtml(item.q)}</div><div class="a">${escapeHtml(item.a)}</div></div>`
          )
          .join('');

  return wrapHtmlPage(
    'Help Center',
    `<h1>Help Center</h1><p class="subtitle">Answers to common questions about BRISK.</p>${items}`
  );
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ==========================================
// SEO
// ==========================================

export const getPublicSeoSettings = async () => {
  const seo = await prisma.cmsSeoSettings.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  return { seo: seo ? serializePublicSeo(seo) : null };
};

export const getPublicContactSettings = async () => {
  const contact = await prisma.cmsContactSettings.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  const defaults = {
    general_inquiry_email: 'info@brisk.com',
    customer_support_phone: '+353 123 456 789',
    office_address: '14 Kensington High Street, London, W8 4PT, United Kingdom',
  };

  if (!contact) {
    return { contact: defaults };
  }

  return {
    contact: {
      general_inquiry_email: contact.generalInquiryEmail,
      customer_support_phone: contact.customerSupportPhone,
      office_address: contact.officeAddress,
      updated_at: contact.updatedAt,
    },
  };
};
