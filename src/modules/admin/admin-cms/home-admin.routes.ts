import { Router } from 'express';
import * as homeAdminController from './home-admin.controller';
import { validate } from '../../../middlewares/validate.middleware';
import {
  homeSectionRouteParamSchema,
  homeUpdateSectionSchema,
  updateSectionItemSchema,
  sectionItemIdParamSchema,
  sectionItemStatusSchema,
  bulkItemSortSchema,
  homePageUpdateSchema,
  homeCreateItemSchema,
} from '../../cms/page-sections.validation';
import { idParamSchema, testimonialStatusSchema } from './admin-cms.validation';

/** Admin homepage CMS — see home-admin.swagger.ts for full API docs. */
const router = Router();

const bindSection =
  (sectionRoute: string) =>
  (req: { params: { sectionRoute?: string } }, _res: unknown, next: () => void) => {
    req.params.sectionRoute = sectionRoute;
    next();
  };

router.get('/', homeAdminController.getAdminHomePage);
router.put('/', validate(homePageUpdateSchema), homeAdminController.updateAdminHomePage);

const sectionPut = (path: string, sectionRoute: string) => {
  router.put(
    path,
    bindSection(sectionRoute),
    validate(homeUpdateSectionSchema),
    homeAdminController.upsertAdminHomeSection
  );
  router.get(
    path,
    bindSection(sectionRoute),
    validate(homeSectionRouteParamSchema),
    homeAdminController.getAdminHomeSection
  );
};

sectionPut('/hero', 'hero');
sectionPut('/hero-badges', 'hero-badges');
sectionPut('/job-process', 'job-process');
sectionPut('/customer-workflow', 'customer-workflow');
sectionPut('/connected-marketplace', 'connected-marketplace');
sectionPut('/service-categories', 'service-categories');
sectionPut('/why-brisk', 'why-brisk');
sectionPut('/customer', 'customer');
sectionPut('/trader', 'trader');
sectionPut('/statistics', 'statistics');
sectionPut('/app-download', 'app-download');

const itemCreate = (path: string, sectionRoute: string) => {
  router.post(
    path,
    bindSection(sectionRoute),
    validate(homeCreateItemSchema),
    homeAdminController.createAdminHomeSectionItem
  );
};

itemCreate('/hero-badges', 'hero-badges');
itemCreate('/job-process/steps', 'job-process');
itemCreate('/customer-workflow/steps', 'customer-workflow');
itemCreate('/connected-marketplace/items', 'connected-marketplace');
itemCreate('/why-brisk/items', 'why-brisk');
itemCreate('/customer/features', 'customer');
itemCreate('/trader/features', 'trader');
itemCreate('/service-categories', 'service-categories');
itemCreate('/statistics', 'statistics');

const itemMutate = (basePath: string) => {
  router.put(basePath, validate(updateSectionItemSchema), homeAdminController.updateAdminHomeSectionItem);
  router.delete(
    basePath,
    validate(sectionItemIdParamSchema),
    homeAdminController.deleteAdminHomeSectionItem
  );
};

itemMutate('/hero-badges/:itemId');
itemMutate('/job-process/steps/:itemId');
itemMutate('/customer-workflow/steps/:itemId');
itemMutate('/connected-marketplace/items/:itemId');
itemMutate('/why-brisk/items/:itemId');
itemMutate('/customer/features/:itemId');
itemMutate('/trader/features/:itemId');
itemMutate('/service-categories/:itemId');
itemMutate('/statistics/:itemId');

router.put(
  '/hero-badges/:itemId/status',
  validate(sectionItemStatusSchema),
  homeAdminController.updateAdminHomeSectionItemStatus
);
router.put(
  '/service-categories/:itemId/status',
  validate(sectionItemStatusSchema),
  homeAdminController.updateAdminHomeSectionItemStatus
);

router.put(
  '/service-categories/sort',
  bindSection('service-categories'),
  validate(bulkItemSortSchema),
  homeAdminController.sortAdminHomeSectionItems
);
router.put(
  '/statistics/sort',
  bindSection('statistics'),
  validate(bulkItemSortSchema),
  homeAdminController.sortAdminHomeSectionItems
);

router.get('/reviews', homeAdminController.listAdminHomeReviews);
router.put('/reviews/sort', validate(bulkItemSortSchema), homeAdminController.sortAdminHomeReviews);
router.post('/reviews', homeAdminController.createAdminHomeReview);
router.get('/reviews/:id', validate(idParamSchema), homeAdminController.getAdminHomeReview);
router.put('/reviews/:id', validate(idParamSchema), homeAdminController.updateAdminHomeReview);
router.delete('/reviews/:id', validate(idParamSchema), homeAdminController.deleteAdminHomeReview);
router.put(
  '/reviews/:id/status',
  validate(testimonialStatusSchema),
  homeAdminController.updateAdminHomeReviewStatus
);

export default router;
