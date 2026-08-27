import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './property.controller';
import {
  addressIdParamSchema,
  createAddressSchema,
  propertyIdParamSchema,
  removeSubscriptionSchema,
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
 *     summary: MPRN / GPRN help popup content (optional / legacy)
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Preferred:** tooltip is already embedded on list/detail items — no extra call needed.
 *       - Addresses → `mprnHelpTip` / `gprnHelpTip`
 *       - Property meters → `meters[].helpTip`
 *
 *       This endpoint remains for optional/legacy use only.
 *     responses:
 *       200:
 *         description: Help tip array in `data`.
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
 *       Returns Bins / Electricity / Gas / Home Insurance options with `iconUrl` / `logoUrl`.
 *       `data` is a **list** (not `{ items: [] }`).
 *     responses:
 *       200:
 *         description: Provider array in `data`.
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
 *     description: |
 *       `data` is a **list** of address objects (not `{ items: [] }`).
 *     responses:
 *       200:
 *         description: Address array in `data`.
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
 *     description: |
 *       `data` is a **list** of property objects (not `{ items: [] }`).
 *     responses:
 *       200:
 *         description: Property array in `data`.
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
 *         description: |
 *           Property screen payload including:
 *           - `mprnNumber` / `gprnNumber` (from address or meters)
 *           - `meters[]` with `referenceNumber` (MPRN/GPRN) + `referenceLabel`
 *           - `subscriptions[]` with `mprnNumber`/`gprnNumber` for electricity/gas rows
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
 *     summary: Save Add New Subscription checklist (sync checked providers)
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Add New Subscription** modal — send **all currently checked** `providerIds`
 *       from `GET /utility-providers` (full desired list).
 *
 *       **Sync behaviour (no separate DELETE needed for uncheck):**
 *       - Checked providers → create or reactivate (`status: active`)
 *       - Unchecked / omitted providers → soft-cancel (`status: cancelled`, row kept in DB)
 *
 *       Example: list has Bins + Electricity + Insurance; user unchecks Electricity and saves
 *       `{ "providerIds": ["bins-id", "insurance-id"] }` → Electricity removed from active list.
 *
 *       Response includes property `mprnNumber` / `gprnNumber` and per-subscription meter refs.
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
 *                 description: Full list of checked provider IDs after Save.
 *                 example: ['66888097-acca-4e31-bd0c-9ed5e3115c0b', 'aviva-uuid']
 *     responses:
 *       200:
 *         description: Updated property detail; active subscriptions match checked list.
 */
router.put(
  '/properties/:id/subscriptions',
  ...customerOnly,
  validate(saveSubscriptionsSchema),
  controller.savePropertySubscriptions
);

/**
 * @swagger
 * /properties/{id}/subscriptions/{subscriptionId}:
 *   delete:
 *     summary: Remove one subscription from Your Subscriptions (soft delete)
 *     tags: ['Customer / Property']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Soft-deletes the subscription (`status: cancelled`). Row stays in DB for audit/backup.
 *       Active list (`GET /properties/{id}`) only returns `status: active`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Subscription soft-deleted (cancelled); returns updated property detail.
 *       404:
 *         description: Subscription not found.
 */
router.delete(
  '/properties/:id/subscriptions/:subscriptionId',
  ...customerOnly,
  validate(removeSubscriptionSchema),
  controller.removePropertySubscription
);

export default router;
