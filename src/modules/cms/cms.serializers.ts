import {
  CmsAudience,
  CmsBlogCategory,
  CmsBlogPost,
  CmsFaq,
  CmsFaqCategory,
  CmsKnowledgeBlock,
  CmsKnowledgeGuide,
  CmsLegalPolicy,
  CmsLegalPolicyVersion,
  CmsSeoSettings,
  CmsSocialLink,
  CmsStaticPage,
  CmsTestimonial,
} from '@prisma/client';
import {
  toApiActiveStatus,
  toApiBlockType,
  toApiPublishStatus,
  formatDateOnly,
} from '../admin/admin-website/admin-website.mappers';

const toApiAudience = (audience: CmsAudience): string => audience.toLowerCase();

export const serializePublicPage = (page: CmsStaticPage) => ({
  id: page.id,
  title: page.title,
  slug: page.slug,
  content: page.content,
  target_audience: toApiAudience(page.targetAudience),
  status: toApiPublishStatus(page.status),
  updated_at: page.updatedAt,
});

export const serializePublicPageSummary = (
  page: Pick<CmsStaticPage, 'id' | 'title' | 'slug' | 'targetAudience' | 'updatedAt'>
) => ({
  id: page.id,
  title: page.title,
  slug: page.slug,
  target_audience: toApiAudience(page.targetAudience),
  updated_at: page.updatedAt,
});

export const serializePublicSocialLink = (link: CmsSocialLink) => ({
  id: link.id,
  platform: link.platform,
  profile_url: link.profileUrl,
  sort_order: link.sortOrder,
  status: toApiActiveStatus(link.status),
});

export const serializePublicBlock = (block: CmsKnowledgeBlock) => ({
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
});

export const serializePublicSectionCard = (
  guide: CmsKnowledgeGuide & { _count?: { blocks: number } }
) => ({
  id: guide.id,
  section_title: guide.title,
  slug: guide.slug,
  short_description: guide.description,
  graphic_image: guide.graphicImageUrl,
  icon: guide.iconName,
  cta_button_text: guide.ctaButtonText,
  cta_url: guide.ctaUrl,
  sort_order: guide.sortOrder,
  blocks_count: guide._count?.blocks ?? 0,
  updated_at: guide.updatedAt,
});

export const serializePublicSectionDetail = (
  guide: CmsKnowledgeGuide & { blocks: CmsKnowledgeBlock[] }
) => ({
  ...serializePublicSectionCard(guide),
  detailed_content: guide.detailedContent,
  seo_title: guide.seoTitle,
  meta_description: guide.seoDescription,
  content_blocks: guide.blocks.map(serializePublicBlock),
});

export const serializePublicBlogCategory = (
  category: CmsBlogCategory & { _count?: { posts: number } }
) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  description: category.description,
  icon: category.iconName,
  sort_order: category.sortOrder,
  posts_count: category._count?.posts ?? 0,
});

type BlogWithCategory = CmsBlogPost & {
  category?: Pick<CmsBlogCategory, 'id' | 'name' | 'slug' | 'iconName'> | null;
};

export const serializePublicArticleCard = (post: BlogWithCategory) => ({
  id: post.id,
  title: post.title,
  slug: post.slug,
  category_id: post.categoryId,
  category: post.category
    ? {
        id: post.category.id,
        name: post.category.name,
        slug: post.category.slug,
        icon: post.category.iconName,
      }
    : null,
  cover_image: post.coverImageUrl,
  short_description: post.excerpt,
  author_name: post.authorName,
  author_role: post.authorRole,
  reading_time: post.readingTime,
  publish_date: formatDateOnly(post.publishedAt),
  is_featured: post.isFeatured,
  seo_title: post.seoTitle,
  meta_description: post.seoDescription,
});

export const serializePublicArticleDetail = (post: BlogWithCategory) => ({
  ...serializePublicArticleCard(post),
  content: post.content,
});

export const serializePublicFaq = (
  faq: CmsFaq & {
    category?: Pick<CmsFaqCategory, 'id' | 'name' | 'slug'> | null;
  }
) => ({
  id: faq.id,
  question: faq.question,
  answer: faq.answer,
  category: faq.category
    ? {
        id: faq.category.id,
        name: faq.category.name,
        slug: faq.category.slug,
      }
    : null,
  target_audience: toApiAudience(faq.targetAudience),
  display_order: faq.displayOrder,
});

export const serializePublicFaqCategory = (
  category: CmsFaqCategory & { _count?: { faqs: number } }
) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  faqs_count: category._count?.faqs ?? 0,
});

export const serializePublicTestimonial = (item: CmsTestimonial) => ({
  id: item.id,
  author_name: item.authorName,
  author_role: item.authorRole,
  company_name: item.companyName,
  badge_label: item.badgeLabel,
  author_avatar: item.authorAvatarUrl,
  quote: item.quoteText,
  rating: item.rating,
  target_audience: toApiAudience(item.targetAudience),
  is_featured: item.isFeatured,
  display_order: item.displayOrder,
});

export const serializePublicLegalSummary = (
  policy: CmsLegalPolicy & {
    versions: Pick<CmsLegalPolicyVersion, 'versionLabel' | 'effectiveDate' | 'publishedAt'>[];
  }
) => {
  const current = policy.versions[0];
  return {
    id: policy.id,
    name: policy.name,
    slug: policy.slug,
    current_version: current?.versionLabel ?? null,
    effective_date: current?.effectiveDate ?? null,
    published_at: current?.publishedAt ?? null,
  };
};

export const serializePublicLegalDetail = (
  policy: CmsLegalPolicy,
  version: CmsLegalPolicyVersion
) => ({
  id: policy.id,
  name: policy.name,
  slug: policy.slug,
  version: {
    id: version.id,
    version_label: version.versionLabel,
    content: version.content,
    effective_date: version.effectiveDate,
    published_at: version.publishedAt,
    status: toApiPublishStatus(version.status),
  },
});

export const serializePublicSeo = (seo: CmsSeoSettings) => ({
  global_site_title: seo.globalSiteTitle,
  meta_description: seo.metaDescription,
  meta_keywords: seo.metaKeywords,
  canonical_base_url: seo.canonicalBaseUrl,
  og_image_url: seo.ogImageUrl,
  twitter_handle: seo.twitterHandle,
  ga_measurement_id: seo.gaMeasurementId,
  robots_txt: seo.robotsTxt,
  updated_at: seo.updatedAt,
});
