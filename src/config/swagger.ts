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
      description: `
### 🚀 BRISK Platform Backend Architecture & API Guide

Welcome to the **BRISK Platform API** documentation. This interactive API portal allows developers to explore, test, and integrate with BRISK backend services.

---

### 🔑 Authentication Guide
Most secured endpoints require a **Bearer JWT Token** in the \`Authorization\` header:
\`\`\`http
Authorization: Bearer <your_access_token>
\`\`\`
1. Use **\`POST /admin/auth/login\`** or **\`POST /auth/login\`** to authenticate.
2. Click the **Authorize** button at the top right of this page and enter your \`<access_token>\`.

---

### 🧪 Default Test Credentials
- **Super Admin Account**:
  - **Email**: \`admin@brisk.com\`
  - **Password**: \`Password1!\`

---

### 📐 Standard API Response Format
All API endpoints follow a consistent JSON response wrapper:

**Success Response (HTTP 200/201):**
\`\`\`json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... }
}
\`\`\`

**Error Response (HTTP 400/401/403/404/500):**
\`\`\`json
{
  "success": false,
  "message": "Error description message.",
  "error": [ ... ]
}
\`\`\`
      `,
      contact: {
        name: 'BRISK Engineering Team',
        email: 'support@brisk.com',
      },
    },
    servers,
    tags: [
      {
        name: 'Admin Authentication',
        description: '⚡ Admin Portal login, session token refresh, admin profile, password management, and logout.',
      },
      {
        name: 'Customer & Trader Auth',
        description: '📱 Mobile registration, OTP SMS verification, login, and session refresh for Customers and Traders.',
      },
      {
        name: 'System Health & Status',
        description: '🛠️ API health checks, server uptime, and status verification endpoints.',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your access token retrieved from `/auth/login` or `/admin/auth/login`.',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation completed successfully.' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Invalid credentials or request validation failed.' },
            error: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Invalid email address format.' },
                },
              },
            },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          },
        },
        AdminUserProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'e1874ae3-0456-486d-aa9b-a6947453da05' },
            fullName: { type: 'string', example: 'System Super Admin' },
            email: { type: 'string', example: 'admin@brisk.com' },
            mobileNumber: { type: 'string', nullable: true, example: '+353870000000' },
            address: { type: 'string', nullable: true, example: 'Dublin, Ireland' },
            role: { type: 'string', enum: ['ADMIN', 'SUPER_ADMIN'], example: 'SUPER_ADMIN' },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], example: 'ACTIVE' },
            profilePhotoUrl: { type: 'string', nullable: true, example: null },
            joinedAt: { type: 'string', format: 'date-time', example: '2026-08-06T12:00:00.000Z' },
            lastLoginAt: { type: 'string', format: 'date-time', nullable: true, example: '2026-08-06T13:30:00.000Z' },
          },
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
