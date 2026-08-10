import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { env } from './env';

const servers: { url: string; description: string }[] = [
  { url: '/', description: 'Current' },
  { url: `http://localhost:${env.PORT}`, description: 'Local' },
];

if (process.env.RENDER_EXTERNAL_URL) {
  servers.unshift({
    url: process.env.RENDER_EXTERNAL_URL,
    description: 'Production',
  });
}

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BRISK API',
      version: '1.0.0',
      description:
        'Filter by tag: **Admin** · **Website** · **Mobile** · **Customer** · **Trader** · **System**',
    },
    servers,
    tags: [
      { name: 'Admin / Auth', description: 'Admin login & session' },
      { name: 'Admin / Categories', description: 'Master categories' },
      { name: 'Admin / Sub-Categories', description: 'Sub-categories' },
      { name: 'Admin / Customers', description: 'Customer directory' },
      { name: 'Admin / Deletion Requests', description: 'GDPR deletion queue' },
      { name: 'Admin / Payments', description: 'Transactions, invoices, refunds' },
      { name: 'Admin / Website / Dashboard', description: 'CMS dashboard' },
      { name: 'Admin / Website / Pages', description: 'Static pages' },
      { name: 'Admin / Website / Social Links', description: 'Social links' },
      { name: 'Admin / Website / Blog Categories', description: 'Blog categories' },
      { name: 'Admin / Website / Blog Articles', description: 'Blog articles' },
      { name: 'Admin / Website / Knowledge Hub', description: 'Knowledge Hub' },
      { name: 'Admin / Website / FAQ', description: 'FAQs' },
      { name: 'Admin / Website / Testimonials', description: 'Testimonials' },
      { name: 'Admin / Website / Legal', description: 'Legal policies' },
      { name: 'Admin / Website / SEO', description: 'SEO settings' },
      { name: 'Admin / Surveys', description: 'Consumer survey CRM' },
      { name: 'Website / Content', description: 'Public /cms reads' },
      { name: 'Website / Surveys', description: 'Public survey signup' },
      { name: 'Mobile / Auth', description: 'Customer & Trader auth' },
      { name: 'Customer / Profile', description: 'Customer profile' },
      { name: 'Trader / Profile', description: 'Trader profile' },
      { name: 'System / Health', description: 'Health check' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Admin or user access token',
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.ts', './src/app.ts', './src/server.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

/** Force a clean light theme so tag labels stay readable. */
const SWAGGER_CSS = `
  html { background: #ffffff !important; }
  body { background: #ffffff !important; margin: 0; }
  .swagger-ui,
  .swagger-ui .wrapper,
  .swagger-ui .scheme-container,
  .swagger-ui .information-container,
  .swagger-ui section.models {
    background: #ffffff !important;
    color: #111827 !important;
    box-shadow: none !important;
  }
  .swagger-ui .topbar { display: none !important; }
  .swagger-ui .info { margin: 24px 0 8px; }
  .swagger-ui .info .title {
    color: #111827 !important;
    font-size: 28px !important;
    font-weight: 650 !important;
  }
  .swagger-ui .info .description,
  .swagger-ui .info .description p,
  .swagger-ui .info .description * {
    color: #4b5563 !important;
    font-size: 14px !important;
  }
  .swagger-ui .scheme-container {
    padding: 12px 0 !important;
    border-bottom: 1px solid #e5e7eb !important;
  }
  .swagger-ui .opblock-tag-section { margin: 0 !important; }
  .swagger-ui .opblock-tag {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 16px !important;
    padding: 12px 4px !important;
    margin: 0 !important;
    border-bottom: 1px solid #e5e7eb !important;
    background: transparent !important;
    color: #111827 !important;
    font-size: 15px !important;
    font-weight: 600 !important;
  }
  .swagger-ui .opblock-tag:hover { background: #f9fafb !important; }
  .swagger-ui .opblock-tag small {
    flex: 1 !important;
    padding-left: 12px !important;
    color: #6b7280 !important;
    font-size: 13px !important;
    font-weight: 400 !important;
  }
  .swagger-ui .opblock-tag svg { fill: #6b7280 !important; }
  .swagger-ui .filter-container .operation-filter-input,
  .swagger-ui input[type="search"],
  .swagger-ui input[type="text"] {
    background: #ffffff !important;
    color: #111827 !important;
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
  }
  .swagger-ui select {
    background: #ffffff !important;
    color: #111827 !important;
    border: 1px solid #d1d5db !important;
  }
  .swagger-ui .btn.authorize {
    background: #111827 !important;
    border-color: #111827 !important;
    color: #ffffff !important;
  }
  .swagger-ui .btn.authorize svg { fill: #ffffff !important; }
  .swagger-ui .opblock { border-radius: 6px !important; box-shadow: none !important; }
  .swagger-ui .opblock .opblock-summary-description { color: #4b5563 !important; }
  .swagger-ui .opblock .opblock-summary-path { color: #111827 !important; }
  .swagger-ui .opblock.opblock-get { background: #f8fafc !important; border-color: #cbd5e1 !important; }
  .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #334155 !important; }
  .swagger-ui .opblock.opblock-post { background: #f8fafc !important; border-color: #cbd5e1 !important; }
  .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #475569 !important; }
  .swagger-ui .opblock.opblock-put,
  .swagger-ui .opblock.opblock-patch { background: #f8fafc !important; border-color: #cbd5e1 !important; }
  .swagger-ui .opblock.opblock-put .opblock-summary-method,
  .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #64748b !important; }
  .swagger-ui .opblock.opblock-delete { background: #f8fafc !important; border-color: #cbd5e1 !important; }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #1e293b !important; }
`;

export const setupSwagger = (app: Express): void => {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: SWAGGER_CSS,
      customSiteTitle: 'BRISK API',
      swaggerOptions: {
        docExpansion: 'none',
        tagsSorter: 'none',
        operationsSorter: 'alpha',
        filter: true,
        displayRequestDuration: true,
        defaultModelsExpandDepth: -1,
        defaultModelExpandDepth: -1,
      },
    })
  );
};
