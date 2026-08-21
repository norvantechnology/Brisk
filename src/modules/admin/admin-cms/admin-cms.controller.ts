import { Response, NextFunction } from 'express';
import * as cmsService from './admin-cms.service';
import { sendResponse } from '../../../utils/apiResponse';
import { AuthenticatedAdminRequest } from '../../../middlewares/admin-auth.middleware';

// ==========================================
// CMS DASHBOARD
// ==========================================

export const getCmsDashboardStats = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await cmsService.getCmsDashboardStats();
    sendResponse({
      res,
      statusCode: 200,
      message: 'CMS dashboard stats retrieved successfully.',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const getCmsDashboardAudit = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await cmsService.getCmsDashboardAudit(req.query as { page?: string; limit?: string });
    sendResponse({
      res,
      statusCode: 200,
      message: 'CMS dashboard audit activity retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// WEBSITE PAGES
// ==========================================

export const listPages = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await cmsService.listPages(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Website pages retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getPage = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = await cmsService.getPageById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Website page retrieved successfully.',
      data: { page },
    });
  } catch (error) {
    next(error);
  }
};

export const createPage = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const page = await cmsService.createPage(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Website page created successfully.',
      data: { page },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePage = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const page = await cmsService.updatePage(adminId, adminLabel, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Website page updated successfully.',
      data: { page },
    });
  } catch (error) {
    next(error);
  }
};

export const togglePageActive = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const page = await cmsService.togglePageActive(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Website page active status toggled successfully.',
      data: { page },
    });
  } catch (error) {
    next(error);
  }
};

export const duplicatePage = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const page = await cmsService.duplicatePage(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Website page duplicated successfully.',
      data: { page },
    });
  } catch (error) {
    next(error);
  }
};

export const deletePage = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    await cmsService.deletePage(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Website page deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// SOCIAL LINKS
// ==========================================

export const listSocialLinks = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await cmsService.listSocialLinks(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Social links retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createSocialLink = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const socialLink = await cmsService.createSocialLink(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Social link created successfully.',
      data: { socialLink },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSocialLink = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const socialLink = await cmsService.updateSocialLink(adminId, adminLabel, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Social link updated successfully.',
      data: { socialLink },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSocialLink = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    await cmsService.deleteSocialLink(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Social link deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// FAQ CATEGORIES & FAQS
// ==========================================

export const listFaqCategories = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await cmsService.listFaqCategories(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'FAQ categories retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createFaqCategory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const category = await cmsService.createFaqCategory(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'FAQ category created successfully.',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const listFaqs = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await cmsService.listFaqs(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'FAQs retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getFaq = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const faq = await cmsService.getFaqById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'FAQ retrieved successfully.',
      data: { faq },
    });
  } catch (error) {
    next(error);
  }
};

export const createFaq = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const faq = await cmsService.createFaq(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'FAQ created successfully.',
      data: { faq },
    });
  } catch (error) {
    next(error);
  }
};

export const updateFaq = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const faq = await cmsService.updateFaq(adminId, adminLabel, req.params.id, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'FAQ updated successfully.',
      data: { faq },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFaq = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    await cmsService.deleteFaq(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'FAQ deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export const reorderFaqs = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const result = await cmsService.reorderFaqs(adminId, adminLabel, req.body.items);
    sendResponse({
      res,
      statusCode: 200,
      message: 'FAQs reordered successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// TESTIMONIALS
// ==========================================

export const getTestimonialStats = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await cmsService.getTestimonialStats();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Testimonial stats retrieved successfully.',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const listTestimonials = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await cmsService.listTestimonials(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Testimonials retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createTestimonial = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const testimonial = await cmsService.createTestimonial(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Testimonial created successfully.',
      data: { testimonial },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTestimonial = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const testimonial = await cmsService.updateTestimonial(
      adminId,
      adminLabel,
      req.params.id,
      req.body
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Testimonial updated successfully.',
      data: { testimonial },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTestimonial = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    await cmsService.deleteTestimonial(adminId, adminLabel, req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Testimonial deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export const getTestimonial = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const testimonial = await cmsService.getTestimonialById(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Testimonial retrieved successfully.',
      data: { testimonial },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTestimonialStatus = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const testimonial = await cmsService.updateTestimonialStatus(
      adminId,
      adminLabel,
      req.params.id,
      req.body.status
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Testimonial status updated successfully.',
      data: { testimonial },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTestimonialSortOrder = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const testimonial = await cmsService.updateTestimonialSortOrder(
      adminId,
      adminLabel,
      req.params.id,
      req.body.sortOrder
    );
    sendResponse({
      res,
      statusCode: 200,
      message: 'Testimonial sort order updated successfully.',
      data: { testimonial },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// LEGAL & POLICIES
// ==========================================

export const listLegalPolicies = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await cmsService.listLegalPolicies(req.query);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Legal policies retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getLegalPolicyHistory = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const policy = await cmsService.getLegalPolicyHistory(req.params.id);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Legal policy version history retrieved successfully.',
      data: { policy },
    });
  } catch (error) {
    next(error);
  }
};

export const createLegalPolicy = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const policy = await cmsService.createLegalPolicy(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 201,
      message: 'Legal policy created successfully.',
      data: { policy },
    });
  } catch (error) {
    next(error);
  }
};

export const publishLegalVersion = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const version = await cmsService.publishLegalVersion(
      adminId,
      adminLabel,
      req.params.id,
      req.body
    );
    sendResponse({
      res,
      statusCode: 201,
      message: 'Legal policy version published successfully.',
      data: { version },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// SEO SETTINGS
// ==========================================

export const getSeoSettings = async (
  _req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const seo = await cmsService.getSeoSettings();
    sendResponse({
      res,
      statusCode: 200,
      message: 'SEO settings retrieved successfully.',
      data: { seo },
    });
  } catch (error) {
    next(error);
  }
};

export const upsertSeoSettings = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.adminUser!.id;
    const adminLabel = `${req.adminUser!.fullName} (${req.adminUser!.role})`;
    const seo = await cmsService.upsertSeoSettings(adminId, adminLabel, req.body);
    sendResponse({
      res,
      statusCode: 200,
      message: 'SEO settings updated successfully.',
      data: { seo },
    });
  } catch (error) {
    next(error);
  }
};
