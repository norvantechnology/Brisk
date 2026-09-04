import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { env } from './env';

const servers: { url: string; description: string }[] = [
  { url: '/', description: 'Current' },
  { url: `http://localhost:${env.PORT}`, description: 'Local' },
];

if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  servers.unshift({
    url: `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`,
    description: 'Railway (dev)',
  });
}

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
        '- **Testimonials / reviews (standard):** GET /cms/testimonials?audience=CUSTOMER|TRADER|BOTH&limit=N',
        '- **Customers page:** GET /pages/customers · GET /cms/testimonials?audience=CUSTOMER&limit=5 · GET /cms/bootstrap?audience=customer',
        '- **Traders page:** GET /pages/traders · GET /cms/testimonials?audience=TRADER&limit=5 · GET /cms/bootstrap?audience=trader',
        '- **Homepage:** GET /cms/home · GET /cms/testimonials?audience=BOTH&limit=10 · GET /pages/home',
        '- **Admin CMS (Homepage):** Admin / Website / Home — /admin/cms/home/...',
        '- **Admin CMS (page sections):** Admin / Website / Marketing Pages — pageSlug = customers | traders | home | about-brisk | contact-brisk',
        '- **Admin Settings → Contact Info:** GET/PUT /admin/cms/settings/contact — generalInquiryEmail, customerSupportPhone, officeAddress, showGeneralInquiryEmail, showCustomerSupportPhone, showOfficeAddress',
        '- **Contact form submissions CRM:** Admin / Website / Contact — /admin/cms/contact-submissions (separate from contact-brisk page sections)',
        '- **Mobile categories:** GET /categories · GET /sub-categories?categoryId={uuid} — no pagination; use iconName / iconUrl for icons',
        '- **Mobile Direct Trader UI flow:** Offers list Claim Now → GET /trader-offers/{id} (detail only) → Accept Offer POST /trader-offers/{id}/accept → Post a New Job (jobFormConfig show/hide + POST /uploads purpose=job_photo + POST /jobs) → Choose Location (POST /addresses + PUT /jobs/{id}/location) → POST /jobs/{id}/publish → Payment Details → POST /payments/intent → confirm (success) or fail',
        '- **Customer / Jobs:** /jobs. **Customer / Checkout:** /invoices, /payments, /bookings',
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
      {
        name: 'Admin / Traders',
        description:
          'Traders Management (All Traders): KPI stats, list/search/filters, create, view, edit, status, verification, delete. Auth: admin Bearer. Document review queue is under Admin / Trader Verification.',
      },
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
          'Section CMS for website pages. pageSlug values: customers | traders | home | about-brisk (About Us) | contact-brisk (Contact Us). Auth: admin Bearer. Public FE: GET /pages/{pageSlug}.',
      },
      {
        name: 'Admin / Website / Home',
        description:
          'Admin CMS for website homepage. Base: /admin/cms/home. Auth: admin Bearer token. Edit hero, badges, workflows, categories, stats, reviews, app CTA. Images/icons = URL strings in request body.',
      },
      {
        name: 'Website / Home',
        description:
          'Public homepage CMS. Base: /cms/home. No auth. Full page GET /cms/home or alias GET /pages/home. Reviews: prefer GET /cms/testimonials?audience=BOTH (GET /cms/home/reviews is deprecated alias). Icons/images returned as URL strings.',
      },
      {
        name: 'Admin / Website / Contact',
        description:
          'Contact Us submissions CRM — list, view, update status/notes, export CSV. Auth: admin Bearer token.',
      },
      { name: 'Admin / Website / Legal', description: 'Legal policies — create/edit with content + showInFooter; version publish still available.' },
      { name: 'Admin / Website / SEO', description: 'SEO settings' },
      {
        name: 'Admin / Settings / Contact',
        description:
          'Admin Settings → Contact Info. GET/PUT /admin/cms/settings/contact (generalInquiryEmail, customerSupportPhone, officeAddress, showGeneralInquiryEmail, showCustomerSupportPhone, showOfficeAddress).',
      },
      { name: 'Admin / Surveys', description: 'View & manage website survey signups (consumer CS-#### and trader TS-####). Admin login required.' },
      { name: 'Website / Content', description: 'Public website reads — Customers/Traders pages, testimonials, bootstrap, blog, FAQ. Parameters explain which page/screen each filter is for.' },
      { name: 'Website / Surveys', description: 'Website survey forms — consumer-survey & trader-survey pages. No login needed.' },
      { name: 'Website / Contact', description: 'Website Contact Us form — public submit, no login. Saves to DB + sends confirmation/notification emails (mock until SMTP/SES).' },
      { name: 'Mobile / Auth', description: 'Customer & Trader auth. Responses include `nextStep` navigation key (e.g. `TRADER_ONBOARDING`, `VERIFY_PHONE`). No separate Verify Email step for traders.' },
      {
        name: 'Trader / Onboarding',
        description: [
          'Trader-only onboarding (Sole `SOLO` & Company `COMPANY`).',
          '',
          '**After login:** if `nextStep` is `TRADER_ONBOARDING`, call `GET /traders/onboarding` for saved data and `onboardingScreen`.',
          '',
          '**Prerequisites:** `POST /auth/register` (role=TRADER) → `POST /auth/verify-otp`',
          '',
          '**Figma flow:** Business Verification → Sole/Company Verification → Document Verification → Submit',
          '',
          '**Auth:** Bearer access token on every endpoint. Test OTP: `123456`.',
        ].join('\n'),
      },
      { name: 'Admin / Document Rules', description: 'Admin-configured entity and category document requirements for trader onboarding' },
      { name: 'Admin / Trader Verification', description: 'Admin review queue for submitted trader onboarding applications' },
      {
        name: 'Admin / Offers',
        description:
          'Offers & Promotions: Offer List & Management + Analytics. Create platform offers (OFF-####). Auth: admin Bearer token.',
      },
      {
        name: 'Customer / Offers',
        description: [
          'Mobile Offers tab (Traders Offers / Brisk Offers / promo codes). Auth: customer Bearer.',
          '',
          '**Confirmed UI flow:**',
          '1. Offers list — GET /trader-offers. Claim Now = navigate only (no API claim).',
          '2. Offer Detail — GET /trader-offers/{id} (terms, trader displayName, actions.acceptOffer).',
          '3. Accept Offer button — POST /trader-offers/{id}/accept (alias of /claim).',
          '4. Response nextJobPrefill + jobFormConfig → open Post a New Job.',
          '',
          'Filter query params map 1:1 to the filter modal.',
        ].join('\n'),
      },
      {
        name: 'Customer / Jobs',
        description: [
          'Post a New Job + Select Location + Publish + Site Visit & Pay Fee + Success.',
          '',
          '**Auth:** Customer Bearer.',
          '',
          '**Full site-visit + offer flow:**',
          '1. GET /trader-offers/{id} (Claim Now = navigate only)',
          '2. POST /trader-offers/{id}/accept → nextJobPrefill + jobFormConfig (no hard claim)',
          '3. GET /jobs/form-config?offerId=&categoryId=&subcategoryId= (any entry point)',
          '4. POST /uploads purpose=job_photo → POST /jobs (quoteType ONSITE, offerId, photos…)',
          '5. GET /addresses → PUT /jobs/{id}/location → POST /jobs/{id}/publish',
          '6. Site Visit & Pay Fee — invoice from publish (`siteVisitFee` from subcategory only)',
          '7. POST /payments/intent → POST /payments/{id}/confirm → Success (offer USED)',
          '',
          '**Claim timing:** Accept=prefill. Publish=soft CLAIMED. Payment confirm=USED.',
          '**Fee:** subcategory.siteVisitFee only (unset → 0). No API default amount. UI copy owned by mobile.',
          '',
          'Schemas: Job, JobFormConfig, CreateJobRequest, PublishJobResponse.',
        ].join('\n'),
      },
      {
        name: 'Customer / Checkout',
        description: [
          'Invoice + payment for site visit / service.',
          '',
          '**Auth:** Customer Bearer (must own booking/invoice/payment).',
          '',
          '**Flow:**',
          '1. GET /invoices/{id} — amounts, purpose, lineItems (keys + amounts; labels empty for app copy)',
          '2. POST /payments/intent',
          '3. Success — POST /payments/{id}/confirm (or GET /payments/{id}/receipt)',
          '4. Fail — POST /payments/{id}/fail',
          '',
          '**Copy:** screenTitle / feeNote / payNowLabel / receipt title+message are empty — mobile owns UI text.',
          'Use purpose + amounts + timeline keys. Payments currently mock (mock: true).',
        ].join('\n'),
      },
      {
        name: 'Customer / Loyalty',
        description:
          'Mobile Offers → Loyalty tab (dynamic offers from Admin). GET /loyalty/account, GET /loyalty/offers, POST /loyalty/offers/:id/redeem. Admin manages offers at /admin/loyalty/offers.',
      },
      {
        name: 'Admin / Loyalty',
        description:
          'Admin CRUD for BRP loyalty offers. Created offers appear on customer GET /loyalty/offers when status=active.',
      },
      {
        name: 'Admin / Currency',
        description:
          'Admin currency catalog, platform base currency, and exchange rates. Historical payments keep stored currencyCode; rates affect new catalog/display only.',
      },
      {
        name: 'Customer / Currency',
        description:
          'GET /currency — active currencies + rates. Set preferredCurrency on PATCH /users/me (new records only; history unchanged).',
      },
      {
        name: 'Uploads',
        description:
          'POST /uploads multipart (file + purpose) → { url, objectKey }. Use url in existing JSON fields. Auth: customer, trader, or admin Bearer token.',
      },
      {
        name: 'Trader / Offers',
        description: 'Trader-authored offers CRUD under /traders/offers. Auth: trader Bearer token.',
      },
      { name: 'Mobile / Categories', description: 'Service categories & sub-categories for Customer/Trader apps. No pagination. Each query param documents purpose (featured, categoryId, includeSubcategories) and job-post flags (siteVisitEnabled, priceEnabled, qaFormSchema).' },
      {
        name: 'Customer / Property',
        description:
          'My Property + My Address tabs. Addresses CRUD, property meters/readings, utility subscriptions, MPRN/GPRN help tips with imageUrl. Auth: customer Bearer token.',
      },
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
  apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.swagger.ts', './src/app.ts', './src/server.ts'],
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

  /* Filter bar */
  .swagger-ui .filter-container,
  .swagger-ui .filter .operation-filter-input {
    width: 100% !important;
    max-width: 100% !important;
  }

  /* Responsive layout */
  @media (max-width: 768px) {
    .swagger-ui .wrapper { padding: 0 12px !important; }
    .swagger-ui .info .title { font-size: 22px !important; }
    .swagger-ui .opblock-tag { flex-wrap: wrap !important; font-size: 14px !important; }
    .swagger-ui .opblock .opblock-summary {
      flex-wrap: wrap !important;
      gap: 8px !important;
    }
    .swagger-ui .opblock .opblock-summary-path {
      max-width: 100% !important;
      word-break: break-all !important;
      font-size: 13px !important;
    }
    .swagger-ui table thead { display: none !important; }
    .swagger-ui table tbody tr {
      display: block !important;
      margin-bottom: 12px !important;
      border: 1px solid var(--brisk-border) !important;
      border-radius: 6px !important;
      padding: 8px !important;
    }
    .swagger-ui table tbody tr td {
      display: block !important;
      width: 100% !important;
      border: 0 !important;
      padding: 4px 0 !important;
    }
    .swagger-ui .parameters-col_description,
    .swagger-ui .response-col_description {
      font-size: 13px !important;
    }
  }

  /* Strong emphasis in descriptions stays readable */
  .swagger-ui .renderedMarkdown strong,
  .swagger-ui .markdown strong {
    color: #0f172a !important;
    font-weight: 650 !important;
  }

  /* Links in descriptions */
  .swagger-ui .renderedMarkdown a,
  .swagger-ui .markdown a {
    color: #0369a1 !important;
    text-decoration: underline !important;
  }
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
