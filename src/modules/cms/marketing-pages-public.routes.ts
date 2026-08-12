import { Router } from 'express';
import * as pageSectionsController from './page-sections.controller';
import { validate } from '../../middlewares/validate.middleware';
import { pageSlugParamSchema, pageSlugSectionKeyParamsSchema } from './page-sections.validation';

/** FE doc alias: GET /pages/customers/sections/hero */
const router = Router();

router.get(
  '/:pageSlug/sections/:sectionKey',
  validate(pageSlugSectionKeyParamsSchema),
  pageSectionsController.getPageSection
);

router.get(
  '/:pageSlug',
  validate(pageSlugParamSchema),
  pageSectionsController.getMarketingPage
);

export default router;
