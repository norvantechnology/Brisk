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
      description: 'API specifications for the BRISK modular monolith backend.',
    },
    servers,
    tags: [
      {
        name: 'Admin Authentication',
        description: 'Admin Portal login, session token refresh, admin profile, password management, and logout.',
      },
      {
        name: 'Category & Sub-Category Master',
        description: 'Category Master & Sub-Category Master CRUD management, display ordering, filters, and icon/color settings.',
      },
      {
        name: 'Customer & Trader Auth',
        description: 'Mobile registration, OTP SMS verification, login, and session refresh for Customers and Traders.',
      },
      {
        name: 'System Health & Status',
        description: 'API health checks, server uptime, and status verification endpoints.',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT access token.',
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
