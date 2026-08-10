import { Response, NextFunction } from 'express';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';
import * as websiteService from './admin-website.service';

const adminContext = (req: AuthenticatedAdminRequest) => {
  const adminId = req.adminUser!.id;
  const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
  return { adminId, adminLabel };
};

// ==========================================
// BLOG CATEGORIES
// ==========================================

export const listCategories = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await websiteService.listCategories(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog categories fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const category = await websiteService.getCategoryById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog category fetched successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const category = await websiteService.createCategory(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Blog category created successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const category = await websiteService.updateCategory(
      adminId,
      adminLabel,
      req.params.id,
      req.body
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog category updated successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    await websiteService.deleteCategory(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog category deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export const patchCategoryStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const category = await websiteService.updateCategoryStatus(
      adminId,
      adminLabel,
      req.params.id,
      req.body.status
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog category status updated successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const patchCategorySortOrder = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const category = await websiteService.updateCategorySortOrder(
      adminId,
      adminLabel,
      req.params.id,
      req.body.sort_order
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog category sort order updated successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkCategoryStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const result = await websiteService.bulkUpdateCategoryStatus(
      adminId,
      adminLabel,
      req.body.ids,
      req.body.status
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog categories status updated successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkCategoryDelete = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const result = await websiteService.bulkDeleteCategories(
      adminId,
      adminLabel,
      req.body.ids
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog categories deleted successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// BLOG ARTICLES
// ==========================================

export const listArticles = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await websiteService.listArticles(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog articles fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getArticle = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const article = await websiteService.getArticleById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog article fetched successfully.',
      data: article,
    });
  } catch (error) {
    next(error);
  }
};

export const createArticle = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const article = await websiteService.createArticle(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Blog article created successfully.',
      data: article,
    });
  } catch (error) {
    next(error);
  }
};

export const updateArticle = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const article = await websiteService.updateArticle(
      adminId,
      adminLabel,
      req.params.id,
      req.body
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog article updated successfully.',
      data: article,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteArticle = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    await websiteService.softDeleteArticle(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog article deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export const patchArticleStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const article = await websiteService.updateArticleStatus(
      adminId,
      adminLabel,
      req.params.id,
      req.body.publish_status
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog article status updated successfully.',
      data: article,
    });
  } catch (error) {
    next(error);
  }
};

export const patchArticleFeatured = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const article = await websiteService.updateArticleFeatured(
      adminId,
      adminLabel,
      req.params.id,
      req.body.is_featured
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog article featured spotlight updated successfully.',
      data: article,
    });
  } catch (error) {
    next(error);
  }
};

export const setCoverImage = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const article = await websiteService.setArticleCoverImage(
      adminId,
      adminLabel,
      req.params.id,
      req.body.cover_image_url
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog article cover image updated successfully.',
      data: {
        id: article.id,
        cover_image: article.cover_image,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const removeCoverImage = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const article = await websiteService.removeArticleCoverImage(
      adminId,
      adminLabel,
      req.params.id
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog article cover image removed successfully.',
      data: {
        id: article.id,
        cover_image: article.cover_image,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const bulkArticleStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const result = await websiteService.bulkUpdateArticleStatus(
      adminId,
      adminLabel,
      req.body.ids,
      req.body.publish_status
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog articles status updated successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkArticleDelete = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const result = await websiteService.bulkSoftDeleteArticles(
      adminId,
      adminLabel,
      req.body.ids
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog articles deleted successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// KNOWLEDGE HUB
// ==========================================

export const listSections = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await websiteService.listSections(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Knowledge Hub sections fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getSection = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const section = await websiteService.getSectionById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Knowledge Hub section fetched successfully.',
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

export const createSection = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const section = await websiteService.createSection(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Knowledge Hub section created successfully.',
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSection = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const section = await websiteService.updateSection(
      adminId,
      adminLabel,
      req.params.id,
      req.body
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Knowledge Hub section updated successfully.',
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSection = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    await websiteService.softDeleteSection(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Knowledge Hub section deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export const patchSectionStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const section = await websiteService.updateSectionStatus(
      adminId,
      adminLabel,
      req.params.id,
      req.body.publishing_status
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Knowledge Hub section status updated successfully.',
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

export const patchSectionSortOrder = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const section = await websiteService.updateSectionSortOrder(
      adminId,
      adminLabel,
      req.params.id,
      req.body.sort_order
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Knowledge Hub section sort order updated successfully.',
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

export const setGraphic = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const data = await websiteService.setSectionGraphic(
      adminId,
      adminLabel,
      req.params.id,
      req.body.graphic_image_url
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Knowledge Hub graphic uploaded successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const removeGraphic = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const data = await websiteService.removeSectionGraphic(
      adminId,
      adminLabel,
      req.params.id
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Knowledge Hub graphic removed successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listBlocks = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await websiteService.listBlocks(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Content blocks fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const createBlock = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const block = await websiteService.createBlock(
      adminId,
      adminLabel,
      req.params.id,
      req.body
    );
    sendResponse({
      res,
      statusCode: 201,
      message: 'Content block added successfully.',
      data: block,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBlock = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const block = await websiteService.updateBlock(
      adminId,
      adminLabel,
      req.params.id,
      req.params.blockId,
      req.body
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Content block updated successfully.',
      data: block,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBlock = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    await websiteService.deleteBlock(
      adminId,
      adminLabel,
      req.params.id,
      req.params.blockId
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Content block deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export const reorderBlocks = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const data = await websiteService.reorderBlocks(
      adminId,
      adminLabel,
      req.params.id,
      req.body.blocks
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Content blocks reordered successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkSectionStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const result = await websiteService.bulkUpdateSectionStatus(
      adminId,
      adminLabel,
      req.body.ids,
      req.body.publishing_status
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Knowledge Hub sections status updated successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkSectionDelete = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { adminId, adminLabel } = adminContext(req);
    const result = await websiteService.bulkSoftDeleteSections(
      adminId,
      adminLabel,
      req.body.ids
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Knowledge Hub sections deleted successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
