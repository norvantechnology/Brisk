import { prisma } from '../../../config/database';
import { NotFoundError, ConflictError, BadRequestError } from '../../../utils/errors';
import { ActorType, CmsPublishStatus, Prisma } from '@prisma/client';
import {
  buildPagination,
  fromApiActiveStatus,
  fromApiBlockType,
  fromApiPublishStatus,
  serializeArticle,
  serializeBlock,
  serializeCategory,
  serializeSection,
} from './admin-website.mappers';

// ==========================================
// HELPERS
// ==========================================

export type WebsiteListFilters = {
  page?: string | number;
  per_page?: string | number;
  limit?: string | number;
  search?: string;
  status?: string;
  category_id?: string;
  featured?: string | boolean;
  sort_by?: string;
  sort_direction?: string;
};

const parsePagination = (filters: WebsiteListFilters) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const perPageRaw = filters.per_page ?? filters.limit;
  const perPage = Math.max(1, Math.min(100, Number(perPageRaw) || 20));
  const skip = (page - 1) * perPage;
  return { page, perPage, skip };
};

const parseFeatured = (value?: string | boolean): boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const parsePublishDate = (
  value: string | null | undefined,
  status: CmsPublishStatus,
  requiredWhenNotDraft: boolean
): Date | null => {
  if (value === undefined || value === null || value === '') {
    if (status === CmsPublishStatus.DRAFT || !requiredWhenNotDraft) {
      return null;
    }
    throw new BadRequestError('publish_date is required for non-draft articles.');
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError('publish_date must be a valid date.');
  }

  if (status === CmsPublishStatus.SCHEDULED && date.getTime() <= Date.now()) {
    throw new BadRequestError('publish_date must be a future date/time for scheduled articles.');
  }

  return date;
};

const assertCoverForPublished = (
  status: CmsPublishStatus,
  coverImageUrl?: string | null
) => {
  if (status === CmsPublishStatus.PUBLISHED && !coverImageUrl) {
    throw new BadRequestError('cover_image_url is required for published articles.');
  }
};

const writeAudit = async (
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

const notDeletedPosts = { deletedAt: null } as const;
const notDeletedGuides = { deletedAt: null } as const;

const categorySortMap: Record<string, Prisma.CmsBlogCategoryOrderByWithRelationInput> = {
  sort_order: { sortOrder: 'asc' },
  name: { name: 'asc' },
  created_at: { createdAt: 'desc' },
  updated_at: { updatedAt: 'desc' },
};

const articleSortMap: Record<string, Prisma.CmsBlogPostOrderByWithRelationInput> = {
  publish_date: { publishedAt: 'desc' },
  title: { title: 'asc' },
  created_at: { createdAt: 'desc' },
  updated_at: { updatedAt: 'desc' },
  reading_time: { readingTime: 'asc' },
};

const sectionSortMap: Record<string, Prisma.CmsKnowledgeGuideOrderByWithRelationInput> = {
  sort_order: { sortOrder: 'asc' },
  section_title: { title: 'asc' },
  title: { title: 'asc' },
  created_at: { createdAt: 'desc' },
  updated_at: { updatedAt: 'desc' },
};

const resolveOrderBy = <T extends Record<string, unknown>>(
  sortBy: string | undefined,
  sortDirection: string | undefined,
  map: Record<string, T>,
  fallback: T
): T => {
  const key = sortBy && map[sortBy] ? sortBy : null;
  const base = key ? { ...map[key] } : { ...fallback };
  const field = Object.keys(base)[0] as keyof T;
  if (sortDirection === 'asc' || sortDirection === 'desc') {
    (base as Record<string, string>)[field as string] = sortDirection;
  }
  return base;
};

// ==========================================
// BLOG CATEGORIES
// ==========================================

export const listCategories = async (filters: WebsiteListFilters = {}) => {
  const { page, perPage, skip } = parsePagination(filters);
  const where: Prisma.CmsBlogCategoryWhereInput = {};

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (filters.status) {
    where.status = fromApiActiveStatus(filters.status);
  }

  const orderBy = resolveOrderBy(filters.sort_by, filters.sort_direction, categorySortMap, {
    sortOrder: 'asc',
  });

  const [total, categories] = await Promise.all([
    prisma.cmsBlogCategory.count({ where }),
    prisma.cmsBlogCategory.findMany({
      where,
      skip,
      take: perPage,
      orderBy,
      include: {
        _count: {
          select: {
            posts: { where: notDeletedPosts },
          },
        },
      },
    }),
  ]);

  return {
    items: categories.map(serializeCategory),
    pagination: buildPagination(page, perPage, total),
  };
};

export const getCategoryById = async (id: string) => {
  const category = await prisma.cmsBlogCategory.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          posts: { where: notDeletedPosts },
        },
      },
    },
  });

  if (!category) {
    throw new NotFoundError('Blog category not found.');
  }

  return serializeCategory(category);
};

export const createCategory = async (
  adminId: string,
  adminLabel: string,
  input: {
    name: string;
    slug: string;
    description?: string | null;
    icon?: string | null;
    status: string;
    sort_order: number;
  }
) => {
  const existingSlug = await prisma.cmsBlogCategory.findUnique({ where: { slug: input.slug } });
  if (existingSlug) {
    throw new ConflictError('Blog category slug already exists.');
  }

  const category = await prisma.cmsBlogCategory.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      iconName: input.icon ?? null,
      status: fromApiActiveStatus(input.status),
      sortOrder: input.sort_order,
    },
    include: {
      _count: {
        select: {
          posts: { where: notDeletedPosts },
        },
      },
    },
  });

  await writeAudit(
    'WEBSITE_BLOG_CATEGORY_CREATED',
    adminId,
    adminLabel,
    'CmsBlogCategory',
    category.id,
    `Created blog category: "${category.name}".`
  );

  return serializeCategory(category);
};

export const updateCategory = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: {
    name: string;
    slug: string;
    description?: string | null;
    icon?: string | null;
    status: string;
    sort_order: number;
  }
) => {
  const existing = await prisma.cmsBlogCategory.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Blog category not found.');
  }

  if (input.slug !== existing.slug) {
    const slugConflict = await prisma.cmsBlogCategory.findUnique({ where: { slug: input.slug } });
    if (slugConflict) {
      throw new ConflictError('Blog category slug already in use.');
    }
  }

  const category = await prisma.cmsBlogCategory.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      iconName: input.icon ?? null,
      status: fromApiActiveStatus(input.status),
      sortOrder: input.sort_order,
    },
    include: {
      _count: {
        select: {
          posts: { where: notDeletedPosts },
        },
      },
    },
  });

  await writeAudit(
    'WEBSITE_BLOG_CATEGORY_UPDATED',
    adminId,
    adminLabel,
    'CmsBlogCategory',
    category.id,
    `Updated blog category: "${category.name}".`
  );

  return serializeCategory(category);
};

export const deleteCategory = async (adminId: string, adminLabel: string, id: string) => {
  const category = await prisma.cmsBlogCategory.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          posts: { where: notDeletedPosts },
        },
      },
    },
  });

  if (!category) {
    throw new NotFoundError('Blog category not found.');
  }

  if (category._count.posts > 0) {
    throw new BadRequestError(
      `Cannot delete blog category: it has ${category._count.posts} associated article(s).`
    );
  }

  await prisma.cmsBlogCategory.delete({ where: { id } });

  await writeAudit(
    'WEBSITE_BLOG_CATEGORY_DELETED',
    adminId,
    adminLabel,
    'CmsBlogCategory',
    id,
    `Deleted blog category: "${category.name}".`
  );
};

export const updateCategoryStatus = async (
  adminId: string,
  adminLabel: string,
  id: string,
  status: string
) => {
  const existing = await prisma.cmsBlogCategory.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Blog category not found.');
  }

  const category = await prisma.cmsBlogCategory.update({
    where: { id },
    data: { status: fromApiActiveStatus(status) },
    include: {
      _count: {
        select: {
          posts: { where: notDeletedPosts },
        },
      },
    },
  });

  await writeAudit(
    'WEBSITE_BLOG_CATEGORY_STATUS',
    adminId,
    adminLabel,
    'CmsBlogCategory',
    category.id,
    `Set blog category status to ${status}: "${category.name}".`
  );

  return serializeCategory(category);
};

export const updateCategorySortOrder = async (
  adminId: string,
  adminLabel: string,
  id: string,
  sortOrder: number
) => {
  const existing = await prisma.cmsBlogCategory.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Blog category not found.');
  }

  const category = await prisma.cmsBlogCategory.update({
    where: { id },
    data: { sortOrder },
    include: {
      _count: {
        select: {
          posts: { where: notDeletedPosts },
        },
      },
    },
  });

  await writeAudit(
    'WEBSITE_BLOG_CATEGORY_SORT',
    adminId,
    adminLabel,
    'CmsBlogCategory',
    category.id,
    `Updated blog category sort order to ${sortOrder}: "${category.name}".`
  );

  return serializeCategory(category);
};

export const bulkUpdateCategoryStatus = async (
  adminId: string,
  adminLabel: string,
  ids: string[],
  status: string
) => {
  const prismaStatus = fromApiActiveStatus(status);
  const result = await prisma.cmsBlogCategory.updateMany({
    where: { id: { in: ids } },
    data: { status: prismaStatus },
  });

  await writeAudit(
    'WEBSITE_BLOG_CATEGORY_BULK_STATUS',
    adminId,
    adminLabel,
    'CmsBlogCategory',
    ids[0],
    `Bulk-updated ${result.count} blog categor(y/ies) to ${status}.`
  );

  return { updated: result.count };
};

export const bulkDeleteCategories = async (
  adminId: string,
  adminLabel: string,
  ids: string[]
) => {
  const blocked = await prisma.cmsBlogCategory.findMany({
    where: {
      id: { in: ids },
      posts: { some: notDeletedPosts },
    },
    select: { id: true, name: true },
  });

  if (blocked.length) {
    throw new BadRequestError(
      `Cannot delete categories with assigned articles: ${blocked.map((c) => c.name).join(', ')}.`
    );
  }

  const result = await prisma.cmsBlogCategory.deleteMany({
    where: { id: { in: ids } },
  });

  await writeAudit(
    'WEBSITE_BLOG_CATEGORY_BULK_DELETE',
    adminId,
    adminLabel,
    'CmsBlogCategory',
    ids[0],
    `Bulk-deleted ${result.count} blog categor(y/ies).`
  );

  return { deleted: result.count };
};

// ==========================================
// BLOG ARTICLES
// ==========================================

export type ArticleInput = {
  title: string;
  category_id: string;
  slug: string;
  cover_image_url?: string | null;
  short_description: string;
  content: string;
  author_name?: string | null;
  author_role?: string | null;
  reading_time?: string | null;
  publish_date?: string | null;
  publish_status: string;
  is_featured: boolean;
  seo_title?: string | null;
  meta_description?: string | null;
};

const articleInclude = {
  category: {
    select: { id: true, name: true, slug: true },
  },
} as const;

export const listArticles = async (filters: WebsiteListFilters = {}) => {
  const { page, perPage, skip } = parsePagination(filters);
  const where: Prisma.CmsBlogPostWhereInput = { ...notDeletedPosts };

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { excerpt: { contains: search, mode: 'insensitive' } },
      { authorName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (filters.status) {
    where.status = fromApiPublishStatus(filters.status);
  }

  if (filters.category_id) {
    where.categoryId = filters.category_id;
  }

  const featured = parseFeatured(filters.featured);
  if (featured !== undefined) {
    where.isFeatured = featured;
  }

  const orderBy = resolveOrderBy(filters.sort_by, filters.sort_direction, articleSortMap, {
    publishedAt: 'desc',
  });

  const [total, posts] = await Promise.all([
    prisma.cmsBlogPost.count({ where }),
    prisma.cmsBlogPost.findMany({
      where,
      skip,
      take: perPage,
      orderBy,
      include: articleInclude,
    }),
  ]);

  return {
    items: posts.map(serializeArticle),
    pagination: buildPagination(page, perPage, total),
  };
};

export const getArticleById = async (id: string) => {
  const post = await prisma.cmsBlogPost.findFirst({
    where: { id, ...notDeletedPosts },
    include: articleInclude,
  });

  if (!post) {
    throw new NotFoundError('Blog article not found.');
  }

  return serializeArticle(post);
};

export const createArticle = async (
  adminId: string,
  adminLabel: string,
  input: ArticleInput
) => {
  const status = fromApiPublishStatus(input.publish_status);
  const coverImageUrl = input.cover_image_url ?? null;
  assertCoverForPublished(status, coverImageUrl);

  const existingSlug = await prisma.cmsBlogPost.findUnique({ where: { slug: input.slug } });
  if (existingSlug && !existingSlug.deletedAt) {
    throw new ConflictError('Blog article slug already exists.');
  }

  const category = await prisma.cmsBlogCategory.findUnique({ where: { id: input.category_id } });
  if (!category) {
    throw new NotFoundError('Blog category not found.');
  }

  const publishedAt = parsePublishDate(input.publish_date, status, true);
  const isFeatured = input.is_featured;

  const post = await prisma.$transaction(async (tx) => {
    if (isFeatured) {
      await tx.cmsBlogPost.updateMany({
        where: { isFeatured: true, ...notDeletedPosts },
        data: { isFeatured: false },
      });
    }

    return tx.cmsBlogPost.create({
      data: {
        title: input.title,
        slug: input.slug,
        categoryId: input.category_id,
        coverImageUrl,
        excerpt: input.short_description,
        content: input.content,
        authorName: input.author_name ?? null,
        authorRole: input.author_role ?? null,
        readingTime: input.reading_time ?? null,
        publishedAt,
        status,
        isFeatured,
        seoTitle: input.seo_title ?? null,
        seoDescription: input.meta_description ?? null,
        createdById: adminId,
      },
      include: articleInclude,
    });
  });

  await writeAudit(
    'WEBSITE_BLOG_ARTICLE_CREATED',
    adminId,
    adminLabel,
    'CmsBlogPost',
    post.id,
    `Created blog article: "${post.title}".`
  );

  return serializeArticle(post);
};

export const updateArticle = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: ArticleInput
) => {
  const existing = await prisma.cmsBlogPost.findFirst({
    where: { id, ...notDeletedPosts },
  });
  if (!existing) {
    throw new NotFoundError('Blog article not found.');
  }

  const status = fromApiPublishStatus(input.publish_status);
  const coverImageUrl =
    input.cover_image_url !== undefined ? input.cover_image_url : existing.coverImageUrl;
  assertCoverForPublished(status, coverImageUrl);

  if (input.slug !== existing.slug) {
    const slugConflict = await prisma.cmsBlogPost.findFirst({
      where: { slug: input.slug, deletedAt: null, id: { not: id } },
    });
    if (slugConflict) {
      throw new ConflictError('Blog article slug already in use.');
    }
  }

  const category = await prisma.cmsBlogCategory.findUnique({ where: { id: input.category_id } });
  if (!category) {
    throw new NotFoundError('Blog category not found.');
  }

  const publishedAt = parsePublishDate(input.publish_date, status, true);

  const post = await prisma.$transaction(async (tx) => {
    if (input.is_featured) {
      await tx.cmsBlogPost.updateMany({
        where: { isFeatured: true, id: { not: id }, ...notDeletedPosts },
        data: { isFeatured: false },
      });
    }

    return tx.cmsBlogPost.update({
      where: { id },
      data: {
        title: input.title,
        slug: input.slug,
        categoryId: input.category_id,
        coverImageUrl,
        excerpt: input.short_description,
        content: input.content,
        authorName: input.author_name ?? null,
        authorRole: input.author_role ?? null,
        readingTime: input.reading_time ?? null,
        publishedAt,
        status,
        isFeatured: input.is_featured,
        seoTitle: input.seo_title ?? null,
        seoDescription: input.meta_description ?? null,
      },
      include: articleInclude,
    });
  });

  await writeAudit(
    'WEBSITE_BLOG_ARTICLE_UPDATED',
    adminId,
    adminLabel,
    'CmsBlogPost',
    post.id,
    `Updated blog article: "${post.title}".`
  );

  return serializeArticle(post);
};

export const softDeleteArticle = async (adminId: string, adminLabel: string, id: string) => {
  const existing = await prisma.cmsBlogPost.findFirst({
    where: { id, ...notDeletedPosts },
  });
  if (!existing) {
    throw new NotFoundError('Blog article not found.');
  }

  await prisma.cmsBlogPost.update({
    where: { id },
    data: { deletedAt: new Date(), isFeatured: false },
  });

  await writeAudit(
    'WEBSITE_BLOG_ARTICLE_DELETED',
    adminId,
    adminLabel,
    'CmsBlogPost',
    id,
    `Soft-deleted blog article: "${existing.title}".`
  );
};

export const updateArticleStatus = async (
  adminId: string,
  adminLabel: string,
  id: string,
  publishStatus: string
) => {
  const existing = await prisma.cmsBlogPost.findFirst({
    where: { id, ...notDeletedPosts },
  });
  if (!existing) {
    throw new NotFoundError('Blog article not found.');
  }

  const status = fromApiPublishStatus(publishStatus);
  assertCoverForPublished(status, existing.coverImageUrl);

  if (status === CmsPublishStatus.SCHEDULED) {
    if (!existing.publishedAt || existing.publishedAt.getTime() <= Date.now()) {
      throw new BadRequestError(
        'Scheduled articles require a future publish_date. Update the article first.'
      );
    }
  }

  const post = await prisma.cmsBlogPost.update({
    where: { id },
    data: {
      status,
      ...(status === CmsPublishStatus.PUBLISHED && !existing.publishedAt
        ? { publishedAt: new Date() }
        : {}),
    },
    include: articleInclude,
  });

  await writeAudit(
    'WEBSITE_BLOG_ARTICLE_STATUS',
    adminId,
    adminLabel,
    'CmsBlogPost',
    post.id,
    `Set blog article status to ${publishStatus}: "${post.title}".`
  );

  return serializeArticle(post);
};

export const updateArticleFeatured = async (
  adminId: string,
  adminLabel: string,
  id: string,
  isFeatured: boolean
) => {
  const existing = await prisma.cmsBlogPost.findFirst({
    where: { id, ...notDeletedPosts },
  });
  if (!existing) {
    throw new NotFoundError('Blog article not found.');
  }

  const post = await prisma.$transaction(async (tx) => {
    if (isFeatured) {
      await tx.cmsBlogPost.updateMany({
        where: { isFeatured: true, ...notDeletedPosts },
        data: { isFeatured: false },
      });
    }

    return tx.cmsBlogPost.update({
      where: { id },
      data: { isFeatured },
      include: articleInclude,
    });
  });

  await writeAudit(
    'WEBSITE_BLOG_ARTICLE_FEATURED',
    adminId,
    adminLabel,
    'CmsBlogPost',
    post.id,
    `${isFeatured ? 'Enabled' : 'Disabled'} featured spotlight for: "${post.title}".`
  );

  return serializeArticle(post);
};

export const setArticleCoverImage = async (
  adminId: string,
  adminLabel: string,
  id: string,
  coverImageUrl: string
) => {
  const existing = await prisma.cmsBlogPost.findFirst({
    where: { id, ...notDeletedPosts },
  });
  if (!existing) {
    throw new NotFoundError('Blog article not found.');
  }

  const post = await prisma.cmsBlogPost.update({
    where: { id },
    data: { coverImageUrl },
    include: articleInclude,
  });

  await writeAudit(
    'WEBSITE_BLOG_ARTICLE_COVER',
    adminId,
    adminLabel,
    'CmsBlogPost',
    post.id,
    `Updated cover image for blog article: "${post.title}".`
  );

  return serializeArticle(post);
};

export const removeArticleCoverImage = async (
  adminId: string,
  adminLabel: string,
  id: string
) => {
  const existing = await prisma.cmsBlogPost.findFirst({
    where: { id, ...notDeletedPosts },
  });
  if (!existing) {
    throw new NotFoundError('Blog article not found.');
  }

  if (existing.status === CmsPublishStatus.PUBLISHED) {
    throw new BadRequestError('Cannot remove cover image from a published article.');
  }

  const post = await prisma.cmsBlogPost.update({
    where: { id },
    data: { coverImageUrl: null },
    include: articleInclude,
  });

  await writeAudit(
    'WEBSITE_BLOG_ARTICLE_COVER_REMOVED',
    adminId,
    adminLabel,
    'CmsBlogPost',
    post.id,
    `Removed cover image for blog article: "${post.title}".`
  );

  return serializeArticle(post);
};

export const bulkUpdateArticleStatus = async (
  adminId: string,
  adminLabel: string,
  ids: string[],
  publishStatus: string
) => {
  const status = fromApiPublishStatus(publishStatus);
  const result = await prisma.cmsBlogPost.updateMany({
    where: { id: { in: ids }, ...notDeletedPosts },
    data: { status },
  });

  await writeAudit(
    'WEBSITE_BLOG_ARTICLE_BULK_STATUS',
    adminId,
    adminLabel,
    'CmsBlogPost',
    ids[0],
    `Bulk-updated ${result.count} blog article(s) to ${publishStatus}.`
  );

  return { updated: result.count };
};

export const bulkSoftDeleteArticles = async (
  adminId: string,
  adminLabel: string,
  ids: string[]
) => {
  const result = await prisma.cmsBlogPost.updateMany({
    where: { id: { in: ids }, ...notDeletedPosts },
    data: { deletedAt: new Date(), isFeatured: false },
  });

  await writeAudit(
    'WEBSITE_BLOG_ARTICLE_BULK_DELETE',
    adminId,
    adminLabel,
    'CmsBlogPost',
    ids[0],
    `Bulk soft-deleted ${result.count} blog article(s).`
  );

  return { deleted: result.count };
};

// ==========================================
// KNOWLEDGE HUB
// ==========================================

export type BlockInput = {
  type: string;
  sort_order: number;
  title?: string | null;
  description?: string | null;
  icon?: string | null;
  image?: string | null;
  button_text?: string | null;
  button_url?: string | null;
  content?: string | null;
};

export type SectionInput = {
  section_title: string;
  slug: string;
  short_description: string;
  detailed_content?: string | null;
  graphic_image_url?: string | null;
  icon?: string | null;
  publishing_status: string;
  cta_button_text?: string | null;
  cta_url?: string | null;
  sort_order: number;
  seo_title?: string | null;
  meta_description?: string | null;
  content_blocks?: BlockInput[];
};

const mapBlockCreate = (block: BlockInput) => ({
  blockType: fromApiBlockType(block.type),
  title: block.title ?? null,
  description: block.description ?? null,
  content: block.content ?? null,
  iconName: block.icon ?? null,
  imageUrl: block.image ?? null,
  buttonText: block.button_text ?? null,
  buttonUrl: block.button_url ?? null,
  sortOrder: block.sort_order,
});

export const listSections = async (filters: WebsiteListFilters = {}) => {
  const { page, perPage, skip } = parsePagination(filters);
  const where: Prisma.CmsKnowledgeGuideWhereInput = { ...notDeletedGuides };

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (filters.status) {
    where.status = fromApiPublishStatus(filters.status);
  }

  const orderBy = resolveOrderBy(filters.sort_by, filters.sort_direction, sectionSortMap, {
    sortOrder: 'asc',
  });

  const [total, guides] = await Promise.all([
    prisma.cmsKnowledgeGuide.count({ where }),
    prisma.cmsKnowledgeGuide.findMany({
      where,
      skip,
      take: perPage,
      orderBy,
      include: {
        _count: { select: { blocks: true } },
      },
    }),
  ]);

  return {
    items: guides.map((g) => serializeSection(g)),
    pagination: buildPagination(page, perPage, total),
  };
};

export const getSectionById = async (id: string) => {
  const guide = await prisma.cmsKnowledgeGuide.findFirst({
    where: { id, ...notDeletedGuides },
    include: {
      blocks: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { blocks: true } },
    },
  });

  if (!guide) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  return serializeSection(guide, { includeBlocks: true });
};

export const createSection = async (
  adminId: string,
  adminLabel: string,
  input: SectionInput
) => {
  const existingSlug = await prisma.cmsKnowledgeGuide.findUnique({ where: { slug: input.slug } });
  if (existingSlug && !existingSlug.deletedAt) {
    throw new ConflictError('Knowledge Hub section slug already exists.');
  }

  const status = fromApiPublishStatus(input.publishing_status);

  const guide = await prisma.cmsKnowledgeGuide.create({
    data: {
      title: input.section_title,
      slug: input.slug,
      description: input.short_description,
      detailedContent: input.detailed_content ?? null,
      graphicImageUrl: input.graphic_image_url ?? null,
      iconName: input.icon ?? null,
      status,
      ctaButtonText: input.cta_button_text ?? null,
      ctaUrl: input.cta_url ?? null,
      sortOrder: input.sort_order,
      seoTitle: input.seo_title ?? null,
      seoDescription: input.meta_description ?? null,
      blocks: input.content_blocks?.length
        ? {
            create: input.content_blocks.map(mapBlockCreate),
          }
        : undefined,
    },
    include: {
      blocks: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { blocks: true } },
    },
  });

  await writeAudit(
    'WEBSITE_KNOWLEDGE_SECTION_CREATED',
    adminId,
    adminLabel,
    'CmsKnowledgeGuide',
    guide.id,
    `Created Knowledge Hub section: "${guide.title}".`
  );

  return serializeSection(guide, { includeBlocks: true });
};

export const updateSection = async (
  adminId: string,
  adminLabel: string,
  id: string,
  input: SectionInput
) => {
  const existing = await prisma.cmsKnowledgeGuide.findFirst({
    where: { id, ...notDeletedGuides },
  });
  if (!existing) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  if (input.slug !== existing.slug) {
    const slugConflict = await prisma.cmsKnowledgeGuide.findFirst({
      where: { slug: input.slug, deletedAt: null, id: { not: id } },
    });
    if (slugConflict) {
      throw new ConflictError('Knowledge Hub section slug already in use.');
    }
  }

  const status = fromApiPublishStatus(input.publishing_status);

  const guide = await prisma.$transaction(async (tx) => {
    if (input.content_blocks) {
      await tx.cmsKnowledgeBlock.deleteMany({ where: { guideId: id } });
      if (input.content_blocks.length) {
        await tx.cmsKnowledgeBlock.createMany({
          data: input.content_blocks.map((block) => ({
            guideId: id,
            ...mapBlockCreate(block),
          })),
        });
      }
    }

    return tx.cmsKnowledgeGuide.update({
      where: { id },
      data: {
        title: input.section_title,
        slug: input.slug,
        description: input.short_description,
        detailedContent: input.detailed_content ?? null,
        ...(input.graphic_image_url !== undefined
          ? { graphicImageUrl: input.graphic_image_url ?? null }
          : {}),
        iconName: input.icon ?? null,
        status,
        ctaButtonText: input.cta_button_text ?? null,
        ctaUrl: input.cta_url ?? null,
        sortOrder: input.sort_order,
        seoTitle: input.seo_title ?? null,
        seoDescription: input.meta_description ?? null,
      },
      include: {
        blocks: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { blocks: true } },
      },
    });
  });

  await writeAudit(
    'WEBSITE_KNOWLEDGE_SECTION_UPDATED',
    adminId,
    adminLabel,
    'CmsKnowledgeGuide',
    guide.id,
    `Updated Knowledge Hub section: "${guide.title}".`
  );

  return serializeSection(guide, { includeBlocks: true });
};

export const softDeleteSection = async (adminId: string, adminLabel: string, id: string) => {
  const existing = await prisma.cmsKnowledgeGuide.findFirst({
    where: { id, ...notDeletedGuides },
  });
  if (!existing) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  await prisma.cmsKnowledgeGuide.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await writeAudit(
    'WEBSITE_KNOWLEDGE_SECTION_DELETED',
    adminId,
    adminLabel,
    'CmsKnowledgeGuide',
    id,
    `Soft-deleted Knowledge Hub section: "${existing.title}".`
  );
};

export const updateSectionStatus = async (
  adminId: string,
  adminLabel: string,
  id: string,
  publishingStatus: string
) => {
  const existing = await prisma.cmsKnowledgeGuide.findFirst({
    where: { id, ...notDeletedGuides },
  });
  if (!existing) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  const guide = await prisma.cmsKnowledgeGuide.update({
    where: { id },
    data: { status: fromApiPublishStatus(publishingStatus) },
    include: {
      _count: { select: { blocks: true } },
    },
  });

  await writeAudit(
    'WEBSITE_KNOWLEDGE_SECTION_STATUS',
    adminId,
    adminLabel,
    'CmsKnowledgeGuide',
    guide.id,
    `Set Knowledge Hub section status to ${publishingStatus}: "${guide.title}".`
  );

  return serializeSection(guide);
};

export const updateSectionSortOrder = async (
  adminId: string,
  adminLabel: string,
  id: string,
  sortOrder: number
) => {
  const existing = await prisma.cmsKnowledgeGuide.findFirst({
    where: { id, ...notDeletedGuides },
  });
  if (!existing) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  const guide = await prisma.cmsKnowledgeGuide.update({
    where: { id },
    data: { sortOrder },
    include: {
      _count: { select: { blocks: true } },
    },
  });

  await writeAudit(
    'WEBSITE_KNOWLEDGE_SECTION_SORT',
    adminId,
    adminLabel,
    'CmsKnowledgeGuide',
    guide.id,
    `Updated Knowledge Hub section sort order to ${sortOrder}: "${guide.title}".`
  );

  return serializeSection(guide);
};

export const setSectionGraphic = async (
  adminId: string,
  adminLabel: string,
  id: string,
  graphicImageUrl: string
) => {
  const existing = await prisma.cmsKnowledgeGuide.findFirst({
    where: { id, ...notDeletedGuides },
  });
  if (!existing) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  const guide = await prisma.cmsKnowledgeGuide.update({
    where: { id },
    data: { graphicImageUrl },
    include: {
      _count: { select: { blocks: true } },
    },
  });

  await writeAudit(
    'WEBSITE_KNOWLEDGE_SECTION_GRAPHIC',
    adminId,
    adminLabel,
    'CmsKnowledgeGuide',
    guide.id,
    `Updated graphic for Knowledge Hub section: "${guide.title}".`
  );

  return {
    id: guide.id,
    graphic_image: guide.graphicImageUrl,
  };
};

export const removeSectionGraphic = async (
  adminId: string,
  adminLabel: string,
  id: string
) => {
  const existing = await prisma.cmsKnowledgeGuide.findFirst({
    where: { id, ...notDeletedGuides },
  });
  if (!existing) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  const guide = await prisma.cmsKnowledgeGuide.update({
    where: { id },
    data: { graphicImageUrl: null },
    include: {
      _count: { select: { blocks: true } },
    },
  });

  await writeAudit(
    'WEBSITE_KNOWLEDGE_SECTION_GRAPHIC_REMOVED',
    adminId,
    adminLabel,
    'CmsKnowledgeGuide',
    guide.id,
    `Removed graphic for Knowledge Hub section: "${guide.title}".`
  );

  return {
    id: guide.id,
    graphic_image: null,
  };
};

export const listBlocks = async (sectionId: string) => {
  const guide = await prisma.cmsKnowledgeGuide.findFirst({
    where: { id: sectionId, ...notDeletedGuides },
  });
  if (!guide) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  const blocks = await prisma.cmsKnowledgeBlock.findMany({
    where: { guideId: sectionId },
    orderBy: { sortOrder: 'asc' },
  });

  return { items: blocks.map(serializeBlock) };
};

export const createBlock = async (
  adminId: string,
  adminLabel: string,
  sectionId: string,
  input: BlockInput
) => {
  const guide = await prisma.cmsKnowledgeGuide.findFirst({
    where: { id: sectionId, ...notDeletedGuides },
  });
  if (!guide) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  const block = await prisma.cmsKnowledgeBlock.create({
    data: {
      guideId: sectionId,
      ...mapBlockCreate(input),
    },
  });

  await writeAudit(
    'WEBSITE_KNOWLEDGE_BLOCK_CREATED',
    adminId,
    adminLabel,
    'CmsKnowledgeBlock',
    block.id,
    `Added content block to Knowledge Hub section: "${guide.title}".`
  );

  return serializeBlock(block);
};

export const updateBlock = async (
  adminId: string,
  adminLabel: string,
  sectionId: string,
  blockId: string,
  input: BlockInput
) => {
  const guide = await prisma.cmsKnowledgeGuide.findFirst({
    where: { id: sectionId, ...notDeletedGuides },
  });
  if (!guide) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  const existing = await prisma.cmsKnowledgeBlock.findFirst({
    where: { id: blockId, guideId: sectionId },
  });
  if (!existing) {
    throw new NotFoundError('Content block not found.');
  }

  const block = await prisma.cmsKnowledgeBlock.update({
    where: { id: blockId },
    data: mapBlockCreate(input),
  });

  await writeAudit(
    'WEBSITE_KNOWLEDGE_BLOCK_UPDATED',
    adminId,
    adminLabel,
    'CmsKnowledgeBlock',
    block.id,
    `Updated content block on Knowledge Hub section: "${guide.title}".`
  );

  return serializeBlock(block);
};

export const deleteBlock = async (
  adminId: string,
  adminLabel: string,
  sectionId: string,
  blockId: string
) => {
  const guide = await prisma.cmsKnowledgeGuide.findFirst({
    where: { id: sectionId, ...notDeletedGuides },
  });
  if (!guide) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  const existing = await prisma.cmsKnowledgeBlock.findFirst({
    where: { id: blockId, guideId: sectionId },
  });
  if (!existing) {
    throw new NotFoundError('Content block not found.');
  }

  await prisma.cmsKnowledgeBlock.delete({ where: { id: blockId } });

  await writeAudit(
    'WEBSITE_KNOWLEDGE_BLOCK_DELETED',
    adminId,
    adminLabel,
    'CmsKnowledgeBlock',
    blockId,
    `Deleted content block from Knowledge Hub section: "${guide.title}".`
  );
};

export const reorderBlocks = async (
  adminId: string,
  adminLabel: string,
  sectionId: string,
  blocks: { id: string; sort_order: number }[]
) => {
  const guide = await prisma.cmsKnowledgeGuide.findFirst({
    where: { id: sectionId, ...notDeletedGuides },
  });
  if (!guide) {
    throw new NotFoundError('Knowledge Hub section not found.');
  }

  await prisma.$transaction(
    blocks.map((item) =>
      prisma.cmsKnowledgeBlock.updateMany({
        where: { id: item.id, guideId: sectionId },
        data: { sortOrder: item.sort_order },
      })
    )
  );

  await writeAudit(
    'WEBSITE_KNOWLEDGE_BLOCKS_REORDERED',
    adminId,
    adminLabel,
    'CmsKnowledgeGuide',
    sectionId,
    `Reordered ${blocks.length} content block(s) for: "${guide.title}".`
  );

  return listBlocks(sectionId);
};

export const bulkUpdateSectionStatus = async (
  adminId: string,
  adminLabel: string,
  ids: string[],
  publishingStatus: string
) => {
  const status = fromApiPublishStatus(publishingStatus);
  const result = await prisma.cmsKnowledgeGuide.updateMany({
    where: { id: { in: ids }, ...notDeletedGuides },
    data: { status },
  });

  await writeAudit(
    'WEBSITE_KNOWLEDGE_SECTION_BULK_STATUS',
    adminId,
    adminLabel,
    'CmsKnowledgeGuide',
    ids[0],
    `Bulk-updated ${result.count} Knowledge Hub section(s) to ${publishingStatus}.`
  );

  return { updated: result.count };
};

export const bulkSoftDeleteSections = async (
  adminId: string,
  adminLabel: string,
  ids: string[]
) => {
  const result = await prisma.cmsKnowledgeGuide.updateMany({
    where: { id: { in: ids }, ...notDeletedGuides },
    data: { deletedAt: new Date() },
  });

  await writeAudit(
    'WEBSITE_KNOWLEDGE_SECTION_BULK_DELETE',
    adminId,
    adminLabel,
    'CmsKnowledgeGuide',
    ids[0],
    `Bulk soft-deleted ${result.count} Knowledge Hub section(s).`
  );

  return { deleted: result.count };
};
