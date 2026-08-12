import { Request, Response, NextFunction } from 'express';
import * as pageSectionsService from './page-sections.service';
import { sendResponse } from '../../utils/apiResponse';

export const getMarketingPage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.getPublicMarketingPage(req.params.pageSlug);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Marketing page retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getPageSection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.getPublicPageSection(
      req.params.pageSlug,
      req.params.sectionKey
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Page section retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getSectionItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.getPublicSectionItems(req.params.sectionId);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Section items retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
