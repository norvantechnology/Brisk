import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './property.controller';
import {
  addressIdParamSchema,
  createAddressSchema,
  propertyIdParamSchema,
  saveSubscriptionsSchema,
  submitReadingSchema,
  updateAddressSchema,
} from './property.validation';

const router = Router();
const customerOnly = [authMiddleware, roleMiddleware(['CUSTOMER'] as const)];

/**
 * @swagger
 * /property/help-tips:
 *   get:
 *     summary: MPRN / GPRN help popup content (dynamic + image URLs)
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Use for the info (i) icons on My Property meter cards.
 *       Each item includes `title`, `heading`, `description`, and `imageUrl` (dummy CDN URL for image helper testing).
 *     responses:
 *       200:
 *         description: Help tip items for MPRN and GPRN popups.
 */
router.get('/property/help-tips', ...customerOnly, controller.getMeterHelpTips);

/**
 * @swagger
 * /utility-providers:
 *   get:
 *     summary: Catalog for Add New Subscription checklist
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns Bins / Electricity / Gas / Home Insurance options with `iconUrl` / `logoUrl` for the checklist UI.
 *     responses:
 *       200:
 *         description: Active utility providers.
 */
router.get('/utility-providers', ...customerOnly, controller.listUtilityProviders);

/**
 * @swagger
 * /addresses:
 *   get:
 *     summary: List saved addresses (My Address tab)
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Address list with primary flag, mapImageUrl, propertyId.
 *   post:
 *     summary: Add address (Add Address modal)
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [addressLine1, city]
 *             properties:
 *               addressType: { type: string, enum: [Home, Work, Custom], example: Home }
 *               label: { type: string, example: Home }
 *               houseNumber: { type: string, example: "14" }
 *               addressLine1: { type: string, example: Oak Street }
 *               addressLine2: { type: string }
 *               city: { type: string, example: Dublin }
 *               county: { type: string, example: Dublin 6 }
 *               eircode: { type: string, example: D06 XY12 }
 *               mprnNumber: { type: string, example: "12345678901" }
 *               gprnNumber: { type: string, example: "12356787" }
 *               utnNumber: { type: string, example: "012345678" }
 *               latitude: { type: number, example: 53.3331 }
 *               longitude: { type: number, example: -6.2489 }
 *               mapImageUrl: { type: string }
 *               isDefault: { type: boolean, example: true }
 *     responses:
 *       201:
 *         description: Address created (also creates linked property + meters when MPRN/GPRN provided).
 */
router.get('/addresses', ...customerOnly, controller.listAddresses);
router.post('/addresses', ...customerOnly, validate(createAddressSchema), controller.createAddress);

/**
 * @swagger
 * /addresses/{id}:
 *   get:
 *     summary: Get one address
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Address detail.
 *   patch:
 *     summary: Update address
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Address updated.
 *   delete:
 *     summary: Delete address
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Address deleted.
 */
router.get('/addresses/:id', ...customerOnly, validate(addressIdParamSchema), controller.getAddress);
router.patch('/addresses/:id', ...customerOnly, validate(updateAddressSchema), controller.updateAddress);
router.delete('/addresses/:id', ...customerOnly, validate(addressIdParamSchema), controller.deleteAddress);

/**
 * @swagger
 * /properties:
 *   get:
 *     summary: List properties for My Property address dropdown
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Properties with fullAddress for Select Address dropdown.
 */
router.get('/properties', ...customerOnly, controller.listProperties);

/**
 * @swagger
 * /properties/{id}:
 *   get:
 *     summary: My Property detail (meters + last readings + subscriptions)
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Property screen payload.
 */
router.get('/properties/:id', ...customerOnly, validate(propertyIdParamSchema), controller.getPropertyDetail);

/**
 * @swagger
 * /properties/{id}/readings:
 *   post:
 *     summary: Submit electricity or gas meter reading
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Property ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [readingValue]
 *             properties:
 *               meterId: { type: string, format: uuid }
 *               meterType: { type: string, enum: [electricity, gas] }
 *               readingValue: { type: number, example: 12345 }
 *               photoUrl: { type: string }
 *     responses:
 *       201:
 *         description: Reading saved; returns updated meter card.
 */
router.post(
  '/properties/:id/readings',
  ...customerOnly,
  validate(submitReadingSchema),
  controller.submitMeterReading
);

/**
 * @swagger
 * /properties/{id}/subscriptions:
 *   put:
 *     summary: Save Add New Subscription checklist selection
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Replaces active subscriptions for the property with the selected `providerIds`
 *       from `GET /utility-providers`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [providerIds]
 *             properties:
 *               providerIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated property detail including subscriptions.
 */
router.put(
  '/properties/:id/subscriptions',
  ...customerOnly,
  validate(saveSubscriptionsSchema),
  controller.savePropertySubscriptions
);

export default router;
