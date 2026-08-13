import { Router } from 'express';
import * as usersController from './users.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { updateProfileSchema, deactivateAccountSchema } from './users.validation';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get full Customer or Trader user profile (email is read-only)
 *     tags: ['Customer / Profile']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       `data` is a flat profile object (not nested under `profile`).
 *     responses:
 *       200:
 *         description: |
 *           Flat profile in `data`: id, fullName, email, mobileNumber, profilePhotoUrl, city, country,
 *           preferredLanguage, preferredTimeSlot, emailNotifications, smsAlerts, promoNotifications, etc.
 */
router.get('/me', usersController.getProfile);

/**
 * @swagger
 * /users/me/stats:
 *   get:
 *     summary: Get derived profile stats (jobs posted, saved traders count)
 *     tags: ['Customer / Profile']
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       `data` is a flat stats object (not nested under `stats`).
 *     responses:
 *       200:
 *         description: |
 *           Flat stats in `data`: jobsPosted, savedTradersCount, reviewsGivenCount, avgRating.
 */
router.get('/me/stats', usersController.getStats);

/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: Update user profile and notification preferences (email cannot be changed)
 *     tags: ['Customer / Profile']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string, example: Jane Doe }
 *               mobileNumber: { type: string, example: "+353871234567" }
 *               alternatePhone: { type: string, example: "+353871234568" }
 *               city: { type: string, example: Dublin }
 *               country: { type: string, example: Ireland }
 *               profilePhotoUrl: { type: string, example: "https://cdn.example.com/photo.jpg" }
 *               preferredLanguage: { type: string, example: "English (UK)" }
 *               preferredTimeSlot: { type: string, example: "Morning (09:00 - 12:00)" }
 *               emailNotifications: { type: boolean, example: true }
 *               smsAlerts: { type: boolean, example: true }
 *               promoNotifications: { type: boolean, example: false }
 *     responses:
 *       200:
 *         description: Profile updated successfully.
 */
router.patch('/me', validate(updateProfileSchema), usersController.updateProfile);

/**
 * @swagger
 * /users/deactivate:
 *   post:
 *     summary: Submit GDPR account deactivation request (processed in 24–48 hours)
 *     tags: ['Customer / Profile']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Privacy concerns
 *               additionalComments:
 *                 type: string
 *                 example: I no longer need the service.
 *     responses:
 *       201:
 *         description: Deactivation request submitted successfully.
 *       409:
 *         description: A deletion request is already in progress.
 */
router.post('/deactivate', validate(deactivateAccountSchema), usersController.deactivateAccount);

export default router;
