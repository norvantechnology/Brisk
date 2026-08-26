import { Request, Response, NextFunction } from 'express';
import * as cmsService from './cms.service';
import { sendResponse } from '../../utils/apiResponse';

const q = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const getBootstrap = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.getWebsiteBootstrap(q(req.query.audience));
    sendResponse({
      res,
      statusCode: 200,
      message: 'Website bootstrap retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listPages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.listPublishedPages(q(req.query.audience));
    sendResponse({
      res,
      statusCode: 200,
      message: 'Pages retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getPageBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = await cmsService.getPublishedPageBySlug(req.params.slug, q(req.query.audience));
    sendResponse({
      res,
      statusCode: 200,
      message: 'Page retrieved successfully.',
      data: { page },
    });
  } catch (error) {
    next(error);
  }
};

export const getSocialLinks = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.listActiveSocialLinks();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Social links retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getKnowledgeHub = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.listPublishedKnowledgeHub();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Knowledge hub retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getKnowledgeBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const section = await cmsService.getPublishedKnowledgeBySlug(req.params.slug);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Knowledge Hub section retrieved successfully.',
      data: { section },
    });
  } catch (error) {
    next(error);
  }
};

export const getBlogCategories = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.listActiveBlogCategories();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog categories retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getBlogPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.listPublishedBlogPosts({
      page: q(req.query.page),
      per_page: q(req.query.per_page),
      limit: q(req.query.limit),
      search: q(req.query.search),
      category_id: q(req.query.category_id) ?? q(req.query.categoryId),
      category_slug: q(req.query.category_slug),
      featured: q(req.query.featured),
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog posts retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getBlogPostBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const post = await cmsService.getPublishedBlogPostBySlug(req.params.slug);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Blog post retrieved successfully.',
      data: { post },
    });
  } catch (error) {
    next(error);
  }
};

export const getFeaturedBlogPost = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.getFeaturedBlogPost();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Featured blog post retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getFaqCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.listPublishedFaqCategories(q(req.query.audience));
    sendResponse({
      res,
      statusCode: 200,
      message: 'FAQ categories retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getFaqs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.listPublishedFaqs({
      audience: q(req.query.audience),
      category_id: q(req.query.category_id) ?? q(req.query.categoryId),
      category_slug: q(req.query.category_slug),
      pageType: q(req.query.pageType) ?? q(req.query.page_type),
      type: q(req.query.type),
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'FAQs retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getTestimonials = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.listPublishedTestimonials({
      featured: q(req.query.featured),
      audience: q(req.query.audience),
      type: q(req.query.type),
      status: q(req.query.status),
      limit: q(req.query.limit),
    });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Testimonials retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listLegalPolicies = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.listPublishedLegalPolicies();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Legal policies retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getLegalBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const policy = await cmsService.getPublishedLegalBySlug(req.params.slug);
    sendResponse({
      res,
      statusCode: 200,
      message: 'Legal policy retrieved successfully.',
      data: { policy },
    });
  } catch (error) {
    next(error);
  }
};

export const getLegalHtmlBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const html = await cmsService.getLegalHtmlBySlug(req.params.slug);
    res.status(200).type('html').send(html);
  } catch (error) {
    next(error);
  }
};

export const getHelpCenterHtml = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const html = await cmsService.getHelpCenterHtml();
    res.status(200).type('html').send(html);
  } catch (error) {
    next(error);
  }
};

export const getSeo = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.getPublicSeoSettings();
    sendResponse({
      res,
      statusCode: 200,
      message: 'SEO settings retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getContactSettings = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await cmsService.getPublicContactSettings();
    sendResponse({
      res,
      statusCode: 200,
      message: 'Contact information retrieved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};
