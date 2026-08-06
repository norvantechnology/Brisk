import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorMiddleware } from './middlewares/error.middleware';
import { sendResponse } from './utils/apiResponse';
import { setupSwagger } from './config/swagger';
import authRoutes from './modules/auth/auth.routes';
import adminAuthRoutes from './modules/admin/admin-auth/admin-auth.routes';
import adminCategoryRoutes from './modules/admin/admin-categories/admin-categories.routes';
import adminCustomerRoutes from './modules/admin/admin-customers/admin-customers.routes';

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
app.use('/admin/auth', adminAuthRoutes);
app.use('/admin', adminCategoryRoutes);
app.use('/admin', adminCustomerRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check API server health status, ISO timestamp, and uptime in seconds
 *     tags: ['[System] Health & Diagnostics']
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
