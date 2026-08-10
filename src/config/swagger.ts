import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { env } from './env';

const servers: { url: string; description: string }[] = [
  {
    url: '/',
    description: 'Current environment',
  },
  {
    url: `http://localhost:${env.PORT}`,
    description: 'Local development',
  },
];

if (process.env.RENDER_EXTERNAL_URL) {
  servers.unshift({
    url: process.env.RENDER_EXTERNAL_URL,
    description: 'Production (Render)',
  });
}

/**
 * Tag naming convention (for frontend teams):
 *   Admin Panel — …   → Admin web dashboard
 *   Website — …       → Public marketing / web site (no auth)
 *   Mobile Apps — …   → Shared Customer + Trader auth
 *   Customer App — …  → Customer mobile app
 *   Trader App — …    → Trader mobile app
 *   System — …        → Ops / health
 */
const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BRISK Platform API',
      version: '1.0.0',
      description: `
## Who should use which APIs?

| Prefix | Client | Auth |
|--------|--------|------|
| **Admin Panel —** | Admin dashboard / ops tools | Admin JWT (\`Bearer\`) |
| **Website —** | Public marketing website | None (published content) |
| **Mobile Apps —** | Shared Customer & Trader login/OTP | User JWT after login |
| **Customer App —** | Customer mobile application | User JWT (CUSTOMER) |
| **Trader App —** | Trader mobile application | User JWT (TRADER) |
| **System —** | Monitoring / devops | None |

**Website Management (admin write → website read)**  
Admin writes live under \`Admin Panel — Website · …\`.  
The public site consumes the same data via \`Website — Public Content\` (\`/cms/*\`).

**Images:** pass HTTPS URL strings in JSON for now (S3 upload service comes later).
      `.trim(),
    },
    servers,
    tags: [
      // —— Admin Panel ——
      {
        name: 'Admin Panel — Auth',
        description: 'Admin dashboard login, token refresh, profile, password change, logout.',
      },
      {
        name: 'Admin Panel — Categories',
        description: 'Master service categories used across admin, customer, and trader flows.',
      },
      {
        name: 'Admin Panel — Sub-Categories',
        description: 'Sub-categories linked to a parent master category.',
      },
      {
        name: 'Admin Panel — Customers',
        description: 'Customer directory: list, create, detail, update, delete.',
      },
      {
        name: 'Admin Panel — Deletion Requests',
        description: 'GDPR account-deletion queue, review, and anonymization.',
      },
      {
        name: 'Admin Panel — Payments',
        description: 'Customer transactions, invoices, refunds, and loyalty summaries.',
      },
      {
        name: 'Admin Panel — Website · Dashboard',
        description: 'Website Management CMS dashboard KPIs and recent audit activity.',
      },
      {
        name: 'Admin Panel — Website · Pages',
        description: 'Static website pages (create, edit, publish, toggle, duplicate).',
      },
      {
        name: 'Admin Panel — Website · Social Links',
        description: 'Footer / header social profile links.',
      },
      {
        name: 'Admin Panel — Website · Blog Categories',
        description: 'Blog taxonomy for Website Management (snake_case payloads).',
      },
      {
        name: 'Admin Panel — Website · Blog Articles',
        description: 'Blog articles CRUD, featured spotlight, cover image URL.',
      },
      {
        name: 'Admin Panel — Website · Knowledge Hub',
        description: 'Knowledge Hub sections, content blocks, graphic image URL.',
      },
      {
        name: 'Admin Panel — Website · FAQ',
        description: 'Help-center FAQs and FAQ categories (audience + reorder).',
      },
      {
        name: 'Admin Panel — Website · Testimonials',
        description: 'Marketing testimonials and homepage spotlight stats.',
      },
      {
        name: 'Admin Panel — Website · Legal',
        description: 'Versioned legal policies (terms, privacy, refunds).',
      },
      {
        name: 'Admin Panel — Website · SEO',
        description: 'Global SEO meta, Open Graph, Analytics ID, robots.txt.',
      },
      {
        name: 'Admin Panel — Surveys · Consumer',
        description: 'Consumer launch-party registration CRM (list, stats, export, notes).',
      },

      // —— Public Website ——
      {
        name: 'Website — Public Content',
        description:
          'Public website GET APIs (`/cms/*`) for a dynamic site. Published/active content only. Start with `GET /cms/bootstrap`.',
      },
      {
        name: 'Website — Survey Signup',
        description: 'Public consumer survey / launch-party form (`POST /surveys/consumer`).',
      },

      // —— Mobile apps ——
      {
        name: 'Mobile Apps — Auth',
        description: 'Shared Customer & Trader registration, OTP, login, refresh, me, logout.',
      },
      {
        name: 'Customer App — Profile',
        description: 'Customer profile, stats, preferences, and account deactivation.',
      },
      {
        name: 'Trader App — Profile',
        description: 'Trader business profile, categories, and verification status.',
      },

      // —— System ——
      {
        name: 'System — Health',
        description: 'API health check and uptime.',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Admin JWT for Admin Panel routes, or User JWT for Customer/Trader app routes.',
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.ts', './src/app.ts', './src/server.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

/** Calm, professional Swagger UI — muted greys, no colorful chrome. */
const SWAGGER_CSS = `
  .swagger-ui .topbar { display: none; }
  .swagger-ui { font-family: "IBM Plex Sans", "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2933; }
  .swagger-ui .info .title { font-size: 1.75rem; font-weight: 600; color: #111827; }
  .swagger-ui .info .description,
  .swagger-ui .info .description p,
  .swagger-ui .info .description td,
  .swagger-ui .info .description th { color: #374151; font-size: 14px; line-height: 1.5; }
  .swagger-ui .info .description table { border-collapse: collapse; width: 100%; margin: 12px 0 20px; }
  .swagger-ui .info .description th,
  .swagger-ui .info .description td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
  .swagger-ui .info .description th { background: #f3f4f6; font-weight: 600; }
  .swagger-ui .opblock-tag {
    border-bottom: 1px solid #e5e7eb;
    color: #111827 !important;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .swagger-ui .opblock-tag small { color: #6b7280 !important; font-weight: 400; }
  .swagger-ui .opblock.opblock-get { background: rgba(55, 65, 81, 0.04); border-color: #9ca3af; }
  .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #374151; }
  .swagger-ui .opblock.opblock-post { background: rgba(55, 65, 81, 0.04); border-color: #9ca3af; }
  .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #4b5563; }
  .swagger-ui .opblock.opblock-put { background: rgba(55, 65, 81, 0.04); border-color: #9ca3af; }
  .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #4b5563; }
  .swagger-ui .opblock.opblock-patch { background: rgba(55, 65, 81, 0.04); border-color: #9ca3af; }
  .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #6b7280; }
  .swagger-ui .opblock.opblock-delete { background: rgba(55, 65, 81, 0.04); border-color: #9ca3af; }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #1f2937; }
  .swagger-ui .btn.authorize { background: #111827; border-color: #111827; color: #fff; }
  .swagger-ui .btn.authorize svg { fill: #fff; }
  .swagger-ui .scheme-container { background: #f9fafb; box-shadow: none; border-bottom: 1px solid #e5e7eb; }
`;

export const setupSwagger = (app: Express): void => {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: SWAGGER_CSS,
      customSiteTitle: 'BRISK API Documentation',
      swaggerOptions: {
        docExpansion: 'none',
        tagsSorter: 'none',
        operationsSorter: 'alpha',
        filter: true,
        displayRequestDuration: true,
        defaultModelsExpandDepth: -1,
      },
    })
  );
};
