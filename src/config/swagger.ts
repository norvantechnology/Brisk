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
      description: [
        'Filter by tag: **Admin** · **Website** · **Mobile** · **Customer** · **Trader** · **System**',
        '',
        '**Frontend quick reference**',
        '- **Customers page:** GET /pages/customers · GET /testimonials?type=customer · GET /cms/bootstrap?audience=customer',
        '- **Traders page:** GET /pages/traders · GET /testimonials?type=trader · GET /cms/bootstrap?audience=trader',
        '- **Admin CMS (Customers/Traders content):** Admin / Website / Marketing Pages — /admin/cms/marketing-pages/{customers|traders}/...',
        '- **Contact Us:** POST /contact · Admin / Website / Contact — /admin/cms/contact-submissions',
        '- **Mobile categories:** GET /categories · GET /sub-categories?categoryId={uuid} — no pagination; use iconName / iconUrl for icons',
        '',
        'Each endpoint documents **parameter purpose**, **when to use**, and **examples** in the description.',
      ].join('\n'),
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
      {
        name: 'Admin / Website / Marketing Pages',
        description:
          'Admin add/update for For Customers & For Traders pages. pageSlug=customers|traders. Auth: admin Bearer token.',
      },
      {
        name: 'Admin / Website / Contact',
        description:
          'Contact Us submissions CRM — list, view, update status/notes, export CSV. Auth: admin Bearer token.',
      },
      { name: 'Admin / Website / Legal', description: 'Legal policies' },
      { name: 'Admin / Website / SEO', description: 'SEO settings' },
      { name: 'Admin / Surveys', description: 'View & manage website survey signups (consumer CS-#### and trader TS-####). Admin login required.' },
      { name: 'Website / Content', description: 'Public website reads — Customers/Traders pages, testimonials, bootstrap, blog, FAQ. Parameters explain which page/screen each filter is for.' },
      { name: 'Website / Surveys', description: 'Website survey forms — consumer-survey & trader-survey pages. No login needed.' },
      { name: 'Website / Contact', description: 'Website Contact Us form — public submit, no login. Saves to DB + sends confirmation/notification emails (mock until SMTP/SES).' },
      { name: 'Mobile / Auth', description: 'Customer & Trader auth' },
      { name: 'Mobile / Categories', description: 'Service categories & sub-categories for Customer/Trader apps. No pagination. Each query param documents purpose (featured, categoryId, includeSubcategories) and job-post flags (siteVisitEnabled, priceEnabled, qaFormSchema).' },
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

/**
 * Simple light Swagger theme.
 * Explicitly sets text colors on parameters/responses tables —
 * default Swagger styles + dark browser themes were making body text nearly invisible.
 */
const SWAGGER_CSS = `
  :root {
    --brisk-text: #0f172a;
    --brisk-muted: #475569;
    --brisk-border: #e2e8f0;
    --brisk-surface: #ffffff;
    --brisk-soft: #f8fafc;
    --brisk-accent: #1e293b;
  }

  html, body {
    background: var(--brisk-surface) !important;
    color: var(--brisk-text) !important;
  }

  .swagger-ui {
    background: var(--brisk-surface) !important;
    color: var(--brisk-text) !important;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif !important;
  }

  .swagger-ui .topbar { display: none !important; }

  .swagger-ui .wrapper,
  .swagger-ui .scheme-container,
  .swagger-ui .information-container,
  .swagger-ui section.models,
  .swagger-ui .opblock-body,
  .swagger-ui .opblock-section,
  .swagger-ui .opblock-section-header,
  .swagger-ui .parameters-container,
  .swagger-ui .responses-wrapper,
  .swagger-ui .response-col_description,
  .swagger-ui .tab,
  .swagger-ui .model-box,
  .swagger-ui .highlight-code {
    background: var(--brisk-surface) !important;
    color: var(--brisk-text) !important;
    box-shadow: none !important;
  }

  .swagger-ui .info { margin: 20px 0 4px !important; }
  .swagger-ui .info .title {
    color: var(--brisk-text) !important;
    font-size: 26px !important;
    font-weight: 700 !important;
  }
  .swagger-ui .info .description,
  .swagger-ui .info .description p,
  .swagger-ui .info .description * {
    color: var(--brisk-muted) !important;
    font-size: 14px !important;
  }

  .swagger-ui .scheme-container {
    padding: 10px 0 !important;
    border-bottom: 1px solid var(--brisk-border) !important;
  }

  /* Tags */
  .swagger-ui .opblock-tag {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    padding: 14px 6px !important;
    margin: 0 !important;
    border-bottom: 1px solid var(--brisk-border) !important;
    background: transparent !important;
    color: var(--brisk-text) !important;
    font-size: 15px !important;
    font-weight: 650 !important;
  }
  .swagger-ui .opblock-tag small {
    color: var(--brisk-muted) !important;
    font-weight: 400 !important;
    font-size: 13px !important;
  }
  .swagger-ui .opblock-tag svg { fill: var(--brisk-muted) !important; }

  /* Operation cards */
  .swagger-ui .opblock {
    margin: 0 0 10px !important;
    border: 1px solid var(--brisk-border) !important;
    border-radius: 8px !important;
    background: var(--brisk-soft) !important;
    box-shadow: none !important;
  }
  .swagger-ui .opblock .opblock-summary {
    border: 0 !important;
    padding: 10px 12px !important;
  }
  .swagger-ui .opblock .opblock-summary-path,
  .swagger-ui .opblock .opblock-summary-path a,
  .swagger-ui .opblock .opblock-summary-path__unstable {
    color: var(--brisk-text) !important;
    font-weight: 600 !important;
  }
  .swagger-ui .opblock .opblock-summary-description {
    color: var(--brisk-muted) !important;
  }
  .swagger-ui .opblock .opblock-summary-method {
    min-width: 68px !important;
    background: var(--brisk-accent) !important;
    color: #ffffff !important;
    border-radius: 4px !important;
    font-weight: 700 !important;
  }
  .swagger-ui .opblock.opblock-get,
  .swagger-ui .opblock.opblock-post,
  .swagger-ui .opblock.opblock-put,
  .swagger-ui .opblock.opblock-patch,
  .swagger-ui .opblock.opblock-delete {
    background: var(--brisk-soft) !important;
    border-color: var(--brisk-border) !important;
  }

  /* Section headers: light, not dark navy/green bars */
  .swagger-ui .opblock-section-header {
    background: #f1f5f9 !important;
    border-bottom: 1px solid var(--brisk-border) !important;
    padding: 10px 12px !important;
    box-shadow: none !important;
  }
  .swagger-ui .opblock-section-header h4,
  .swagger-ui .opblock-section-header label,
  .swagger-ui .opblock-section-header span,
  .swagger-ui .opblock-section-header p,
  .swagger-ui .opblock-section-header .btn,
  .swagger-ui .opblock-section-header .tablinks {
    color: var(--brisk-text) !important;
    background: transparent !important;
  }
  .swagger-ui .opblock-section-header .btn {
    border: 1px solid var(--brisk-border) !important;
    border-radius: 6px !important;
    background: #ffffff !important;
    color: var(--brisk-text) !important;
  }
  .swagger-ui .opblock-section-header .btn:hover {
    background: #e2e8f0 !important;
  }
  .swagger-ui .opblock-section-header .tab-header .tab-item.active h4 span {
    color: var(--brisk-text) !important;
  }

  /* Parameters / responses body text — force readable contrast */
  .swagger-ui .opblock-description-wrapper,
  .swagger-ui .opblock-description-wrapper p,
  .swagger-ui .opblock-external-docs-wrapper,
  .swagger-ui .opblock-title_normal,
  .swagger-ui .parameter__name,
  .swagger-ui .parameter__type,
  .swagger-ui .parameter__deprecated,
  .swagger-ui .parameter__in,
  .swagger-ui .parameter__extension,
  .swagger-ui table thead tr td,
  .swagger-ui table thead tr th,
  .swagger-ui table tbody tr td,
  .swagger-ui .response-col_status,
  .swagger-ui .response-col_links,
  .swagger-ui .response-col_description,
  .swagger-ui .response-col_description *,
  .swagger-ui .parameters-col_description,
  .swagger-ui .parameters-col_description *,
  .swagger-ui .parameters-col_name,
  .swagger-ui .parameters-col_name *,
  .swagger-ui .response .markdown,
  .swagger-ui .response .markdown p,
  .swagger-ui .markdown p,
  .swagger-ui .markdown,
  .swagger-ui .no-margin,
  .swagger-ui label,
  .swagger-ui .tab li,
  .swagger-ui .tab li button,
  .swagger-ui .response-controls,
  .swagger-ui .renderedMarkdown,
  .swagger-ui .renderedMarkdown p {
    color: var(--brisk-text) !important;
    opacity: 1 !important;
  }

  /* Markdown descriptions — lists, bold, and inline code */
  .swagger-ui .opblock-description-wrapper .renderedMarkdown,
  .swagger-ui .opblock-description-wrapper .renderedMarkdown p,
  .swagger-ui .opblock-description-wrapper .renderedMarkdown ol,
  .swagger-ui .opblock-description-wrapper .renderedMarkdown ul,
  .swagger-ui .opblock-description-wrapper .renderedMarkdown li,
  .swagger-ui .opblock-description-wrapper .renderedMarkdown strong,
  .swagger-ui .opblock-description-wrapper .markdown,
  .swagger-ui .opblock-description-wrapper .markdown p,
  .swagger-ui .opblock-description-wrapper .markdown ol,
  .swagger-ui .opblock-description-wrapper .markdown ul,
  .swagger-ui .opblock-description-wrapper .markdown li,
  .swagger-ui .opblock-description-wrapper .markdown strong {
    color: var(--brisk-text) !important;
    opacity: 1 !important;
    line-height: 1.65 !important;
  }

  .swagger-ui .opblock-description-wrapper .renderedMarkdown ol,
  .swagger-ui .opblock-description-wrapper .renderedMarkdown ul,
  .swagger-ui .opblock-description-wrapper .markdown ol,
  .swagger-ui .opblock-description-wrapper .markdown ul {
    margin: 8px 0 12px !important;
    padding-left: 24px !important;
  }

  .swagger-ui .opblock-description-wrapper .renderedMarkdown li,
  .swagger-ui .opblock-description-wrapper .markdown li {
    margin: 0 0 8px !important;
    display: list-item !important;
  }

  .swagger-ui .opblock-description-wrapper .renderedMarkdown code,
  .swagger-ui .opblock-description-wrapper .markdown code,
  .swagger-ui .renderedMarkdown code,
  .swagger-ui .markdown code {
    display: inline !important;
    background: #f1f5f9 !important;
    color: #0f172a !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 4px !important;
    padding: 1px 6px !important;
    font-size: 13px !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
    vertical-align: baseline !important;
    line-height: 1.5 !important;
    white-space: normal !important;
    word-break: break-word !important;
    box-shadow: none !important;
  }

  /* Inline code in descriptions must not use JSON dark-block styling */
  .swagger-ui .opblock-description-wrapper .microlight,
  .swagger-ui .opblock-description-wrapper .highlight-code,
  .swagger-ui .renderedMarkdown .microlight,
  .swagger-ui .markdown .microlight {
    display: inline !important;
    background: #f1f5f9 !important;
    color: #0f172a !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 4px !important;
    padding: 1px 6px !important;
    font-size: 13px !important;
    line-height: 1.5 !important;
    box-shadow: none !important;
  }

  .swagger-ui .opblock-description-wrapper .microlight *,
  .swagger-ui .renderedMarkdown .microlight *,
  .swagger-ui .markdown .microlight * {
    color: #0f172a !important;
    background: transparent !important;
  }

  .swagger-ui .parameter__type,
  .swagger-ui .parameter__in,
  .swagger-ui .prop-type,
  .swagger-ui .prop-format {
    color: var(--brisk-muted) !important;
  }

  .swagger-ui table {
    background: #ffffff !important;
  }
  .swagger-ui table thead tr,
  .swagger-ui table thead tr td,
  .swagger-ui table thead tr th {
    background: #f1f5f9 !important;
    color: var(--brisk-text) !important;
    border-bottom: 1px solid var(--brisk-border) !important;
    font-weight: 600 !important;
  }
  .swagger-ui table tbody tr td {
    background: #ffffff !important;
    border-bottom: 1px solid var(--brisk-border) !important;
    color: var(--brisk-text) !important;
    vertical-align: top !important;
  }

  .swagger-ui .parameter__name.required:after {
    color: #b91c1c !important;
  }
  .swagger-ui .required {
    color: #b91c1c !important;
  }

  /* Inputs */
  .swagger-ui input,
  .swagger-ui textarea,
  .swagger-ui select,
  .swagger-ui .filter .operation-filter-input {
    background: #ffffff !important;
    color: var(--brisk-text) !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 6px !important;
    opacity: 1 !important;
  }
  .swagger-ui input::placeholder,
  .swagger-ui textarea::placeholder {
    color: #94a3b8 !important;
  }

  /* Buttons */
  .swagger-ui .btn {
    border-radius: 6px !important;
    box-shadow: none !important;
  }
  .swagger-ui .btn.execute {
    background: var(--brisk-accent) !important;
    border-color: var(--brisk-accent) !important;
    color: #ffffff !important;
  }
  .swagger-ui .btn.authorize {
    background: var(--brisk-accent) !important;
    border-color: var(--brisk-accent) !important;
    color: #ffffff !important;
  }
  .swagger-ui .btn.authorize svg { fill: #ffffff !important; }
  .swagger-ui .authorization__btn svg { fill: var(--brisk-muted) !important; }

  /* JSON request/response examples only — not description markdown */
  .swagger-ui .responses-wrapper .highlight-code,
  .swagger-ui .responses-wrapper .microlight,
  .swagger-ui .body-param__example,
  .swagger-ui .example,
  .swagger-ui .model-example .highlight-code,
  .swagger-ui .model-example .microlight {
    background: #0f172a !important;
    color: #e2e8f0 !important;
    border-radius: 6px !important;
  }
  .swagger-ui .responses-wrapper .highlight-code *,
  .swagger-ui .responses-wrapper .microlight *,
  .swagger-ui .body-param__example *,
  .swagger-ui .example *,
  .swagger-ui .model-example .highlight-code *,
  .swagger-ui .model-example .microlight * {
    color: #e2e8f0 !important;
  }

  .swagger-ui .model-toggle:after { background: var(--brisk-muted) !important; }
  .swagger-ui .model { color: var(--brisk-text) !important; }
  .swagger-ui .prop-name { color: var(--brisk-text) !important; }
`;

export const setupSwagger = (app: Express): void => {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: SWAGGER_CSS,
      customSiteTitle: 'BRISK API',
      customCssUrl: undefined,
      swaggerOptions: {
        docExpansion: 'none',
        tagsSorter: 'none',
        operationsSorter: 'alpha',
        filter: true,
        displayRequestDuration: true,
        defaultModelsExpandDepth: -1,
        defaultModelExpandDepth: -1,
        tryItOutEnabled: false,
      },
    })
  );
};
