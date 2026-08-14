import { Request, Response, NextFunction } from 'express';
import * as pageSectionsService from './page-sections.service';
import * as cmsService from './cms.service';
import { sendResponse } from '../../utils/apiResponse';
import { HOME_PAGE_SLUG, resolveHomeSectionKey } from './home.constants';

export const getHomePage = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.getPublicMarketingPage(HOME_PAGE_SLUG);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Home page retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getHomeSection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sectionKey = resolveHomeSectionKey(req.params.sectionRoute);
    const data = await pageSectionsService.getPublicPageSection(HOME_PAGE_SLUG, sectionKey);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Home section retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getHomeReviews = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.listPublishedTestimonials({ type: 'home', limit: 50 });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Home reviews retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
