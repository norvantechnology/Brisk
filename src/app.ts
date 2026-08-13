import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorMiddleware } from './middlewares/error.middleware';
import { sendResponse } from './utils/apiResponse';
import { setupSwagger } from './config/swagger';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import tradersRoutes from './modules/traders/traders.routes';
import adminAuthRoutes from './modules/admin/admin-auth/admin-auth.routes';
import adminCategoryRoutes from './modules/admin/admin-categories/admin-categories.routes';
import adminCustomerRoutes from './modules/admin/admin-customers/admin-customers.routes';
import adminCmsRoutes from './modules/admin/admin-cms/admin-cms.routes';
import adminSurveyRoutes from './modules/admin/admin-surveys/admin-surveys.routes';
import adminBlogCategoryRoutes from './modules/admin/admin-website/admin-website.blog-categories.routes';
import adminBlogArticleRoutes from './modules/admin/admin-website/admin-website.blog-articles.routes';
import adminKnowledgeHubRoutes from './modules/admin/admin-website/admin-website.knowledge-hub.routes';
import surveysRoutes from './modules/surveys/surveys.routes';
import cmsRoutes from './modules/cms/cms.routes';
import marketingPagesPublicRoutes from './modules/cms/marketing-pages-public.routes';
import testimonialsPublicRoutes from './modules/cms/testimonials-public.routes';
import {
  categoriesRouter,
  subcategoriesRouter,
} from './modules/categories/categories.routes';
import contactRoutes from './modules/contact/contact.routes';
import adminContactRoutes from './modules/admin/admin-contact/admin-contact.routes';

const app = express();

// Set security HTTP headers
app.use(helmet());

// Enable CORS
app.use(cors());

// Parse JSON request body
app.use(express.json());

// Parse URL-encoded request body
app.use(express.urlencoded({ extended: true }));

// Mount Swagger Documentation UI
setupSwagger(app);

// Mount API Routes
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/traders', tradersRoutes);
app.use('/admin/auth', adminAuthRoutes);
app.use('/admin', adminCategoryRoutes);
app.use('/admin', adminCustomerRoutes);
app.use('/admin/cms', adminCmsRoutes);
app.use('/admin/cms', adminContactRoutes);
app.use('/admin/blog/categories', adminBlogCategoryRoutes);
app.use('/admin/blog/articles', adminBlogArticleRoutes);
app.use('/admin/knowledge-hub', adminKnowledgeHubRoutes);
app.use('/admin/surveys', adminSurveyRoutes);
app.use('/surveys', surveysRoutes);
app.use('/cms', cmsRoutes);
app.use('/pages', marketingPagesPublicRoutes);
app.use('/testimonials', testimonialsPublicRoutes);
app.use('/categories', categoriesRouter);
app.use('/sub-categories', subcategoriesRouter);
app.use('/contact', contactRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check API server health status, ISO timestamp, and uptime in seconds
 *     tags: ['System / Health']
 *     responses:
 *       200:
 *         description: API server is healthy and operational.
 */
app.get('/health', (_req: Request, res: Response) => {
  sendResponse({
    res,
    statusCode: 200,
    message: 'BRISK backend API is healthy and running.',
    data: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// Centralized error handling middleware
app.use(errorMiddleware);

export default app;
