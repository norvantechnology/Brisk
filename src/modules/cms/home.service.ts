import { prisma } from '../../config/database';
import { CmsPublishStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { HOME_PAGE_SLUG } from './home.constants';
import * as pageSectionsService from './page-sections.service';

export const getHomeSectionId = async (sectionKey: string): Promise<string> => {
  const page = await prisma.cmsMarketingPage.findUnique({
    where: { slug: HOME_PAGE_SLUG },
  });
  if (!page) {
    throw new NotFoundError('Home page not found.');
  }

  const section = await prisma.cmsPageSection.findFirst({
    where: { pageId: page.id, sectionKey },
  });
  if (!section) {
    throw new NotFoundError(`Section "${sectionKey}" not found on home page.`);
  }

  return section.id;
};

export const updateHomePage = async (input: { title?: string; status?: CmsPublishStatus }) => {
  const page = await prisma.cmsMarketingPage.findUnique({
    where: { slug: HOME_PAGE_SLUG },
  });
  if (!page) {
    throw new NotFoundError('Home page not found.');
  }

  return prisma.cmsMarketingPage.update({
    where: { id: page.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
};

export const bulkUpdateSectionItemsSort = async (
  sectionKey: string,
  items: { id: string; sortOrder: number }[]
) => {
  if (!items.length) {
    throw new BadRequestError('At least one item is required for sort update.');
  }

  const sectionId = await getHomeSectionId(sectionKey);

  await prisma.$transaction(
    items.map(({ id, sortOrder }) =>
      prisma.cmsPageSectionItem.updateMany({
        where: { id, sectionId },
        data: { sortOrder },
      })
    )
  );

  return pageSectionsService.listAdminSectionItems(sectionId);
};
