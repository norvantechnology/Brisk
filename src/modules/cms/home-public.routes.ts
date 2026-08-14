import { Router } from 'express';
import * as homeController from './home.controller';
import { validate } from '../../middlewares/validate.middleware';
import { homeSectionRouteParamSchema } from './page-sections.validation';

/** Public homepage CMS — see home.swagger.ts for full API docs. */
const router = Router();

router.get('/', homeController.getHomePage);
router.get('/reviews', homeController.getHomeReviews);
router.get(
  '/:sectionRoute',
  validate(homeSectionRouteParamSchema),
  homeController.getHomeSection
);

export default router;
