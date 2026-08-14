import { Response, NextFunction } from 'express';
import { CmsPublishStatus, CmsTestimonialPageType } from '@prisma/client';
import * as pageSectionsService from '../../cms/page-sections.service';
import * as homeService from '../../cms/home.service';
import * as cmsService from './admin-cms.service';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import { HOME_PAGE_SLUG, resolveHomeSectionKey } from '../../cms/home.constants';
import { BadRequestError } from '../../../utils/errors';

const adminId = (req: AuthenticatedAdminRequest) => req.adminUser!.id;
const adminLabel = (req: AuthenticatedAdminRequest) =>
  `${req.adminUser!.fullName} (${req.adminUser!.role})`;

export const getAdminHomePage = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.listAdminPageSections(HOME_PAGE_SLUG);
    sendResponse({ res, statusCode: 200, message: 'Home sections retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const updateAdminHomePage = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await homeService.updateHomePage(req.body);
    sendResponse({ res, statusCode: 200, message: 'Home page updated successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const getAdminHomeSection = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sectionKey = resolveHomeSectionKey(req.params.sectionRoute);
    const data = await pageSectionsService.getAdminPageSection(HOME_PAGE_SLUG, sectionKey);
    sendResponse({ res, statusCode: 200, message: 'Home section retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const upsertAdminHomeSection = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sectionKey = resolveHomeSectionKey(req.params.sectionRoute);
    const data = await pageSectionsService.upsertAdminPageSection(
      HOME_PAGE_SLUG,
      sectionKey,
      req.body
    );
    sendResponse({ res, statusCode: 200, message: 'Home section saved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const createAdminHomeSectionItem = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sectionKey = resolveHomeSectionKey(req.params.sectionRoute);
    const sectionId = await homeService.getHomeSectionId(sectionKey);
    const data = await pageSectionsService.createAdminSectionItem(sectionId, req.body);
    sendResponse({ res, statusCode: 201, message: 'Home item created successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const updateAdminHomeSectionItem = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.updateAdminSectionItem(req.params.itemId, req.body);
    sendResponse({ res, statusCode: 200, message: 'Home item updated successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminHomeSectionItem = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await pageSectionsService.deleteAdminSectionItem(req.params.itemId);
    sendResponse({ res, statusCode: 200, message: 'Home item deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

export const updateAdminHomeSectionItemStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.updateAdminSectionItemStatus(
      req.params.itemId,
      req.body.status
    );
    sendResponse({ res, statusCode: 200, message: 'Home item status updated.', data });
  } catch (error) {
    next(error);
  }
};

export const sortAdminHomeSectionItems = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sectionKey = resolveHomeSectionKey(req.params.sectionRoute);
    const data = await homeService.bulkUpdateSectionItemsSort(sectionKey, req.body.items);
    sendResponse({ res, statusCode: 200, message: 'Home items sort order updated.', data });
  } catch (error) {
    next(error);
  }
};

const mapReviewBody = (body: Record<string, unknown>) => ({
  authorName: (body.authorName ?? body.name) as string,
  authorRole: (body.authorRole ?? body.role) as string | undefined,
  badgeLabel: (body.badgeLabel ?? body.designation) as string | undefined,
  authorAvatarUrl: (body.authorAvatarUrl ?? body.profile_image ?? body.profileImage) as
    | string
    | undefined,
  quoteText: (body.quoteText ?? body.review) as string,
  rating: body.rating !== undefined ? Number(body.rating) : undefined,
  displayOrder: (body.displayOrder ?? body.sort_order ?? body.sortOrder) as number | undefined,
  status: body.status as CmsPublishStatus | undefined,
  pageType: CmsTestimonialPageType.HOME,
  isVerified: body.isVerified as boolean | undefined,
});

export const listAdminHomeReviews = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.listTestimonials({ ...req.query, type: 'home' });
    sendResponse({ res, statusCode: 200, message: 'Home reviews retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const createAdminHomeReview = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = mapReviewBody(req.body);
    if (!input.authorName || !input.quoteText) {
      throw new BadRequestError('name and review are required.');
    }
    const testimonial = await cmsService.createTestimonial(adminId(req), adminLabel(req), input);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Home review created successfully.',
      data: { testimonial },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminHomeReview = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const testimonial = await cmsService.getTestimonialById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Home review retrieved successfully.',
      data: { testimonial },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminHomeReview = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const testimonial = await cmsService.updateTestimonial(
      adminId(req),
      adminLabel(req),
      req.params.id,
      mapReviewBody(req.body)
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Home review updated successfully.',
      data: { testimonial },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminHomeReview = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await cmsService.deleteTestimonial(adminId(req), adminLabel(req), req.params.id);
    sendResponse({ res, statusCode: 200, message: 'Home review deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

export const updateAdminHomeReviewStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const testimonial = await cmsService.updateTestimonialStatus(
      adminId(req),
      adminLabel(req),
      req.params.id,
      req.body.status
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Home review status updated.',
      data: { testimonial },
    });
  } catch (error) {
    next(error);
  }
};

export const sortAdminHomeReviews = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const items = req.body.items as { id: string; sortOrder: number }[];
    for (const item of items) {
      await cmsService.updateTestimonialSortOrder(
        adminId(req),
        adminLabel(req),
        item.id,
        item.sortOrder
      );
    }
    const data = await cmsService.listTestimonials({ type: 'home', limit: 100 });
    sendResponse({ res, statusCode: 200, message: 'Home reviews sort order updated.', data });
  } catch (error) {
    next(error);
  }
};
