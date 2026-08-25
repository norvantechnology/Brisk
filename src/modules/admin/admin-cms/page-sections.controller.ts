import { Response, NextFunction } from 'express';
import * as pageSectionsService from '../../cms/page-sections.service';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';

export const getAdminPageSection = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.getAdminPageSection(
      req.params.pageSlug,
      req.params.sectionKey
    );
    sendResponse({ res, statusCode: 200, message: 'Page section retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const upsertAdminPageSection = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.upsertAdminPageSection(
      req.params.pageSlug,
      req.params.sectionKey,
      req.body
    );
    sendResponse({ res, statusCode: 200, message: 'Page section saved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const listAdminSectionItems = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.listAdminSectionItems(req.params.sectionId);
    sendResponse({ res, statusCode: 200, message: 'Section items retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const createAdminSectionItem = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.createAdminSectionItem(req.params.sectionId, req.body);
    sendResponse({ res, statusCode: 201, message: 'Section item created successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const updateAdminSectionItem = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.updateAdminSectionItem(req.params.itemId, req.body);
    sendResponse({ res, statusCode: 200, message: 'Section item updated successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminSectionItem = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await pageSectionsService.deleteAdminSectionItem(req.params.itemId);
    sendResponse({ res, statusCode: 200, message: 'Section item deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

export const updateAdminSectionItemSortOrder = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.updateAdminSectionItemSortOrder(
      req.params.itemId,
      req.body.sortOrder
    );
    sendResponse({ res, statusCode: 200, message: 'Section item sort order updated.', data });
  } catch (error) {
    next(error);
  }
};

export const listAdminMarketingPages = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.listAdminMarketingPages();
    sendResponse({ res, statusCode: 200, message: 'Marketing pages retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const createAdminMarketingPage = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.createAdminMarketingPage(req.body);
    sendResponse({ res, statusCode: 201, message: 'Marketing page created successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const listAdminPageSections = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.listAdminPageSections(req.params.pageSlug);
    sendResponse({ res, statusCode: 200, message: 'Page sections retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const getAdminSectionById = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.getAdminSectionById(req.params.sectionId);
    sendResponse({ res, statusCode: 200, message: 'Section retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const updateAdminSectionById = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.updateAdminSectionById(req.params.sectionId, req.body);
    sendResponse({ res, statusCode: 200, message: 'Section updated successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminSectionById = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await pageSectionsService.deleteAdminSectionById(req.params.sectionId);
    sendResponse({ res, statusCode: 200, message: 'Section deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

export const updateAdminSectionStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.updateAdminSectionStatus(
      req.params.sectionId,
      req.body.status
    );
    sendResponse({ res, statusCode: 200, message: 'Section status updated.', data });
  } catch (error) {
    next(error);
  }
};

export const updateAdminSectionSortOrder = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.updateAdminSectionSortOrder(
      req.params.sectionId,
      req.body.sortOrder
    );
    sendResponse({ res, statusCode: 200, message: 'Section sort order updated.', data });
  } catch (error) {
    next(error);
  }
};

export const getAdminSectionItemById = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.getAdminSectionItemById(req.params.itemId);
    sendResponse({ res, statusCode: 200, message: 'Section item retrieved successfully.', data });
  } catch (error) {
    next(error);
  }
};

export const updateAdminSectionItemStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await pageSectionsService.updateAdminSectionItemStatus(
      req.params.itemId,
      req.body.status
    );
    sendResponse({ res, statusCode: 200, message: 'Section item status updated.', data });
  } catch (error) {
    next(error);
  }
};
