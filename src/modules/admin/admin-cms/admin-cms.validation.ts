import { z } from 'zod';
import {
  CmsAudience,
  CmsPublishStatus,
  CmsActiveStatus,
  SurveyRegistrationStatus,
} from '@prisma/client';

const paginationQuery = {
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
};

export const listFilterSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.string().optional(),
    audience: z.string().optional(),
    categoryId: z.string().optional(),
    featured: z.string().optional(),
    sort: z.string().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ID format.'),
  }),
});

export const createPageSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required.'),
    slug: z.string().min(1, 'Slug is required.'),
    content: z.string().optional(),
    targetAudience: z.nativeEnum(CmsAudience).optional().default(CmsAudience.BOTH),
    status: z.nativeEnum(CmsPublishStatus).optional().default(CmsPublishStatus.DRAFT),
    isActive: z.boolean().optional().default(true),
  }),
});

export const updatePageSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    content: z.string().optional(),
    targetAudience: z.nativeEnum(CmsAudience).optional(),
    status: z.nativeEnum(CmsPublishStatus).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const createSocialLinkSchema = z.object({
  body: z.object({
    platform: z.string().min(1),
    profileUrl: z.string().url('Profile URL must be valid.'),
    sortOrder: z.number().int().optional().default(0),
    status: z.nativeEnum(CmsActiveStatus).optional().default(CmsActiveStatus.ACTIVE),
  }),
});

export const updateSocialLinkSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    platform: z.string().min(1).optional(),
    profileUrl: z.string().url().optional(),
    sortOrder: z.number().int().optional(),
    status: z.nativeEnum(CmsActiveStatus).optional(),
  }),
});

export const createFaqCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
  }),
});

export const createFaqSchema = z.object({
  body: z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
    categoryId: z.string().uuid().optional(),
    targetAudience: z.nativeEnum(CmsAudience).optional().default(CmsAudience.BOTH),
    status: z.nativeEnum(CmsPublishStatus).optional().default(CmsPublishStatus.PUBLISHED),
    displayOrder: z.number().int().optional().default(0),
  }),
});

export const updateFaqSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    question: z.string().min(1).optional(),
    answer: z.string().min(1).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    targetAudience: z.nativeEnum(CmsAudience).optional(),
    status: z.nativeEnum(CmsPublishStatus).optional(),
    displayOrder: z.number().int().optional(),
  }),
});

export const reorderFaqsSchema = z.object({
  body: z.object({
    items: z.array(
      z.object({
        id: z.string().uuid(),
        displayOrder: z.number().int(),
      })
    ),
  }),
});

export const dashboardAuditSchema = z.object({
  query: z.object({
    limit: z.string().optional(),
  }),
});

export const createTestimonialSchema = z.object({
  body: z.object({
    authorName: z.string().min(1),
    authorRole: z.string().optional(),
    companyName: z.string().optional(),
    badgeLabel: z.string().optional(),
    authorAvatarUrl: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
    quoteText: z.string().min(1),
    rating: z.number().int().min(1).max(5).optional().default(5),
    targetAudience: z.nativeEnum(CmsAudience).optional().default(CmsAudience.BOTH),
    status: z.nativeEnum(CmsPublishStatus).optional().default(CmsPublishStatus.PUBLISHED),
    isFeatured: z.boolean().optional().default(false),
    displayOrder: z.number().int().optional().default(0),
  }),
});

export const updateTestimonialSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    authorName: z.string().min(1).optional(),
    authorRole: z.string().optional(),
    companyName: z.string().optional(),
    badgeLabel: z.string().optional(),
    authorAvatarUrl: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
    quoteText: z.string().min(1).optional(),
    rating: z.number().int().min(1).max(5).optional(),
    targetAudience: z.nativeEnum(CmsAudience).optional(),
    status: z.nativeEnum(CmsPublishStatus).optional(),
    isFeatured: z.boolean().optional(),
    displayOrder: z.number().int().optional(),
  }),
});

export const createLegalPolicySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
  }),
});

export const publishLegalVersionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    versionLabel: z.string().min(1),
    content: z.string().min(1),
    effectiveDate: z.string().min(1),
    status: z.nativeEnum(CmsPublishStatus).optional().default(CmsPublishStatus.PUBLISHED),
  }),
});

export const updateSeoSchema = z.object({
  body: z.object({
    globalSiteTitle: z.string().min(1),
    metaDescription: z.string().min(1),
    metaKeywords: z.string().optional(),
    canonicalBaseUrl: z.string().url(),
    ogImageUrl: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
    twitterHandle: z.string().optional(),
    gaMeasurementId: z.string().optional(),
    robotsTxt: z.string().optional(),
  }),
});

export const surveyFilterSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.nativeEnum(SurveyRegistrationStatus).optional(),
    county: z.string().optional(),
    ageRange: z.string().optional(),
    consentLaunchUpdates: z.string().optional(),
    consentMarketing: z.string().optional(),
    consentPartnerComm: z.string().optional(),
    sort: z.enum(['newest', 'oldest']).optional(),
  }),
});

export const updateSurveyConsumerSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.nativeEnum(SurveyRegistrationStatus).optional(),
    notes: z.string().optional(),
  }),
});

export const createSurveyConsumerPublicSchema = z.object({
  body: z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    county: z.string().optional(),
    ageRange: z.string().optional(),
    consentLaunchUpdates: z.boolean().optional().default(false),
    consentMarketing: z.boolean().optional().default(false),
    consentPartnerComm: z.boolean().optional().default(false),
    agreementAccepted: z.literal(true, {
      errorMap: () => ({ message: 'Agreement must be accepted.' }),
    }),
  }),
});
