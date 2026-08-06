import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { env } from './env';

const servers: { url: string; description: string }[] = [
  {
    url: '/',
    description: 'Current Environment (Dynamic)',
  },
  {
    url: `http://localhost:${env.PORT}`,
    description: 'Local Development Server',
  },
];

if (process.env.RENDER_EXTERNAL_URL) {
  servers.unshift({
    url: process.env.RENDER_EXTERNAL_URL,
    description: 'Render Cloud Production Server',
  });
}

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BRISK Platform API Documentation',
      version: '1.0.0',
      description: 'Modular Monolith Backend API Specification for Admin Portal & Mobile Applications.',
    },
    servers,
    tags: [
      {
        name: '🔐 [Admin Auth] Authentication & Profile',
        description: 'Admin Portal login, JWT token refresh, current admin profile, password updates, and session logout.',
      },
      {
        name: '📂 [Admin Category] Master Categories',
        description: 'Master Category CRUD management, category code/slug checks, display order, theme color, icon name, and stats.',
      },
      {
        name: '🏷️ [Admin Category] Master Sub-Categories',
        description: 'Master Sub-Category CRUD management, parent category association, service types, and job dependency safety checks.',
      },
      {
        name: '👥 [Admin Customer] 1. All Customers Directory',
        description: 'Customer directory table, search, filters (status, country), customer profile creation (10 form fields), profile detail view, update, and deletion.',
      },
      {
        name: '🗑️ [Admin Customer] 2. Account Deletion & GDPR Requests',
        description: 'GDPR account deletion request queue, stats, request detail inspection, approval modal, and automated in-place PII anonymization.',
      },
      {
        name: '💳 [Admin Customer] 3. Payment & Billing Management',
        description: 'Customer transactions table, tax invoice details & PDF data, refunds management queue & action processing, and customer loyalty rewards feed.',
      },
      {
        name: '📱 [App Auth] Customer & Trader Mobile Auth',
        description: 'Mobile user registration, OTP SMS verification, login, and session refresh for Customer and Trader mobile apps.',
      },
      {
        name: '🛠️ [System] Health & Diagnostics',
        description: 'API health check, uptime metrics, and database connection status verification.',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter Admin/User JWT access token.',
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.ts', './src/app.ts', './src/server.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Express): void => {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'BRISK API Documentation',
    })
  );
};
