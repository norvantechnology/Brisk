import { prisma } from '../../config/database';
import { CmsPublishStatus, Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import {
  serializeAdminSection,
  serializeAdminSectionItem,
  serializePublicSection,
  serializePublicSectionItem,
} from './page-sections.serializers';

const PUBLISHED = CmsPublishStatus.PUBLISHED;

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
  const sections = await prisma.cmsPageSection.findMany({
    where: { pageId: page.id, status: PUBLISHED },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: publishedItemWhere,
        orderBy: [{ sortOrder: 'asc' }, { stepNumber: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  return {
    page: {
      slug: page.slug,
      title: page.title,
      status: page.status.toLowerCase(),
    },
    sections: sections.map(serializePublicSection),
  };
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
      title: input.title ?? undefined,
      subtitle: input.subtitle ?? undefined,
      description: input.description ?? undefined,
      primaryButtonText: input.primaryButtonText ?? undefined,
      primaryButtonUrl: input.primaryButtonUrl ?? undefined,
      secondaryButtonText: input.secondaryButtonText ?? undefined,
      secondaryButtonUrl: input.secondaryButtonUrl ?? undefined,
      backgroundImage: input.backgroundImage ?? undefined,
      backgroundVideo: input.backgroundVideo ?? undefined,
      appStoreUrl: input.appStoreUrl ?? undefined,
      googlePlayUrl: input.googlePlayUrl ?? undefined,
      status: input.status ?? PUBLISHED,
      sortOrder: input.sortOrder ?? 0,
    },
    update: {
      ...(input.sectionType ? { sectionType: input.sectionType } : {}),
      title: input.title ?? undefined,
      subtitle: input.subtitle ?? undefined,
      description: input.description ?? undefined,
      primaryButtonText: input.primaryButtonText ?? undefined,
      primaryButtonUrl: input.primaryButtonUrl ?? undefined,
      secondaryButtonText: input.secondaryButtonText ?? undefined,
      secondaryButtonUrl: input.secondaryButtonUrl ?? undefined,
      backgroundImage: input.backgroundImage ?? undefined,
      backgroundVideo: input.backgroundVideo ?? undefined,
      appStoreUrl: input.appStoreUrl ?? undefined,
      googlePlayUrl: input.googlePlayUrl ?? undefined,
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
