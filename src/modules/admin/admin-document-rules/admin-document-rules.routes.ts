import { Router } from 'express';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './admin-document-rules.controller';
import {
  categoryDocumentRulesSchema,
  categoryDocumentRuleListSchema,
  createCategoryDocumentRuleSchema,
  createEntityDocumentRuleSchema,
  documentRuleIdParamSchema,
  entityDocumentRulesSchema,
  entityDocumentRuleListSchema,
} from './admin-document-rules.validation';

const router = Router();

router.use(adminAuthMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     DocumentRuleItem:
 *       type: object
 *       required: [documentKey, name]
 *       properties:
 *         documentKey: { type: string, example: passport }
 *         name: { type: string, example: Passport }
 *         description: { type: string, nullable: true, example: Upload a clear photo of the passport }
 *         required: { type: boolean, example: true }
 *         acceptedFormats: { type: string, example: pdf,image }
 *         sortOrder: { type: integer, example: 1 }
 *         status: { type: string, enum: [active, inactive], example: active }
 *     DocumentRule:
 *       allOf:
 *         - $ref: '#/components/schemas/DocumentRuleItem'
 *         - type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             scope: { type: string, enum: [ENTITY, CATEGORY] }
 *             traderType: { type: string, enum: [SOLO, COMPANY], nullable: true }
 *             categoryId: { type: string, format: uuid, nullable: true }
 */

/**
 * @swagger
 * /admin/document-rules/entity/{traderType}:
 *   get:
 *     summary: List entity-level document rules (Sole Trader or Company Trader)
 *     tags: ['Admin / Document Rules']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: traderType
 *         required: true
 *         schema: { type: string, enum: [SOLO, COMPANY] }
 *       - in: query
 *         name: status
 *         required: false
 *         schema: { type: string, enum: [active, inactive] }
 *         description: Optional. Omit to return all records (active + inactive). Pass `active` or `inactive` to filter.
 *     responses:
 *       200:
 *         description: Entity document rules retrieved (all statuses unless `status` query is passed).
 *   post:
 *     summary: Add one entity document rule (SOLO or COMPANY)
 *     tags: ['Admin / Document Rules']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: traderType
 *         required: true
 *         schema: { type: string, enum: [SOLO, COMPANY] }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DocumentRuleItem'
 *           example:
 *             documentKey: driving_license
 *             name: Driving License
 *             description: Upload a clear photo of the driving license
 *             required: true
 *             acceptedFormats: pdf,image
 *             sortOrder: 0
 *             status: active
 *     responses:
 *       201:
 *         description: Document rule created.
 *       409:
 *         description: documentKey already exists for this trader type.
 *   put:
 *     summary: Replace all entity document rules for SOLO or COMPANY
 *     tags: ['Admin / Document Rules']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: traderType
 *         required: true
 *         schema: { type: string, enum: [SOLO, COMPANY] }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rules]
 *             properties:
 *               rules:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/DocumentRuleItem'
 *           example:
 *             rules:
 *               - documentKey: driving_license
 *                 name: Driving License
 *                 required: true
 *                 acceptedFormats: pdf,image
 *                 sortOrder: 0
 *                 status: active
 *               - documentKey: passport
 *                 name: Passport
 *                 required: true
 *                 acceptedFormats: pdf,image
 *                 sortOrder: 1
 *                 status: active
 *     responses:
 *       200:
 *         description: Entity document rules replaced.
 */
router.get(
  '/document-rules/entity/:traderType',
  validate(entityDocumentRuleListSchema),
  controller.getEntityRules
);
router.post(
  '/document-rules/entity/:traderType',
  validate(createEntityDocumentRuleSchema),
  controller.postEntityRule
);
router.put(
  '/document-rules/entity/:traderType',
  validate(entityDocumentRulesSchema),
  controller.putEntityRules
);

/**
 * @swagger
 * /admin/document-rules/{id}:
 *   delete:
 *     summary: Delete one document rule
 *     tags: ['Admin / Document Rules']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Document rule UUID from GET list (`rules[].id`)
 *     responses:
 *       200:
 *         description: Document rule deleted.
 *       404:
 *         description: Document rule not found.
 */
router.delete(
  '/document-rules/:id',
  validate(documentRuleIdParamSchema),
  controller.removeDocumentRule
);

/**
 * @swagger
 * /admin/categories/{categoryId}/document-rules:
 *   get:
 *     summary: List category-wise document rules
 *     tags: ['Admin / Document Rules']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         required: false
 *         schema: { type: string, enum: [active, inactive] }
 *         description: Optional. Omit to return all records (active + inactive). Pass `active` or `inactive` to filter.
 *     responses:
 *       200:
 *         description: Category document rules retrieved (all statuses unless `status` query is passed).
 *   post:
 *     summary: Add one category document rule
 *     tags: ['Admin / Document Rules']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DocumentRuleItem'
 *           example:
 *             documentKey: insurance
 *             name: Insurance
 *             required: true
 *             acceptedFormats: pdf,image
 *             sortOrder: 1
 *             status: active
 *     responses:
 *       201:
 *         description: Document rule created.
 *       409:
 *         description: documentKey already exists for this category.
 *   put:
 *     summary: Replace all category-wise document rules
 *     tags: ['Admin / Document Rules']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rules]
 *             properties:
 *               rules:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/DocumentRuleItem'
 *           example:
 *             rules:
 *               - documentKey: insurance
 *                 name: Insurance
 *                 required: true
 *                 acceptedFormats: pdf,image
 *                 sortOrder: 1
 *                 status: active
 *     responses:
 *       200:
 *         description: Category document rules replaced.
 */
router.get(
  '/categories/:categoryId/document-rules',
  validate(categoryDocumentRuleListSchema),
  controller.getCategoryRules
);
router.post(
  '/categories/:categoryId/document-rules',
  validate(createCategoryDocumentRuleSchema),
  controller.postCategoryRule
);
router.put(
  '/categories/:categoryId/document-rules',
  validate(categoryDocumentRulesSchema),
  controller.putCategoryRules
);

export default router;
