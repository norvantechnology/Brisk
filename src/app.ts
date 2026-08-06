import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorMiddleware } from './middlewares/error.middleware';
import { sendResponse } from './utils/apiResponse';
import { setupSwagger } from './config/swagger';
import authRoutes from './modules/auth/auth.routes';
import adminAuthRoutes from './modules/admin/admin-auth/admin-auth.routes';

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

/**
 * @swagger
 * /health:
 *   get:
 *     summary: System Health & Uptime Status
 *     description: Retrieve system health status, current ISO timestamp, and API server uptime in seconds.
 *     tags: [System Health & Status]
 *     responses:
 *       200:
 *         description: API server is healthy and operational.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: BRISK backend API is healthy and running.
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: '2026-08-06T13:40:00.000Z'
 *                     uptime:
 *                       type: number
 *                       example: 124.52
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
