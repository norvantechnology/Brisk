import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-document-rules.controller';
import {
  categoryDocumentRulesSchema,
  categoryIdParamSchema,
  entityDocumentRulesSchema,
} from './admin-document-rules.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * /admin/document-rules/entity/{traderType}:
 *   get:
 *     summary: List entity-level document rules (Sole Trader or Company Trader general docs)
 *     tags: ['Admin / Document Rules']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: traderType
 *         required: true
 *         schema: { type: string, enum: [SOLO, COMPANY] }
 *     responses:
 *       200:
 *         description: Entity document rules retrieved.
 */
router.get('/document-rules/entity/:traderType', controller.getEntityRules);

/**
 * @swagger
 * /admin/document-rules/entity/{traderType}:
 *   put:
 *     summary: Replace entity-level document rules for SOLO or COMPANY onboarding
 *     tags: ['Admin / Document Rules']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Entity document rules updated.
 */
router.put(
  '/document-rules/entity/:traderType',
  validate(entityDocumentRulesSchema),
  controller.putEntityRules
);

/**
 * @swagger
 * /admin/categories/{categoryId}/document-rules:
 *   get:
 *     summary: List category-wise document rules configured by admin
 *     tags: ['Admin / Document Rules']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category document rules retrieved.
 */
router.get(
  '/categories/:categoryId/document-rules',
  validate(categoryIdParamSchema),
  controller.getCategoryRules
);

/**
 * @swagger
 * /admin/categories/{categoryId}/document-rules:
 *   put:
 *     summary: Replace category-wise document rules (shown after trader selects trade skills)
 *     tags: ['Admin / Document Rules']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category document rules updated.
 */
router.put(
  '/categories/:categoryId/document-rules',
  validate(categoryDocumentRulesSchema),
  controller.putCategoryRules
);

export default router;
