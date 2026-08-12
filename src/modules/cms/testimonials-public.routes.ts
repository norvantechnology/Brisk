import { Router } from 'express';
import * as cmsController from './cms.controller';

/** FE doc alias: GET /testimonials?type=customer */
const router = Router();

router.get('/', cmsController.getTestimonials);

export default router;
