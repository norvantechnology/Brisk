import { z } from 'zod';
import { CmsPublishStatus } from '@prisma/client';

const publishStatusSchema = z.nativeEnum(CmsPublishStatus).optional();

const sectionBodySchema = z.object({
  sectionType: z.string().min(1).optional(),
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  primaryButtonText: z.string().nullable().optional(),
  primaryButtonUrl: z.string().nullable().optional(),
  secondaryButtonText: z.string().nullable().optional(),
  secondaryButtonUrl: z.string().nullable().optional(),
  backgroundImage: z.string().nullable().optional(),
  foregroundImage: z.string().nullable().optional(),
  backgroundVideo: z.string().nullable().optional(),
  appStoreUrl: z.string().nullable().optional(),
  googlePlayUrl: z.string().nullable().optional(),
  status: publishStatusSchema,
  sortOrder: z.number().int().min(0).optional(),
});

export const pageSlugSectionKeyParamsSchema = z.object({
  params: z.object({
    pageSlug: z.string().min(1),
    sectionKey: z.string().min(1),
  }),
});

export const pageSlugParamSchema = z.object({
  params: z.object({
    pageSlug: z.string().min(1),
  }),
});

export const createMarketingPageSchema = z.object({
  body: z.object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case (e.g. about-brisk).'),
    title: z.string().trim().min(1).max(255),
    status: z.nativeEnum(CmsPublishStatus).optional(),
  }),
});

export const sectionIdParamSchema = z.object({
  params: z.object({
    sectionId: z.string().uuid(),
  }),
});

export const sectionItemIdParamSchema = z.object({
  params: z.object({
    itemId: z.string().uuid(),
  }),
});

export const upsertPageSectionSchema = z.object({
  params: z.object({
    pageSlug: z.string().min(1),
    sectionKey: z.string().min(1),
  }),
  body: sectionBodySchema.extend({
    sectionType: z.string().min(1),
  }),
});

export const updatePageSectionSchema = z.object({
  params: z.object({
    pageSlug: z.string().min(1),
    sectionKey: z.string().min(1),
  }),
  body: sectionBodySchema,
});

export const createSectionItemSchema = z.object({
  params: z.object({
    sectionId: z.string().uuid(),
  }),
  body: z.object({
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    stepNumber: z.number().int().min(1).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    status: publishStatusSchema,
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
});

export const updateSectionItemSchema = z.object({
  params: z.object({
    itemId: z.string().uuid(),
  }),
  body: z.object({
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    stepNumber: z.number().int().min(1).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    status: publishStatusSchema,
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
});

export const sectionItemSortOrderSchema = z.object({
  params: z.object({
    itemId: z.string().uuid(),
  }),
  body: z.object({
    sortOrder: z.number().int().min(0),
  }),
});

export const sectionStatusSchema = z.object({
  params: z.object({
    sectionId: z.string().uuid(),
  }),
  body: z.object({
    status: z.nativeEnum(CmsPublishStatus),
  }),
});

export const sectionSortOrderSchema = z.object({
  params: z.object({
    sectionId: z.string().uuid(),
  }),
  body: z.object({
    sortOrder: z.number().int().min(0),
  }),
});

export const sectionItemStatusSchema = z.object({
  params: z.object({
    itemId: z.string().uuid(),
  }),
  body: z.object({
    status: z.nativeEnum(CmsPublishStatus),
  }),
});

export const updateSectionByIdSchema = z.object({
  params: z.object({
    sectionId: z.string().uuid(),
  }),
  body: sectionBodySchema,
});

export const homeSectionRouteParamSchema = z.object({
  params: z.object({
    sectionRoute: z.string().min(1),
  }),
});

export const bulkItemSortSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          sortOrder: z.number().int().min(0),
        })
      )
      .min(1),
  }),
});

export const homePageUpdateSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    status: publishStatusSchema,
  }),
});

export const homeUpdateSectionSchema = z.object({
  params: z.object({
    sectionRoute: z.string().min(1),
  }),
  body: sectionBodySchema,
});

export const homeCreateItemSchema = z.object({
  params: z.object({
    sectionRoute: z.string().min(1),
  }),
  body: z.object({
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    stepNumber: z.number().int().min(1).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    status: publishStatusSchema,
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
});
