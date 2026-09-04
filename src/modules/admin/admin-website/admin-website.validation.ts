import { z } from 'zod';

const uuid = z.string().uuid('Invalid ID format.');

const activeStatusEnum = z.enum(['active', 'inactive']);
const publishStatusEnum = z.enum(['draft', 'scheduled', 'published', 'archived']);
const blockTypeEnum = z.enum(['step_card', 'feature_card', 'text_block', 'cta_banner']);
const sortDirectionEnum = z.enum(['asc', 'desc']);

/** Valid http(s) URL; empty string → undefined. */
export const optionalImageUrl = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  return val;
}, z.string().url().optional());

/** Valid http(s) URL; empty string → null (for nullable DB fields). */
export const optionalImageUrlNullable = z.preprocess((val) => {
  if (val === '' || val === null) return null;
  if (val === undefined) return undefined;
  return val;
}, z.string().url().nullable().optional());

/** Required valid http(s) URL (JSON string only; multipart/S3 later). */
export const requiredImageUrl = z.string().url('Must be a valid http(s) URL.');

const aliasField = (canonical: string, alias: string) => (raw: unknown) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  if (obj[canonical] === undefined && obj[alias] !== undefined) {
    obj[canonical] = obj[alias];
  }
  delete obj[alias];
  return obj;
};

const aliasCoverImage = aliasField('cover_image_url', 'cover_image');
const aliasGraphicImage = aliasField('graphic_image_url', 'graphic_image');
const aliasBlockImage = aliasField('image', 'image_url');

const paginationQuery = {
  page: z.string().optional(),
  per_page: z.string().optional(),
  limit: z.string().optional(),
};

export const idParamSchema = z.object({
  params: z.object({
    id: uuid,
  }),
});

export const sectionBlockParamsSchema = z.object({
  params: z.object({
    id: uuid,
    blockId: uuid,
  }),
});

// ==========================================
// BLOG CATEGORIES
// ==========================================

export const listCategoriesQuerySchema = z.object({
  query: z.object({
    ...paginationQuery,
    search: z.string().optional(),
    status: activeStatusEnum.optional(),
    sort_by: z.string().optional(),
    sort_direction: sortDirectionEnum.optional(),
  }),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(150),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().max(500).optional().nullable(),
    status: activeStatusEnum,
    sort_order: z.number().int().min(0),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(150),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().max(500).optional().nullable(),
    status: activeStatusEnum,
    sort_order: z.number().int().min(0),
  }),
});

export const patchCategoryStatusSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    status: activeStatusEnum,
  }),
});

export const patchCategorySortOrderSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    sort_order: z.number().int().min(0),
  }),
});

export const bulkCategoryStatusSchema = z.object({
  body: z.object({
    ids: z.array(uuid).min(1),
    status: activeStatusEnum,
  }),
});

export const bulkCategoryDeleteSchema = z.object({
  body: z.object({
    ids: z.array(uuid).min(1),
  }),
});

// ==========================================
// BLOG ARTICLES
// ==========================================

export const listArticlesQuerySchema = z.object({
  query: z.object({
    ...paginationQuery,
    search: z.string().optional(),
    category_id: z.string().uuid().optional(),
    status: publishStatusEnum.optional(),
    featured: z.string().optional(),
    sort_by: z.string().optional(),
    sort_direction: sortDirectionEnum.optional(),
  }),
});

const articleBodyBase = {
  title: z.string().min(1).max(255),
  category_id: uuid,
  slug: z.string().min(1).max(255),
  cover_image_url: optionalImageUrlNullable,
  short_description: z.string().min(1),
  content: z.string().min(1),
  author_name: z.string().max(150).optional().nullable(),
  author_role: z.string().max(150).optional().nullable(),
  reading_time: z.string().max(50).optional().nullable(),
  publish_date: z.string().optional().nullable(),
  publish_status: publishStatusEnum,
  is_featured: z.boolean(),
  seo_title: z.string().max(255).optional().nullable(),
  meta_description: z.string().max(500).optional().nullable(),
};

export const createArticleSchema = z.object({
  body: z.preprocess(aliasCoverImage, z.object(articleBodyBase)),
});

export const updateArticleSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.preprocess(aliasCoverImage, z.object(articleBodyBase)),
});

export const patchArticleStatusSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    publish_status: publishStatusEnum,
  }),
});

export const patchArticleFeaturedSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    is_featured: z.boolean(),
  }),
});

export const coverImageSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.preprocess(
    aliasCoverImage,
    z.object({
      cover_image_url: requiredImageUrl,
    })
  ),
});

export const bulkArticleStatusSchema = z.object({
  body: z.object({
    ids: z.array(uuid).min(1),
    publish_status: publishStatusEnum,
  }),
});

export const bulkArticleDeleteSchema = z.object({
  body: z.object({
    ids: z.array(uuid).min(1),
  }),
});

// ==========================================
// KNOWLEDGE HUB
// ==========================================

export const listSectionsQuerySchema = z.object({
  query: z.object({
    ...paginationQuery,
    search: z.string().optional(),
    status: publishStatusEnum.optional(),
    sort_by: z.string().optional(),
    sort_direction: sortDirectionEnum.optional(),
  }),
});

const contentBlockSchema = z.preprocess(
  aliasBlockImage,
  z.object({
    type: blockTypeEnum,
    sort_order: z.number().int().min(0),
    title: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    image: optionalImageUrlNullable,
    button_text: z.string().optional().nullable(),
    button_url: z.string().optional().nullable(),
    content: z.string().optional().nullable(),
  })
);

const sectionBodyBase = {
  section_title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  short_description: z.string().min(1),
  detailed_content: z.string().optional().nullable(),
  graphic_image_url: optionalImageUrlNullable,
  /** Icon name or uploaded media URL (cms_item_icon / similar). */
  icon: z.string().max(500).optional().nullable(),
  publishing_status: publishStatusEnum,
  cta_button_text: z.string().max(100).optional().nullable(),
  cta_url: z.string().max(500).optional().nullable(),
  sort_order: z.number().int().min(0),
  seo_title: z.string().max(255).optional().nullable(),
  meta_description: z.string().max(500).optional().nullable(),
  content_blocks: z.array(contentBlockSchema).optional(),
};

export const createSectionSchema = z.object({
  body: z.preprocess(aliasGraphicImage, z.object(sectionBodyBase)),
});

export const updateSectionSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.preprocess(aliasGraphicImage, z.object(sectionBodyBase)),
});

export const patchSectionStatusSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    publishing_status: publishStatusEnum,
  }),
});

export const patchSectionSortOrderSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    sort_order: z.number().int().min(0),
  }),
});

export const graphicImageSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.preprocess(
    aliasGraphicImage,
    z.object({
      graphic_image_url: requiredImageUrl,
    })
  ),
});

export const createBlockSchema = z.object({
  params: z.object({ id: uuid }),
  body: contentBlockSchema,
});

export const updateBlockSchema = z.object({
  params: z.object({
    id: uuid,
    blockId: uuid,
  }),
  body: contentBlockSchema,
});

export const reorderBlocksSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    blocks: z
      .array(
        z.object({
          id: uuid,
          sort_order: z.number().int().min(0),
        })
      )
      .min(1),
  }),
});

export const bulkSectionStatusSchema = z.object({
  body: z.object({
    ids: z.array(uuid).min(1),
    publishing_status: publishStatusEnum,
  }),
});

export const bulkSectionDeleteSchema = z.object({
  body: z.object({
    ids: z.array(uuid).min(1),
  }),
});
