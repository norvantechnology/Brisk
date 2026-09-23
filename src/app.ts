import express, { Request, Response } from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import { errorMiddleware } from './middlewares/error.middleware';
import { sendResponse } from './utils/apiResponse';
import { sendMail } from './services/email.service';
import { logger } from './utils/logger';
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
import adminDocumentRulesRoutes from './modules/admin/admin-document-rules/admin-document-rules.routes';
import adminTraderVerificationRoutes from './modules/admin/admin-trader-verification/admin-trader-verification.routes';
import adminTradersRoutes from './modules/admin/admin-traders/admin-traders.routes';
import adminTraderDetailsRoutes from './modules/admin/admin-trader-details/admin-trader-details.routes';
import adminCustomerDetailsRoutes from './modules/admin/admin-customer-details/admin-customer-details.routes';
import homePublicRoutes from './modules/cms/home-public.routes';
import adminOffersRoutes from './modules/admin/admin-offers/admin-offers.routes';
import adminLoyaltyRoutes from './modules/admin/admin-loyalty/admin-loyalty.routes';
import adminCurrencyRoutes from './modules/admin/admin-currency/admin-currency.routes';
import publicOffersRoutes from './modules/offers/public-offers.routes';
import loyaltyRoutes from './modules/loyalty/loyalty.routes';
import currencyRoutes from './modules/currency/currency.routes';
import uploadsRoutes from './modules/uploads/uploads.routes';
import { getUploadRoot } from './modules/uploads/storage/local.storage';
import propertyRoutes from './modules/property/property.routes';
import jobsRoutes from './modules/jobs/jobs.routes';
import checkoutRoutes from './modules/checkout/checkout.routes';
import realtimeRoutes from './sockets/realtime.routes';

const app = express();

// Set security HTTP headers
// Disable HSTS / upgrade-insecure-requests until SSL (HTTPS) is configured on the VPS,
// otherwise browsers upgrade Swagger asset requests to https:// and they fail on :3000.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        upgradeInsecureRequests: null,
      },
    },
    hsts: false,
  })
);

// Enable CORS
app.use(cors());

// Parse JSON request body
app.use(express.json());

// Parse URL-encoded request body
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (local storage — URLs stay stable when switching to S3/CDN)
app.use('/uploads/files', express.static(getUploadRoot()));
app.use('/uploads/files', (_req, res) => {
  res.status(404).json({ success: false, message: 'File not found.' });
});

// Public brand assets (email logo, etc.) — CORP cross-origin so Gmail/Outlook can load imgs
app.use(
  '/assets',
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '../public'))
);

// Mount Swagger Documentation UI
setupSwagger(app);

// Mount API Routes
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/traders', tradersRoutes);
app.use('/admin/auth', adminAuthRoutes);
app.use('/admin', adminCategoryRoutes);
app.use('/admin', adminCustomerRoutes);
app.use('/admin', adminCustomerDetailsRoutes);
app.use('/admin', adminTradersRoutes);
app.use('/admin', adminTraderDetailsRoutes);
app.use('/admin', adminDocumentRulesRoutes);
app.use('/admin', adminTraderVerificationRoutes);
app.use('/admin', adminOffersRoutes);
app.use('/admin', adminLoyaltyRoutes);
app.use('/admin', adminCurrencyRoutes);
app.use('/admin/cms', adminCmsRoutes);
app.use('/admin/cms', adminContactRoutes);
app.use('/admin/blog/categories', adminBlogCategoryRoutes);
app.use('/admin/blog/articles', adminBlogArticleRoutes);
app.use('/admin/knowledge-hub', adminKnowledgeHubRoutes);
app.use('/admin/surveys', adminSurveyRoutes);
app.use('/surveys', surveysRoutes);
app.use('/cms', cmsRoutes);
app.use('/cms/home', homePublicRoutes);
app.use('/pages', marketingPagesPublicRoutes);
app.use('/testimonials', testimonialsPublicRoutes);
app.use('/categories', categoriesRouter);
app.use('/sub-categories', subcategoriesRouter);
app.use('/contact', contactRoutes);
app.use('/', publicOffersRoutes);
app.use('/loyalty', loyaltyRoutes);
app.use('/currency', currencyRoutes);
app.use('/uploads', uploadsRoutes);
app.use('/', propertyRoutes);
app.use('/jobs', jobsRoutes);
app.use('/', checkoutRoutes);
app.use('/realtime', realtimeRoutes);

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

/** Simple per-email cooldown so open SMTP test cannot be hammered. */
const smtpTestLastSentAt = new Map<string, number>();
const SMTP_TEST_COOLDOWN_MS = 60_000;

/**
 * @swagger
 * /health/smtp-test:
 *   get:
 *     summary: Open SMTP test (no auth) - send a test email to ?email=
 *     tags: ['System / Health']
 *     description: |
 *       Open this in a browser, e.g. `/health/smtp-test?email=you@gmail.com`.
 *       No Bearer token. Uses the same SMTP config as production mail.
 *       Cooldown: 60 seconds per email address.
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema: { type: string, format: email, example: you@gmail.com }
 *     responses:
 *       200:
 *         description: Test email accepted by SMTP
 *       400:
 *         description: Missing/invalid email
 *       429:
 *         description: Cooldown active for this email
 *       502:
 *         description: SMTP send failed (error included in response)
 */
app.get('/health/smtp-test', async (req: Request, res: Response) => {
  const email = String(req.query.email || '')
    .trim()
    .toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendResponse({
      res,
      statusCode: 400,
      message: 'Query param email is required (valid email address).',
      data: {
        example: '/health/smtp-test?email=you@gmail.com',
      },
    });
    return;
  }

  const last = smtpTestLastSentAt.get(email) ?? 0;
  const waitMs = SMTP_TEST_COOLDOWN_MS - (Date.now() - last);
  if (waitMs > 0) {
    sendResponse({
      res,
      statusCode: 429,
      message: `Please wait ${Math.ceil(waitMs / 1000)}s before testing this email again.`,
      data: { email, retryAfterSeconds: Math.ceil(waitMs / 1000) },
    });
    return;
  }

  if (!process.env.SMTP_HOST?.trim()) {
    sendResponse({
      res,
      statusCode: 503,
      message: 'SMTP is not configured on this server (SMTP_HOST missing).',
      data: { to: email, smtpConfigured: false },
    });
    return;
  }

  const subject = 'BRISK SMTP test';
  const text = [
    'This is a BRISK SMTP connectivity test.',
    '',
    `Sent at: ${new Date().toISOString()}`,
    `To: ${email}`,
    '',
    'If you received this, outbound SMTP is working.',
  ].join('\n');

  try {
    await sendMail({ to: email, subject, text });
    smtpTestLastSentAt.set(email, Date.now());
    logger.info('[SMTP-TEST] Sent', { email });
    sendResponse({
      res,
      statusCode: 200,
      message: 'Test email sent. Check inbox (and spam).',
      data: {
        to: email,
        subject,
        sentAt: new Date().toISOString(),
        smtpConfigured: Boolean(process.env.SMTP_HOST),
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn('[SMTP-TEST] Failed', { email, error });
    sendResponse({
      res,
      statusCode: 502,
      message: 'SMTP send failed.',
      data: {
        to: email,
        smtpConfigured: Boolean(process.env.SMTP_HOST),
        error,
      },
    });
  }
});

// Centralized error handling middleware
app.use(errorMiddleware);

export default app;
