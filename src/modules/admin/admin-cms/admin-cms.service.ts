import { prisma } from '../../../config/database';
import { NotFoundError, ConflictError, BadRequestError } from '../../../utils/errors';
import {
  ActorType,
  CmsAudience,
  CmsPublishStatus,
  CmsActiveStatus,
  CmsTestimonialPageType,
  Prisma,
  SurveyRegistrationStatus,
} from '@prisma/client';
import { parseCmsPageType } from '../../cms/cms-page-type';

// ==========================================
// TYPES
// ==========================================

export type CmsListFilters = {
  page?: string | number;
  limit?: string | number;
  search?: string;
  status?: string;
  audience?: string;
  categoryId?: string;
  featured?: string | boolean;
  sort?: string;
  type?: string;
  pageType?: string;
};

export type CreatePageInput = {
  title: string;
  slug: string;
  content?: string;
  targetAudience?: CmsAudience;
  status?: CmsPublishStatus;
  isActive?: boolean;
};

export type UpdatePageInput = Partial<CreatePageInput>;

export type CreateSocialLinkInput = {
  platform: string;
  profileUrl: string;
  sortOrder?: number;
  status?: CmsActiveStatus;
};

export type UpdateSocialLinkInput = Partial<CreateSocialLinkInput>;

export type CreateFaqCategoryInput = {
  name: string;
  slug: string;
};

export type CreateFaqInput = {
  question: string;
  answer: string;
  categoryId?: string;
  pageType?: import('@prisma/client').CmsTestimonialPageType;
  targetAudience?: CmsAudience;
  status?: CmsPublishStatus;
  displayOrder?: number;
};

export type UpdateFaqInput = {
  question?: string;
  answer?: string;
  categoryId?: string | null;
  pageType?: import('@prisma/client').CmsTestimonialPageType;
  targetAudience?: CmsAudience;
  status?: CmsPublishStatus;
  displayOrder?: number;
};

export type CreateTestimonialInput = {
  authorName: string;
  authorRole?: string;
  companyName?: string;
  badgeLabel?: string;
  authorAvatarUrl?: string;
  quoteText: string;
  rating?: number;
  pageType?: import('@prisma/client').CmsTestimonialPageType;
  isVerified?: boolean;
  targetAudience?: CmsAudience;
  status?: CmsPublishStatus;
  isFeatured?: boolean;
  displayOrder?: number;
};

export type UpdateTestimonialInput = Partial<CreateTestimonialInput>;

export type CreateLegalPolicyInput = {
  name: string;
  slug: string;
};

export type PublishLegalVersionInput = {
  versionLabel: string;
  content: string;
  effectiveDate: string;
  status?: CmsPublishStatus;
};

export type UpsertSeoSettingsInput = {
  globalSiteTitle: string;
  metaDescription: string;
  metaKeywords?: string;
  canonicalBaseUrl: string;
  ogImageUrl?: string;
  twitterHandle?: string;
  gaMeasurementId?: string;
  robotsTxt?: string;
};

// ==========================================
// HELPERS
// ==========================================

export const parsePageLimit = (filters: CmsListFilters) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const writeAudit = async (
  eventType: string,
  adminId: string,
  adminLabel: string,
  subjectType: string,
  subjectId: string,
  description: string
) => {
  await prisma.auditLog.create({
    data: {
      eventType,
      actorType: ActorType.ADMIN,
      actorId: adminId,
      actorLabel: adminLabel,
      subjectType,
      subjectId,
      description,
    },
  });
};

const parseOptionalDate = (value?: string | null): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError('Invalid date value.');
  }
  return date;
};

const asPublishStatus = (value?: string): CmsPublishStatus | undefined => {
  if (!value) return undefined;
  if (Object.values(CmsPublishStatus).includes(value as CmsPublishStatus)) {
    return value as CmsPublishStatus;
  }
  return undefined;
};

const asActiveStatus = (value?: string): CmsActiveStatus | undefined => {
  if (!value) return undefined;
  if (Object.values(CmsActiveStatus).includes(value as CmsActiveStatus)) {
    return value as CmsActiveStatus;
  }
  return undefined;
};

const asAudience = (value?: string): CmsAudience | undefined => {
  if (!value) return undefined;
  if (Object.values(CmsAudience).includes(value as CmsAudience)) {
    return value as CmsAudience;
  }
  return undefined;
};

const asTestimonialPageType = (
  value?: string | CmsTestimonialPageType
): CmsTestimonialPageType | undefined => {
  if (!value) return undefined;
  if (Object.values(CmsTestimonialPageType).includes(value as CmsTestimonialPageType)) {
    return value as CmsTestimonialPageType;
  }
  return parseCmsPageType(String(value));
};

const parseFeatured = (value?: string | boolean): boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const createdOrder = (sort?: string): Prisma.SortOrder =>
  sort === 'oldest' ? 'asc' : 'desc';

// ==========================================
// DASHBOARD
// ==========================================

export const getCmsDashboardStats = async () => {
  const [
    pagesPublished,
    blogPostsPublished,
    blogCategoriesCount,
    knowledgeGuidesPublished,
    socialLinksActive,
    legalPoliciesCount,
    faqsPublished,
    testimonialsPublished,
    contactSubmissionsCount,
    contactSubmissionsNewCount,
  ] = await Promise.all([
    prisma.cmsStaticPage.count({ where: { status: CmsPublishStatus.PUBLISHED } }),
    prisma.cmsBlogPost.count({ where: { status: CmsPublishStatus.PUBLISHED, deletedAt: null } }),
    prisma.cmsBlogCategory.count(),
    prisma.cmsKnowledgeGuide.count({
      where: { status: CmsPublishStatus.PUBLISHED, deletedAt: null },
    }),
    prisma.cmsSocialLink.count({ where: { status: CmsActiveStatus.ACTIVE } }),
    prisma.cmsLegalPolicy.count(),
    prisma.cmsFaq.count({ where: { status: CmsPublishStatus.PUBLISHED } }),
    prisma.cmsTestimonial.count({ where: { status: CmsPublishStatus.PUBLISHED } }),
    prisma.contactSubmission.count(),
    prisma.contactSubmission.count({ where: { status: SurveyRegistrationStatus.NEW } }),
  ]);

  return {
    pagesPublished,
    blogPostsPublished,
    blogCategoriesCount,
    knowledgeGuidesPublished,
    socialLinksActive,
    navigationFooterLinks: socialLinksActive,
    legalPoliciesCount,
    faqsPublished,
    testimonialsPublished,
    contactSubmissionsTotal: contactSubmissionsCount,
    contactSubmissionsNew: contactSubmissionsNewCount,
    // Placeholders until Header/Footer/Media/Email modules ship
    mediaFilesCount: 0,
    emailTemplatesCount: 0,
    notificationTemplatesCount: 0,
  };
};

export const getCmsDashboardAudit = async (filters: {
  page?: string | number;
  limit?: string | number;
} = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  // Keep previous default of 20 (other CMS lists default to 10).
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;
  const cmsSubjectTypes = [
    'CmsStaticPage',
    'CmsSocialLink',
    'CmsKnowledgeGuide',
    'CmsBlogCategory',
    'CmsBlogPost',
    'CmsFaq',
    'CmsFaqCategory',
    'CmsTestimonial',
    'CmsLegalPolicy',
    'CmsSeoSettings',
    'ContactSubmission',
  ];

  const where: Prisma.AuditLogWhereInput = {
    OR: [
      { subjectType: { in: cmsSubjectTypes } },
      { eventType: { startsWith: 'CMS_' } },
    ],
  };

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

// ==========================================
// WEBSITE PAGES
// ==========================================

export const listPages = async (filters: CmsListFilters) => {
  const { page, limit, skip } = parsePageLimit(filters);
  const where: Prisma.CmsStaticPageWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  const status = asPublishStatus(filters.status);
  if (status) where.status = status;

  const audience = asAudience(filters.audience);
  if (audience) where.targetAudience = audience;

  const [total, pages] = await Promise.all([
    prisma.cmsStaticPage.count({ where }),
    prisma.cmsStaticPage.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: createdOrder(filters.sort) },
      include: {
        updatedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    pages,
  };
};

export const getPageById = async (id: string) => {
  const page = await prisma.cmsStaticPage.findUnique({
    where: { id },
    include: {
      updatedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });

  if (!page) {
    throw new NotFoundError('CMS page not found.');
  }

  return page;
};

export const createPage = async (adminId: string, adminLabel: string, input: CreatePageInput) => {
  const existingSlug = await prisma.cmsStaticPage.findUnique({ where: { slug: input.slug } });
  if (existingSlug) {
    throw new ConflictError('Page slug already exists.');
  }

  const page = await prisma.cmsStaticPage.create({
    data: {
      title: input.title,
      slug: input.slug,
      content: input.content,
      targetAudience: input.targetAudience ?? CmsAudience.BOTH,
      status: input.status ?? CmsPublishStatus.DRAFT,
      isActive: input.isActive ?? true,
      updatedById: adminId,
    },
  });

  await writeAudit(
    'CMS_PAGE_CREATED',
    adminId,
    adminLabel,
    'CmsStaticPage',
    page.id,
    `Created CMS page: "${page.title}" (/${page.slug}).`
  );

  return page;
};

export const updatePage = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdatePageInput
) => {
  const existing = await prisma.cmsStaticPage.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('CMS page not found.');
  }

  if (input.slug && input.slug !== existing.slug) {
    const slugConflict = await prisma.cmsStaticPage.findUnique({ where: { slug: input.slug } });
    if (slugConflict) {
      throw new ConflictError('Page slug already in use.');
    }
  }

  const page = await prisma.cmsStaticPage.update({
    where: { id },
    data: {
      title: input.title,
      slug: input.slug,
      content: input.content,
      targetAudience: input.targetAudience,
      status: input.status,
      isActive: input.isActive,
      updatedById: adminId,
    },
  });

  await writeAudit(
    'CMS_PAGE_UPDATED',
    adminId,
    adminLabel,
    'CmsStaticPage',
    page.id,
    `Updated CMS page: "${page.title}".`
  );

  return page;
};

export const togglePageActive = async (adminId: string, adminLabel: string, id: string) => {
  const existing = await prisma.cmsStaticPage.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('CMS page not found.');
  }

  const page = await prisma.cmsStaticPage.update({
    where: { id },
    data: {
      isActive: !existing.isActive,
      updatedById: adminId,
    },
  });

  await writeAudit(
    'CMS_PAGE_TOGGLED',
    adminId,
    adminLabel,
    'CmsStaticPage',
    page.id,
    `Toggled CMS page active status to ${page.isActive ? 'active' : 'inactive'}: "${page.title}".`
  );

  return page;
};

export const deletePage = async (adminId: string, adminLabel: string, id: string) => {
  const existing = await prisma.cmsStaticPage.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('CMS page not found.');
  }

  await prisma.cmsStaticPage.delete({ where: { id } });

  await writeAudit(
    'CMS_PAGE_DELETED',
    adminId,
    adminLabel,
    'CmsStaticPage',
    id,
    `Deleted CMS page: "${existing.title}" (/${existing.slug}).`
  );
};

export const duplicatePage = async (adminId: string, adminLabel: string, id: string) => {
  const existing = await prisma.cmsStaticPage.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('CMS page not found.');
  }

  const baseSlug = `${existing.slug}-copy`;
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.cmsStaticPage.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const page = await prisma.cmsStaticPage.create({
    data: {
      title: `${existing.title} (Copy)`,
      slug,
      content: existing.content,
      targetAudience: existing.targetAudience,
      status: CmsPublishStatus.DRAFT,
      isActive: existing.isActive,
      updatedById: adminId,
    },
  });

  await writeAudit(
    'CMS_PAGE_DUPLICATED',
    adminId,
    adminLabel,
    'CmsStaticPage',
    page.id,
    `Duplicated CMS page "${existing.title}" → "${page.title}" (/${page.slug}).`
  );

  return page;
};

// ==========================================
// SOCIAL LINKS
// ==========================================

export const listSocialLinks = async (filters: CmsListFilters = {}) => {
  const { page, limit, skip } = parsePageLimit(filters);
  const where: Prisma.CmsSocialLinkWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { platform: { contains: search, mode: 'insensitive' } },
      { profileUrl: { contains: search, mode: 'insensitive' } },
    ];
  }

  const status = asActiveStatus(filters.status);
  if (status) where.status = status;

  const [total, socialLinks] = await Promise.all([
    prisma.cmsSocialLink.count({ where }),
    prisma.cmsSocialLink.findMany({
      where,
      skip,
      take: limit,
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    socialLinks,
  };
};

export const createSocialLink = async (
  adminId: string,
  adminLabel: string,
  input: CreateSocialLinkInput
) => {
  const link = await prisma.cmsSocialLink.create({
    data: {
      platform: input.platform,
      profileUrl: input.profileUrl,
      sortOrder: input.sortOrder ?? 0,
      status: input.status ?? CmsActiveStatus.ACTIVE,
    },
  });

  await writeAudit(
    'CMS_SOCIAL_LINK_CREATED',
    adminId,
    adminLabel,
    'CmsSocialLink',
    link.id,
    `Created social link: ${link.platform}.`
  );

  return link;
};

export const updateSocialLink = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateSocialLinkInput
) => {
  const existing = await prisma.cmsSocialLink.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Social link not found.');
  }

  const link = await prisma.cmsSocialLink.update({
    where: { id },
    data: {
      platform: input.platform,
      profileUrl: input.profileUrl,
      sortOrder: input.sortOrder,
      status: input.status,
    },
  });

  await writeAudit(
    'CMS_SOCIAL_LINK_UPDATED',
    adminId,
    adminLabel,
    'CmsSocialLink',
    link.id,
    `Updated social link: ${link.platform}.`
  );

  return link;
};

export const deleteSocialLink = async (adminId: string, adminLabel: string, id: string) => {
  const existing = await prisma.cmsSocialLink.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Social link not found.');
  }

  await prisma.cmsSocialLink.delete({ where: { id } });

  await writeAudit(
    'CMS_SOCIAL_LINK_DELETED',
    adminId,
    adminLabel,
    'CmsSocialLink',
    id,
    `Deleted social link: ${existing.platform}.`
  );
};

// ==========================================
// FAQ CATEGORIES
// ==========================================

export const listFaqCategories = async (filters: CmsListFilters = {}) => {
  const { page, limit, skip } = parsePageLimit(filters);
  const where: Prisma.CmsFaqCategoryWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, faqCategories] = await Promise.all([
    prisma.cmsFaqCategory.count({ where }),
    prisma.cmsFaqCategory.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { faqs: true } },
      },
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    faqCategories,
  };
};

export const createFaqCategory = async (
  adminId: string,
  adminLabel: string,
  input: CreateFaqCategoryInput
) => {
  const existingSlug = await prisma.cmsFaqCategory.findUnique({ where: { slug: input.slug } });
  if (existingSlug) {
    throw new ConflictError('FAQ category slug already exists.');
  }

  const category = await prisma.cmsFaqCategory.create({
    data: {
      name: input.name,
      slug: input.slug,
    },
  });

  await writeAudit(
    'CMS_FAQ_CATEGORY_CREATED',
    adminId,
    adminLabel,
    'CmsFaqCategory',
    category.id,
    `Created FAQ category: "${category.name}".`
  );

  return category;
};

// ==========================================
// FAQs
// ==========================================

export const listFaqs = async (filters: CmsListFilters = {}) => {
  const { page, limit, skip } = parsePageLimit(filters);
  const where: Prisma.CmsFaqWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { question: { contains: search, mode: 'insensitive' } },
      { answer: { contains: search, mode: 'insensitive' } },
    ];
  }

  const status = asPublishStatus(filters.status);
  if (status) where.status = status;

  const audience = asAudience(filters.audience);
  if (audience) where.targetAudience = audience;

  const pageType = asTestimonialPageType(filters.type ?? filters.pageType);
  if (pageType) {
    where.pageType = pageType;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  const [total, faqs] = await Promise.all([
    prisma.cmsFaq.count({ where }),
    prisma.cmsFaq.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: createdOrder(filters.sort) }],
      include: { category: true },
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    faqs,
  };
};

export const getFaqById = async (id: string) => {
  const faq = await prisma.cmsFaq.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!faq) {
    throw new NotFoundError('FAQ not found.');
  }
  return faq;
};

export const createFaq = async (adminId: string, adminLabel: string, input: CreateFaqInput) => {
  if (input.categoryId) {
    const category = await prisma.cmsFaqCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      throw new NotFoundError('FAQ category not found.');
    }
  }

  const faq = await prisma.cmsFaq.create({
    data: {
      question: input.question,
      answer: input.answer,
      categoryId: input.categoryId,
      pageType: input.pageType ?? CmsTestimonialPageType.CUSTOMER,
      targetAudience: input.targetAudience ?? CmsAudience.BOTH,
      status: input.status ?? CmsPublishStatus.PUBLISHED,
      displayOrder: input.displayOrder ?? 0,
    },
    include: { category: true },
  });

  await writeAudit(
    'CMS_FAQ_CREATED',
    adminId,
    adminLabel,
    'CmsFaq',
    faq.id,
    `Created FAQ: "${faq.question}".`
  );

  return faq;
};

export const updateFaq = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateFaqInput
) => {
  const existing = await prisma.cmsFaq.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('FAQ not found.');
  }

  if (input.categoryId) {
    const category = await prisma.cmsFaqCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      throw new NotFoundError('FAQ category not found.');
    }
  }

  const faq = await prisma.cmsFaq.update({
    where: { id },
    data: {
      question: input.question,
      answer: input.answer,
      categoryId: input.categoryId,
      pageType: input.pageType,
      targetAudience: input.targetAudience,
      status: input.status,
      displayOrder: input.displayOrder,
    },
    include: { category: true },
  });

  await writeAudit(
    'CMS_FAQ_UPDATED',
    adminId,
    adminLabel,
    'CmsFaq',
    faq.id,
    `Updated FAQ: "${faq.question}".`
  );

  return faq;
};

export const deleteFaq = async (adminId: string, adminLabel: string, id: string) => {
  const existing = await prisma.cmsFaq.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('FAQ not found.');
  }

  await prisma.cmsFaq.delete({ where: { id } });

  await writeAudit(
    'CMS_FAQ_DELETED',
    adminId,
    adminLabel,
    'CmsFaq',
    id,
    `Deleted FAQ: "${existing.question}".`
  );
};

export const reorderFaqs = async (
  adminId: string,
  adminLabel: string,
  items: { id: string; displayOrder: number }[]
) => {
  if (!items.length) {
    throw new BadRequestError('Reorder items are required.');
  }

  await prisma.$transaction(
    items.map((item) =>
      prisma.cmsFaq.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      })
    )
  );

  await writeAudit(
    'CMS_FAQS_REORDERED',
    adminId,
    adminLabel,
    'CmsFaq',
    items[0].id,
    `Reordered ${items.length} FAQ item(s).`
  );

  return { success: true, count: items.length };
};

// ==========================================
// TESTIMONIALS
// ==========================================

export const getTestimonialStats = async () => {
  const [totalPublished, featuredCount, avgAgg] = await Promise.all([
    prisma.cmsTestimonial.count({ where: { status: CmsPublishStatus.PUBLISHED } }),
    prisma.cmsTestimonial.count({
      where: { status: CmsPublishStatus.PUBLISHED, isFeatured: true },
    }),
    prisma.cmsTestimonial.aggregate({
      _avg: { rating: true },
      where: { status: CmsPublishStatus.PUBLISHED },
    }),
  ]);

  return {
    totalPublished,
    avgRating: avgAgg._avg.rating ? Number(avgAgg._avg.rating) : 0,
    featuredCount,
  };
};

export const listTestimonials = async (filters: CmsListFilters = {}) => {
  const { page, limit, skip } = parsePageLimit(filters);
  const where: Prisma.CmsTestimonialWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { authorName: { contains: search, mode: 'insensitive' } },
      { authorRole: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { quoteText: { contains: search, mode: 'insensitive' } },
    ];
  }

  const status = asPublishStatus(filters.status);
  if (status) where.status = status;

  const audience = asAudience(filters.audience);
  if (audience) where.targetAudience = audience;

  const featured = parseFeatured(filters.featured);
  if (featured !== undefined) {
    where.isFeatured = featured;
  }

  const pageType = asTestimonialPageType(filters.type ?? filters.pageType);
  if (pageType) {
    where.pageType = pageType;
  }

  const [total, testimonials] = await Promise.all([
    prisma.cmsTestimonial.count({ where }),
    prisma.cmsTestimonial.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: createdOrder(filters.sort) }],
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    testimonials,
  };
};

export const createTestimonial = async (
  adminId: string,
  adminLabel: string,
  input: CreateTestimonialInput
) => {
  const testimonial = await prisma.cmsTestimonial.create({
    data: {
      authorName: input.authorName,
      authorRole: input.authorRole,
      companyName: input.companyName,
      badgeLabel: input.badgeLabel,
      authorAvatarUrl: input.authorAvatarUrl,
      quoteText: input.quoteText,
      rating: input.rating ?? 5,
      pageType:
        input.pageType ??
        (input.targetAudience === CmsAudience.TRADER
          ? CmsTestimonialPageType.TRADER
          : input.targetAudience === CmsAudience.CUSTOMER
            ? CmsTestimonialPageType.CUSTOMER
            : CmsTestimonialPageType.CUSTOMER),
      isVerified: input.isVerified ?? false,
      targetAudience: input.targetAudience ?? CmsAudience.BOTH,
      status: input.status ?? CmsPublishStatus.PUBLISHED,
      isFeatured: input.isFeatured ?? false,
      displayOrder: input.displayOrder ?? 0,
    },
  });

  await writeAudit(
    'CMS_TESTIMONIAL_CREATED',
    adminId,
    adminLabel,
    'CmsTestimonial',
    testimonial.id,
    `Created testimonial by "${testimonial.authorName}".`
  );

  return testimonial;
};

export const updateTestimonial = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: UpdateTestimonialInput
) => {
  const existing = await prisma.cmsTestimonial.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Testimonial not found.');
  }

  const testimonial = await prisma.cmsTestimonial.update({
    where: { id },
    data: {
      authorName: input.authorName,
      authorRole: input.authorRole,
      companyName: input.companyName,
      badgeLabel: input.badgeLabel,
      authorAvatarUrl: input.authorAvatarUrl,
      quoteText: input.quoteText,
      rating: input.rating,
      pageType: input.pageType,
      isVerified: input.isVerified,
      targetAudience: input.targetAudience,
      status: input.status,
      isFeatured: input.isFeatured,
      displayOrder: input.displayOrder,
    },
  });

  await writeAudit(
    'CMS_TESTIMONIAL_UPDATED',
    adminId,
    adminLabel,
    'CmsTestimonial',
    testimonial.id,
    `Updated testimonial by "${testimonial.authorName}".`
  );

  return testimonial;
};

export const getTestimonialById = async (id: string) => {
  const testimonial = await prisma.cmsTestimonial.findUnique({ where: { id } });
  if (!testimonial) {
    throw new NotFoundError('Testimonial not found.');
  }
  return testimonial;
};

export const updateTestimonialStatus = async (
  adminId: string,
  adminLabel: string,
  id: string,
  status: CmsPublishStatus
) => {
  const existing = await prisma.cmsTestimonial.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Testimonial not found.');
  }

  const testimonial = await prisma.cmsTestimonial.update({
    where: { id },
    data: { status },
  });

  await writeAudit(
    'CMS_TESTIMONIAL_STATUS_UPDATED',
    adminId,
    adminLabel,
    'CmsTestimonial',
    testimonial.id,
    `Updated testimonial status to ${status}.`
  );

  return testimonial;
};

export const updateTestimonialSortOrder = async (
  adminId: string,
  adminLabel: string,
  id: string,
  sortOrder: number
) => {
  const existing = await prisma.cmsTestimonial.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Testimonial not found.');
  }

  const testimonial = await prisma.cmsTestimonial.update({
    where: { id },
    data: { displayOrder: sortOrder },
  });

  await writeAudit(
    'CMS_TESTIMONIAL_SORT_UPDATED',
    adminId,
    adminLabel,
    'CmsTestimonial',
    testimonial.id,
    `Updated testimonial sort order to ${sortOrder}.`
  );

  return testimonial;
};

export const deleteTestimonial = async (adminId: string, adminLabel: string, id: string) => {
  const existing = await prisma.cmsTestimonial.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Testimonial not found.');
  }

  await prisma.cmsTestimonial.delete({ where: { id } });

  await writeAudit(
    'CMS_TESTIMONIAL_DELETED',
    adminId,
    adminLabel,
    'CmsTestimonial',
    id,
    `Deleted testimonial by "${existing.authorName}".`
  );
};

// ==========================================
// LEGAL POLICIES
// ==========================================

export const listLegalPolicies = async (filters: CmsListFilters = {}) => {
  const { page, limit, skip } = parsePageLimit(filters);
  const where: Prisma.CmsLegalPolicyWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.cmsLegalPolicy.count({ where }),
    prisma.cmsLegalPolicy.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        versions: {
          where: { status: CmsPublishStatus.PUBLISHED },
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          include: {
            publishedBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        _count: { select: { versions: true } },
      },
    }),
  ]);

  const policies = rows.map((policy) => {
    const latestPublished = policy.versions[0] ?? null;
    return {
      id: policy.id,
      name: policy.name,
      slug: policy.slug,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
      versionCount: policy._count.versions,
      latestPublishedVersion: latestPublished
        ? {
            id: latestPublished.id,
            versionLabel: latestPublished.versionLabel,
            effectiveDate: latestPublished.effectiveDate,
            status: latestPublished.status,
            publishedAt: latestPublished.publishedAt,
            publishedBy: latestPublished.publishedBy,
          }
        : null,
    };
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    policies,
  };
};

export const getLegalPolicyHistory = async (id: string) => {
  const policy = await prisma.cmsLegalPolicy.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          publishedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      },
    },
  });

  if (!policy) {
    throw new NotFoundError('Legal policy not found.');
  }

  return policy;
};

export const createLegalPolicy = async (
  adminId: string,
  adminLabel: string,
  input: CreateLegalPolicyInput
) => {
  const existingSlug = await prisma.cmsLegalPolicy.findUnique({ where: { slug: input.slug } });
  if (existingSlug) {
    throw new ConflictError('Legal policy slug already exists.');
  }

  const policy = await prisma.cmsLegalPolicy.create({
    data: {
      name: input.name,
      slug: input.slug,
    },
  });

  await writeAudit(
    'CMS_LEGAL_POLICY_CREATED',
    adminId,
    adminLabel,
    'CmsLegalPolicy',
    policy.id,
    `Created legal policy: "${policy.name}".`
  );

  return policy;
};

export const publishLegalVersion = async (
  adminId: string,
  adminLabel: string,
  policyId: string,
  input: PublishLegalVersionInput
) => {
  const policy = await prisma.cmsLegalPolicy.findUnique({ where: { id: policyId } });
  if (!policy) {
    throw new NotFoundError('Legal policy not found.');
  }

  const effectiveDate = parseOptionalDate(input.effectiveDate);
  if (!effectiveDate) {
    throw new BadRequestError('Effective date is required.');
  }

  const status = input.status ?? CmsPublishStatus.PUBLISHED;

  const version = await prisma.$transaction(async (tx) => {
    if (status === CmsPublishStatus.PUBLISHED) {
      await tx.cmsLegalPolicyVersion.updateMany({
        where: { policyId, status: CmsPublishStatus.PUBLISHED },
        data: { status: CmsPublishStatus.ARCHIVED },
      });
    }

    return tx.cmsLegalPolicyVersion.create({
      data: {
        policyId,
        versionLabel: input.versionLabel,
        content: input.content,
        effectiveDate,
        status,
        publishedById: status === CmsPublishStatus.PUBLISHED ? adminId : null,
        publishedAt: status === CmsPublishStatus.PUBLISHED ? new Date() : null,
      },
      include: {
        publishedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  });

  await writeAudit(
    'CMS_LEGAL_VERSION_PUBLISHED',
    adminId,
    adminLabel,
    'CmsLegalPolicyVersion',
    version.id,
    `Published legal version ${version.versionLabel} for "${policy.name}".`
  );

  return version;
};

// ==========================================
// SEO SETTINGS (singleton)
// ==========================================

export const getSeoSettings = async () => {
  return prisma.cmsSeoSettings.findFirst({
    include: {
      updatedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
};

export const upsertSeoSettings = async (
  adminId: string,
  adminLabel: string,
  input: UpsertSeoSettingsInput
) => {
  const existing = await prisma.cmsSeoSettings.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  const data = {
    globalSiteTitle: input.globalSiteTitle,
    metaDescription: input.metaDescription,
    metaKeywords: input.metaKeywords,
    canonicalBaseUrl: input.canonicalBaseUrl,
    ogImageUrl: input.ogImageUrl,
    twitterHandle: input.twitterHandle,
    gaMeasurementId: input.gaMeasurementId,
    robotsTxt: input.robotsTxt,
    updatedById: adminId,
  };

  const settings = existing
    ? await prisma.cmsSeoSettings.update({
        where: { id: existing.id },
        data,
        include: {
          updatedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      })
    : await prisma.cmsSeoSettings.create({
        data,
        include: {
          updatedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

  await writeAudit(
    'CMS_SEO_SETTINGS_UPSERTED',
    adminId,
    adminLabel,
    'CmsSeoSettings',
    settings.id,
    'Updated global SEO settings.'
  );

  return settings;
};
