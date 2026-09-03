import { prisma } from '../../config/database';
import { CmsPublishStatus, Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import {
  serializeAdminSection,
  serializeAdminSectionItem,
  serializePublicSection,
  serializePublicSectionItem,
} from './page-sections.serializers';
import { serializePublicSeo } from './cms.serializers';

const PUBLISHED = CmsPublishStatus.PUBLISHED;

/**
 * Prisma skips `undefined` on update. Use this so explicit `null` clears a field,
 * while omitted keys leave the existing DB value unchanged.
 */
const optionalNullable = <T>(value: T | null | undefined): T | null | undefined =>
  value === undefined ? undefined : value;

const publishedItemWhere = { status: PUBLISHED };

const getPageBySlug = async (pageSlug: string) => {
  const page = await prisma.cmsMarketingPage.findUnique({ where: { slug: pageSlug } });
  if (!page) {
    throw new NotFoundError(`Page "${pageSlug}" not found.`);
  }
  return page;
};

const getSectionByPageAndKey = async (pageSlug: string, sectionKey: string, admin = false) => {
  const page = await getPageBySlug(pageSlug);
  const section = await prisma.cmsPageSection.findFirst({
    where: {
      pageId: page.id,
      sectionKey,
      ...(admin ? {} : { status: PUBLISHED }),
    },
    include: {
      items: {
        where: admin ? undefined : publishedItemWhere,
        orderBy: [{ sortOrder: 'asc' }, { stepNumber: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!section) {
    throw new NotFoundError(`Section "${sectionKey}" not found on page "${pageSlug}".`);
  }

  return section;
};

export const getPublicMarketingPage = async (pageSlug: string) => {
  const page = await getPageBySlug(pageSlug);
  const [sections, seoRow] = await Promise.all([
    prisma.cmsPageSection.findMany({
      where: { pageId: page.id, status: PUBLISHED },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: publishedItemWhere,
          orderBy: [{ sortOrder: 'asc' }, { stepNumber: 'asc' }, { createdAt: 'asc' }],
        },
      },
    }),
    prisma.cmsSeoSettings.findFirst({ orderBy: { updatedAt: 'desc' } }),
  ]);

  const seo = seoRow ? serializePublicSeo(seoRow) : null;

  return {
    page: {
      id: page.id,
      slug: page.slug,
      title: page.title,
      status: page.status.toLowerCase(),
    },
    seo: seo
      ? {
          meta_title: seo.global_site_title,
          meta_description: seo.meta_description,
          og_image: seo.og_image_url,
        }
      : null,
    sections: sections.map(serializePublicSection),
  };
};

export const listAdminMarketingPages = async () => {
  const pages = await prisma.cmsMarketingPage.findMany({
    orderBy: { slug: 'asc' },
    include: {
      _count: { select: { sections: true } },
    },
  });

  return pages.map((page) => ({
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    sectionsCount: page._count.sections,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  }));
};

export const createAdminMarketingPage = async (input: {
  slug: string;
  title: string;
  status?: CmsPublishStatus;
}) => {
  const slug = input.slug.trim().toLowerCase();
  const existing = await prisma.cmsMarketingPage.findUnique({ where: { slug } });
  if (existing) {
    throw new BadRequestError(`Page slug "${slug}" already exists.`);
  }

  const page = await prisma.cmsMarketingPage.create({
    data: {
      slug,
      title: input.title.trim(),
      status: input.status ?? PUBLISHED,
    },
  });

  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    sectionsCount: 0,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
};

export const listAdminPageSections = async (pageSlug: string) => {
  const page = await getPageBySlug(pageSlug);
  const sections = await prisma.cmsPageSection.findMany({
    where: { pageId: page.id },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: { orderBy: [{ sortOrder: 'asc' }, { stepNumber: 'asc' }] },
    },
  });

  return sections.map(serializeAdminSection);
};

export const getAdminSectionById = async (sectionId: string) => {
  const section = await prisma.cmsPageSection.findUnique({
    where: { id: sectionId },
    include: {
      items: { orderBy: [{ sortOrder: 'asc' }, { stepNumber: 'asc' }] },
    },
  });

  if (!section) {
    throw new NotFoundError('Section not found.');
  }

  return serializeAdminSection(section);
};

export const updateAdminSectionById = async (sectionId: string, input: UpsertSectionInput) => {
  const existing = await prisma.cmsPageSection.findUnique({ where: { id: sectionId } });
  if (!existing) {
    throw new NotFoundError('Section not found.');
  }

  const section = await prisma.cmsPageSection.update({
    where: { id: sectionId },
    data: {
      ...(input.sectionType ? { sectionType: input.sectionType } : {}),
      title: optionalNullable(input.title),
      subtitle: optionalNullable(input.subtitle),
      description: optionalNullable(input.description),
      primaryButtonText: optionalNullable(input.primaryButtonText),
      primaryButtonUrl: optionalNullable(input.primaryButtonUrl),
      secondaryButtonText: optionalNullable(input.secondaryButtonText),
      secondaryButtonUrl: optionalNullable(input.secondaryButtonUrl),
      backgroundImage: optionalNullable(input.backgroundImage),
      foregroundImage: optionalNullable(input.foregroundImage),
      backgroundVideo: optionalNullable(input.backgroundVideo),
      appStoreUrl: optionalNullable(input.appStoreUrl),
      googlePlayUrl: optionalNullable(input.googlePlayUrl),
      status: input.status ?? undefined,
      sortOrder: input.sortOrder ?? undefined,
    },
    include: {
      items: { orderBy: [{ sortOrder: 'asc' }, { stepNumber: 'asc' }] },
    },
  });

  return serializeAdminSection(section);
};

export const deleteAdminSectionById = async (sectionId: string) => {
  const existing = await prisma.cmsPageSection.findUnique({ where: { id: sectionId } });
  if (!existing) {
    throw new NotFoundError('Section not found.');
  }

  await prisma.cmsPageSection.delete({ where: { id: sectionId } });
};

export const updateAdminSectionStatus = async (sectionId: string, status: CmsPublishStatus) => {
  const existing = await prisma.cmsPageSection.findUnique({ where: { id: sectionId } });
  if (!existing) {
    throw new NotFoundError('Section not found.');
  }

  const section = await prisma.cmsPageSection.update({
    where: { id: sectionId },
    data: { status },
    include: { items: true },
  });

  return serializeAdminSection(section);
};

export const updateAdminSectionSortOrder = async (sectionId: string, sortOrder: number) => {
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new BadRequestError('sortOrder must be a non-negative integer.');
  }

  const existing = await prisma.cmsPageSection.findUnique({ where: { id: sectionId } });
  if (!existing) {
    throw new NotFoundError('Section not found.');
  }

  const section = await prisma.cmsPageSection.update({
    where: { id: sectionId },
    data: { sortOrder },
    include: { items: true },
  });

  return serializeAdminSection(section);
};

export const getAdminSectionItemById = async (itemId: string) => {
  const item = await prisma.cmsPageSectionItem.findUnique({ where: { id: itemId } });
  if (!item) {
    throw new NotFoundError('Section item not found.');
  }

  return serializeAdminSectionItem(item);
};

export const updateAdminSectionItemStatus = async (itemId: string, status: CmsPublishStatus) => {
  const existing = await prisma.cmsPageSectionItem.findUnique({ where: { id: itemId } });
  if (!existing) {
    throw new NotFoundError('Section item not found.');
  }

  const item = await prisma.cmsPageSectionItem.update({
    where: { id: itemId },
    data: { status },
  });

  return serializeAdminSectionItem(item);
};

export const getPublicPageSection = async (pageSlug: string, sectionKey: string) =>
  serializePublicSection(await getSectionByPageAndKey(pageSlug, sectionKey));

export const getPublicSectionItems = async (sectionId: string) => {
  const section = await prisma.cmsPageSection.findUnique({ where: { id: sectionId } });
  if (!section || section.status !== PUBLISHED) {
    throw new NotFoundError('Section not found.');
  }

  const items = await prisma.cmsPageSectionItem.findMany({
    where: { sectionId, status: PUBLISHED },
    orderBy: [{ sortOrder: 'asc' }, { stepNumber: 'asc' }, { createdAt: 'asc' }],
  });

  return items.map(serializePublicSectionItem);
};

export type UpsertSectionInput = {
  sectionType?: string;
  sectionKey?: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  primaryButtonText?: string | null;
  primaryButtonUrl?: string | null;
  secondaryButtonText?: string | null;
  secondaryButtonUrl?: string | null;
  backgroundImage?: string | null;
  foregroundImage?: string | null;
  backgroundVideo?: string | null;
  appStoreUrl?: string | null;
  googlePlayUrl?: string | null;
  status?: CmsPublishStatus;
  sortOrder?: number;
};

export const upsertAdminPageSection = async (
  pageSlug: string,
  sectionKey: string,
  input: UpsertSectionInput
) => {
  const page = await getPageBySlug(pageSlug);
  const existing = await prisma.cmsPageSection.findFirst({
    where: { pageId: page.id, sectionKey },
  });

  if (!existing && !input.sectionType) {
    throw new BadRequestError('sectionType is required when creating a new section.');
  }

  const section = await prisma.cmsPageSection.upsert({
    where: {
      pageId_sectionKey: { pageId: page.id, sectionKey },
    },
    create: {
      pageId: page.id,
      sectionKey,
      sectionType: input.sectionType ?? 'content',
      title: optionalNullable(input.title),
      subtitle: optionalNullable(input.subtitle),
      description: optionalNullable(input.description),
      primaryButtonText: optionalNullable(input.primaryButtonText),
      primaryButtonUrl: optionalNullable(input.primaryButtonUrl),
      secondaryButtonText: optionalNullable(input.secondaryButtonText),
      secondaryButtonUrl: optionalNullable(input.secondaryButtonUrl),
      backgroundImage: optionalNullable(input.backgroundImage),
      foregroundImage: optionalNullable(input.foregroundImage),
      backgroundVideo: optionalNullable(input.backgroundVideo),
      appStoreUrl: optionalNullable(input.appStoreUrl),
      googlePlayUrl: optionalNullable(input.googlePlayUrl),
      status: input.status ?? PUBLISHED,
      sortOrder: input.sortOrder ?? 0,
    },
    update: {
      ...(input.sectionType ? { sectionType: input.sectionType } : {}),
      title: optionalNullable(input.title),
      subtitle: optionalNullable(input.subtitle),
      description: optionalNullable(input.description),
      primaryButtonText: optionalNullable(input.primaryButtonText),
      primaryButtonUrl: optionalNullable(input.primaryButtonUrl),
      secondaryButtonText: optionalNullable(input.secondaryButtonText),
      secondaryButtonUrl: optionalNullable(input.secondaryButtonUrl),
      backgroundImage: optionalNullable(input.backgroundImage),
      foregroundImage: optionalNullable(input.foregroundImage),
      backgroundVideo: optionalNullable(input.backgroundVideo),
      appStoreUrl: optionalNullable(input.appStoreUrl),
      googlePlayUrl: optionalNullable(input.googlePlayUrl),
      status: input.status ?? undefined,
      sortOrder: input.sortOrder ?? undefined,
    },
    include: {
      items: { orderBy: [{ sortOrder: 'asc' }, { stepNumber: 'asc' }] },
    },
  });

  return serializeAdminSection(section);
};

export const getAdminPageSection = async (pageSlug: string, sectionKey: string) =>
  serializeAdminSection(await getSectionByPageAndKey(pageSlug, sectionKey, true));

export type SectionItemInput = {
  title?: string | null;
  description?: string | null;
  icon?: string | null;
  image?: string | null;
  stepNumber?: number | null;
  sortOrder?: number;
  status?: CmsPublishStatus;
  metadata?: Prisma.InputJsonValue | null;
};

export const listAdminSectionItems = async (sectionId: string) => {
  const section = await prisma.cmsPageSection.findUnique({ where: { id: sectionId } });
  if (!section) {
    throw new NotFoundError('Section not found.');
  }

  const items = await prisma.cmsPageSectionItem.findMany({
    where: { sectionId },
    orderBy: [{ sortOrder: 'asc' }, { stepNumber: 'asc' }, { createdAt: 'asc' }],
  });

  return items.map(serializeAdminSectionItem);
};

export const createAdminSectionItem = async (sectionId: string, input: SectionItemInput) => {
  const section = await prisma.cmsPageSection.findUnique({ where: { id: sectionId } });
  if (!section) {
    throw new NotFoundError('Section not found.');
  }

  const item = await prisma.cmsPageSectionItem.create({
    data: {
      sectionId,
      title: input.title ?? undefined,
      description: input.description ?? undefined,
      icon: input.icon ?? undefined,
      image: input.image ?? undefined,
      stepNumber: input.stepNumber ?? undefined,
      sortOrder: input.sortOrder ?? 0,
      status: input.status ?? PUBLISHED,
      metadata: input.metadata ?? undefined,
    },
  });

  return serializeAdminSectionItem(item);
};

export const updateAdminSectionItem = async (itemId: string, input: SectionItemInput) => {
  const existing = await prisma.cmsPageSectionItem.findUnique({ where: { id: itemId } });
  if (!existing) {
    throw new NotFoundError('Section item not found.');
  }

  const item = await prisma.cmsPageSectionItem.update({
    where: { id: itemId },
    data: {
      title: input.title ?? undefined,
      description: input.description ?? undefined,
      icon: input.icon ?? undefined,
      image: input.image ?? undefined,
      stepNumber: input.stepNumber ?? undefined,
      sortOrder: input.sortOrder ?? undefined,
      status: input.status ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  });

  return serializeAdminSectionItem(item);
};

export const deleteAdminSectionItem = async (itemId: string) => {
  const existing = await prisma.cmsPageSectionItem.findUnique({ where: { id: itemId } });
  if (!existing) {
    throw new NotFoundError('Section item not found.');
  }

  await prisma.cmsPageSectionItem.delete({ where: { id: itemId } });
};

export const updateAdminSectionItemSortOrder = async (itemId: string, sortOrder: number) => {
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new BadRequestError('sortOrder must be a non-negative integer.');
  }

  const existing = await prisma.cmsPageSectionItem.findUnique({ where: { id: itemId } });
  if (!existing) {
    throw new NotFoundError('Section item not found.');
  }

  const item = await prisma.cmsPageSectionItem.update({
    where: { id: itemId },
    data: { sortOrder },
  });

  return serializeAdminSectionItem(item);
};
