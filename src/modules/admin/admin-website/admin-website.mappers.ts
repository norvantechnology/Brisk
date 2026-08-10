import {
  CmsActiveStatus,
  CmsBlogCategory,
  CmsBlogPost,
  CmsKnowledgeBlock,
  CmsKnowledgeBlockType,
  CmsKnowledgeGuide,
  CmsPublishStatus,
} from '@prisma/client';
import { BadRequestError } from '../../../utils/errors';

// ==========================================
// STATUS / ENUM HELPERS
// ==========================================

export type ApiActiveStatus = 'active' | 'inactive';
export type ApiPublishStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type ApiBlockType = 'step_card' | 'feature_card' | 'text_block' | 'cta_banner';

export const toApiActiveStatus = (status: CmsActiveStatus): ApiActiveStatus =>
  status === CmsActiveStatus.ACTIVE ? 'active' : 'inactive';

export const fromApiActiveStatus = (status: string): CmsActiveStatus => {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'active') return CmsActiveStatus.ACTIVE;
  if (normalized === 'inactive') return CmsActiveStatus.INACTIVE;
  throw new BadRequestError('Status must be active or inactive.');
};

export const toApiPublishStatus = (status: CmsPublishStatus): ApiPublishStatus => {
  switch (status) {
    case CmsPublishStatus.DRAFT:
      return 'draft';
    case CmsPublishStatus.SCHEDULED:
      return 'scheduled';
    case CmsPublishStatus.PUBLISHED:
      return 'published';
    case CmsPublishStatus.ARCHIVED:
      return 'archived';
    default:
      return 'draft';
  }
};

export const fromApiPublishStatus = (status: string): CmsPublishStatus => {
  const normalized = status.trim().toLowerCase();
  switch (normalized) {
    case 'draft':
      return CmsPublishStatus.DRAFT;
    case 'scheduled':
      return CmsPublishStatus.SCHEDULED;
    case 'published':
      return CmsPublishStatus.PUBLISHED;
    case 'archived':
      return CmsPublishStatus.ARCHIVED;
    default:
      throw new BadRequestError(
        'Publish status must be draft, scheduled, published, or archived.'
      );
  }
};

export const toApiBlockType = (type: CmsKnowledgeBlockType): ApiBlockType => {
  switch (type) {
    case CmsKnowledgeBlockType.STEP_CARD:
      return 'step_card';
    case CmsKnowledgeBlockType.FEATURE_CARD:
      return 'feature_card';
    case CmsKnowledgeBlockType.TEXT_BLOCK:
      return 'text_block';
    case CmsKnowledgeBlockType.CTA_BANNER:
      return 'cta_banner';
    default:
      return 'text_block';
  }
};

export const fromApiBlockType = (type: string): CmsKnowledgeBlockType => {
  const normalized = type.trim().toLowerCase();
  switch (normalized) {
    case 'step_card':
      return CmsKnowledgeBlockType.STEP_CARD;
    case 'feature_card':
      return CmsKnowledgeBlockType.FEATURE_CARD;
    case 'text_block':
      return CmsKnowledgeBlockType.TEXT_BLOCK;
    case 'cta_banner':
      return CmsKnowledgeBlockType.CTA_BANNER;
    default:
      throw new BadRequestError(
        'Block type must be step_card, feature_card, text_block, or cta_banner.'
      );
  }
};

export const buildPagination = (page: number, perPage: number, total: number) => ({
  current_page: page,
  per_page: perPage,
  total,
  last_page: Math.max(1, Math.ceil(total / perPage) || 1),
});

export const formatDateOnly = (value: Date | null | undefined): string | null => {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
};

// ==========================================
// SERIALIZERS (snake_case API contract)
// ==========================================

export const serializeCategory = (
  category: CmsBlogCategory & { _count?: { posts: number } }
) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  description: category.description,
  icon: category.iconName,
  status: toApiActiveStatus(category.status),
  sort_order: category.sortOrder,
  posts_count: category._count?.posts,
  created_at: category.createdAt,
  updated_at: category.updatedAt,
});

export const serializeArticle = (
  post: CmsBlogPost & {
    category?: Pick<CmsBlogCategory, 'id' | 'name' | 'slug'> | null;
  }
) => ({
  id: post.id,
  title: post.title,
  slug: post.slug,
  category_id: post.categoryId,
  category: post.category
    ? {
        id: post.category.id,
        name: post.category.name,
        slug: post.category.slug,
      }
    : null,
  cover_image: post.coverImageUrl,
  short_description: post.excerpt,
  content: post.content,
  author_name: post.authorName,
  author_role: post.authorRole,
  reading_time: post.readingTime,
  publish_date: formatDateOnly(post.publishedAt),
  publish_status: toApiPublishStatus(post.status),
  is_featured: post.isFeatured,
  seo_title: post.seoTitle,
  meta_description: post.seoDescription,
  created_at: post.createdAt,
  updated_at: post.updatedAt,
});

export const serializeBlock = (block: CmsKnowledgeBlock) => ({
  id: block.id,
  type: toApiBlockType(block.blockType),
  title: block.title,
  description: block.description,
  content: block.content,
  icon: block.iconName,
  image: block.imageUrl,
  button_text: block.buttonText,
  button_url: block.buttonUrl,
  sort_order: block.sortOrder,
  created_at: block.createdAt,
  updated_at: block.updatedAt,
});

export const serializeSection = (
  guide: CmsKnowledgeGuide & {
    blocks?: CmsKnowledgeBlock[];
    _count?: { blocks: number };
  },
  options?: { includeBlocks?: boolean }
) => {
  const base = {
    id: guide.id,
    section_title: guide.title,
    slug: guide.slug,
    short_description: guide.description,
    detailed_content: guide.detailedContent,
    graphic_image: guide.graphicImageUrl,
    icon: guide.iconName,
    publishing_status: toApiPublishStatus(guide.status),
    cta_button_text: guide.ctaButtonText,
    cta_url: guide.ctaUrl,
    sort_order: guide.sortOrder,
    seo_title: guide.seoTitle,
    meta_description: guide.seoDescription,
    blocks_count: guide._count?.blocks ?? guide.blocks?.length,
    created_at: guide.createdAt,
    updated_at: guide.updatedAt,
  };

  if (options?.includeBlocks && guide.blocks) {
    return {
      ...base,
      content_blocks: guide.blocks.map(serializeBlock),
    };
  }

  return base;
};
