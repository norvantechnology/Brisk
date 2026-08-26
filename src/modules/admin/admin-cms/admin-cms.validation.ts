import { z } from 'zod';
import {
  CmsAudience,
  CmsPublishStatus,
  CmsActiveStatus,
  CmsTestimonialPageType,
  SurveyRegistrationStatus,
} from '@prisma/client';
import { parseCmsPageType } from '../../cms/cms-page-type';

const paginationQuery = {
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
};

const pageTypeAliases = [
  'customer',
  'trader',
  'home',
  'aboutUs',
  'about_us',
  'about-us',
  'CUSTOMER',
  'TRADER',
  'HOME',
  'ABOUT_US',
] as const;

const pageTypeInput = z
  .string()
  .optional()
  .refine((v) => v === undefined || parseCmsPageType(v) !== undefined, {
    message: 'Invalid pageType. Use CUSTOMER, TRADER, HOME, or aboutUs.',
  })
  .transform((v) => (v === undefined ? undefined : parseCmsPageType(v)));

const typeQueryInput = z
  .enum(pageTypeAliases)
  .optional()
  .transform((v) => (v === undefined ? undefined : parseCmsPageType(v)));

export const listFilterSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.string().optional(),
    audience: z.string().optional(),
    categoryId: z.string().optional(),
    featured: z.string().optional(),
    sort: z.string().optional(),
    type: typeQueryInput,
    pageType: pageTypeInput,
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
    pageType: pageTypeInput,
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
    pageType: pageTypeInput,
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
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const createTestimonialSchema = z.object({
  body: z.object({
    authorName: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    authorRole: z.string().optional(),
    role: z.string().optional(),
    companyName: z.string().optional(),
    badgeLabel: z.string().optional(),
    authorAvatarUrl: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
    avatar: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
    quoteText: z.string().min(1).optional(),
    review: z.string().min(1).optional(),
    rating: z.number().min(1).max(5).optional().default(5),
    pageType: pageTypeInput,
    type: typeQueryInput,
    isVerified: z.boolean().optional().default(false),
    is_verified: z.boolean().optional(),
    targetAudience: z.nativeEnum(CmsAudience).optional().default(CmsAudience.BOTH),
    status: z.nativeEnum(CmsPublishStatus).optional().default(CmsPublishStatus.PUBLISHED),
    isFeatured: z.boolean().optional().default(false),
    displayOrder: z.number().int().optional().default(0),
    sort_order: z.number().int().optional(),
  })
    .superRefine((body, ctx) => {
      if (!body.authorName && !body.name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'authorName or name is required.',
          path: ['authorName'],
        });
      }
      if (!body.quoteText && !body.review) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'quoteText or review is required.',
          path: ['quoteText'],
        });
      }
    })
    .transform((body) => ({
    authorName: body.authorName ?? body.name!,
    authorRole: body.authorRole ?? body.role,
    authorAvatarUrl: body.authorAvatarUrl ?? body.avatar,
    quoteText: body.quoteText ?? body.review!,
    rating: body.rating,
    pageType:
      body.pageType ??
      body.type ??
      (body.targetAudience === CmsAudience.TRADER
        ? CmsTestimonialPageType.TRADER
        : body.targetAudience === CmsAudience.CUSTOMER
          ? CmsTestimonialPageType.CUSTOMER
          : CmsTestimonialPageType.CUSTOMER),
    isVerified: body.isVerified ?? body.is_verified ?? false,
    targetAudience: body.targetAudience,
    status: body.status,
    isFeatured: body.isFeatured,
    displayOrder: body.displayOrder ?? body.sort_order ?? 0,
    companyName: body.companyName,
    badgeLabel: body.badgeLabel,
  })),
});

export const updateTestimonialSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    authorName: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    authorRole: z.string().optional(),
    role: z.string().optional(),
    companyName: z.string().optional(),
    badgeLabel: z.string().optional(),
    authorAvatarUrl: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
    avatar: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
    quoteText: z.string().min(1).optional(),
    review: z.string().min(1).optional(),
    rating: z.number().min(1).max(5).optional(),
    pageType: pageTypeInput,
    type: typeQueryInput,
    isVerified: z.boolean().optional(),
    is_verified: z.boolean().optional(),
    targetAudience: z.nativeEnum(CmsAudience).optional(),
    status: z.nativeEnum(CmsPublishStatus).optional(),
    isFeatured: z.boolean().optional(),
    displayOrder: z.number().int().optional(),
    sort_order: z.number().int().optional(),
  }).transform((body) => ({
    ...(body.authorName !== undefined || body.name !== undefined
      ? { authorName: body.authorName ?? body.name }
      : {}),
    ...(body.authorRole !== undefined || body.role !== undefined
      ? { authorRole: body.authorRole ?? body.role }
      : {}),
    ...(body.authorAvatarUrl !== undefined || body.avatar !== undefined
      ? { authorAvatarUrl: body.authorAvatarUrl ?? body.avatar }
      : {}),
    ...(body.quoteText !== undefined || body.review !== undefined
      ? { quoteText: body.quoteText ?? body.review }
      : {}),
    ...(body.rating !== undefined ? { rating: body.rating } : {}),
    ...(body.pageType !== undefined || body.type !== undefined
      ? {
          pageType: body.pageType ?? body.type,
        }
      : {}),
    ...(body.isVerified !== undefined || body.is_verified !== undefined
      ? { isVerified: body.isVerified ?? body.is_verified }
      : {}),
    ...(body.targetAudience !== undefined ? { targetAudience: body.targetAudience } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
    ...(body.displayOrder !== undefined || body.sort_order !== undefined
      ? { displayOrder: body.displayOrder ?? body.sort_order }
      : {}),
    ...(body.companyName !== undefined ? { companyName: body.companyName } : {}),
    ...(body.badgeLabel !== undefined ? { badgeLabel: body.badgeLabel } : {}),
  })),
});

export const testimonialStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.nativeEnum(CmsPublishStatus),
  }),
});

export const testimonialSortOrderSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    sortOrder: z.number().int().min(0).optional(),
    sort_order: z.number().int().min(0).optional(),
  }).transform((body) => ({
    sortOrder: body.sortOrder ?? body.sort_order ?? 0,
  })),
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
    search: z.string().optional(),
    status: z.nativeEnum(SurveyRegistrationStatus).optional(),
    country: z.string().optional(),
    county: z.string().optional(),
    ageRange: z.string().optional(),
    consentLaunchUpdates: z.string().optional(),
    consentMarketing: z.string().optional(),
    consentPartnerComm: z.string().optional(),
    /** Legacy date sort: newest | oldest (still supported) */
    sort: z.enum(['newest', 'oldest']).optional(),
    /** Admin UI sort: name | status | submittedAt */
    sortBy: z.enum(['name', 'status', 'submittedAt', 'companyName']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    /** Date filters (ISO date or datetime) */
    submittedFrom: z.string().optional(),
    submittedTo: z.string().optional(),
    /**
     * Admin "All Dates" dropdown:
     * all | today | thisWeek | thisMonth
     * (also accepts this_week / this_month / "This Week")
     */
    dateFilter: z.string().optional(),
  }),
});

export const updateSurveyConsumerSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.nativeEnum(SurveyRegistrationStatus).optional(),
    notes: z.string().optional(),
  }),
});

export const updateSurveyTraderSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.nativeEnum(SurveyRegistrationStatus).optional(),
    notes: z.string().optional(),
  }),
});

export const createSurveyConsumerPublicSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(1, 'Full name is required'),
      email: z.string().trim().email('Invalid email format'),
      phone: z.string().trim().min(1, 'Contact number is required'),
      /** Admin UI / website location field — use county (e.g. Dublin), not country. */
      county: z.string().trim().min(1, 'County is required').optional(),
      /** Deprecated alias — accepted for older clients; prefer county. */
      country: z.string().trim().min(1).optional(),
      ageRange: z.string().trim().optional(),
      consentLaunchUpdates: z.boolean().optional().default(false),
      consentMarketing: z.boolean().optional().default(false),
      consentPartnerComm: z.boolean().optional().default(false),
      agreementAccepted: z.literal(true, {
        errorMap: () => ({ message: 'You must accept the Privacy Policy and Terms.' }),
      }),
    })
    .superRefine((body, ctx) => {
      if (!body.county && !body.country) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'County is required',
          path: ['county'],
        });
      }
    })
    .transform((body) => ({
      ...body,
      county: (body.county || body.country || '').trim(),
      country: body.country?.trim(),
    })),
});

export const createSurveyTraderPublicSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(1, 'Full name is required'),
    companyName: z.string().trim().min(1, 'Company name is required'),
    email: z.string().trim().email('Invalid email format'),
    phone: z.string().trim().min(1, 'Contact number is required'),
    country: z.string().trim().min(1, 'Country is required'),
    companyWebsite: z.string().trim().optional(),
    consentLaunchUpdates: z.boolean().optional().default(false),
    consentMarketing: z.boolean().optional().default(false),
    consentPartnerComm: z.boolean().optional().default(false),
    agreementAccepted: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Privacy Policy and Terms.' }),
    }),
  }),
});
