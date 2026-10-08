import { Router } from 'express';
import * as adminAuthController from './admin-auth.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import {
  adminLoginSchema,
  adminRefreshSchema,
  changePasswordSchema,
  updateAdminProfileSchema,
} from './admin-auth.validation';

const router = Router();

/**
 * @swagger
 * /admin/auth/login:
 *   post:
 *     summary: Authenticate Admin user via Email & Password to retrieve JWT Tokens and Profile
 *     tags: ['Admin / Auth']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@brisk.com
 *               password:
 *                 type: string
 *                 example: Password1!
 *     responses:
 *       200:
 *         description: Admin logged in successfully.
 *       400:
 *         description: Invalid input payload format.
 *       401:
 *         description: Invalid credentials or inactive admin account.
 */
router.post('/login', validate(adminLoginSchema), adminAuthController.login);

/**
 * @swagger
 * /admin/auth/refresh:
 *   post:
 *     summary: Issue new Access & Refresh Token using valid Admin Refresh Token
 *     tags: ['Admin / Auth']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Admin access token refreshed successfully.
 *       401:
 *         description: Invalid or expired refresh token.
 */
router.post('/refresh', validate(adminRefreshSchema), adminAuthController.refresh);

/**
 * @swagger
 * /admin/auth/me:
 *   get:
 *     summary: Retrieve currently authenticated Admin User profile details
 *     tags: ['Admin / Auth']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile retrieved successfully.
 *       401:
 *         description: Missing or invalid Bearer JWT token.
 */
router.get('/me', adminAuthMiddleware, adminAuthController.getMe);

/**
 * @swagger
 * /admin/auth/me:
 *   patch:
 *     summary: Update currently authenticated Admin User profile
 *     description: |
 *       Send only the fields to change. `null` or `""` clears `mobileNumber`, `address`, `profilePhotoUrl`.
 *
 *       Photo: upload first with `POST /uploads` (`purpose=profile_photo`, admin token), then send the returned `url` as `profilePhotoUrl`.
 *       Changing `email` changes the login email (must not be used by another admin).
 *     tags: ['Admin / Auth']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               fullName: { type: string, minLength: 2, maxLength: 100, example: Snehal Patel }
 *               email: { type: string, format: email, example: admin@brisk.ie }
 *               mobileNumber: { type: string, nullable: true, example: '+353871234567', description: E.164 format }
 *               address: { type: string, nullable: true, maxLength: 500, example: '12 Grafton Street, Dublin 2' }
 *               profilePhotoUrl: { type: string, nullable: true, example: 'https://api.brisk.ie/uploads/profile/admin.jpg' }
 *     responses:
 *       200:
 *         description: Admin profile updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Admin profile updated successfully. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *                       properties:
 *                         id: { type: string, format: uuid, example: 0b1c2d3e-0000-4000-8000-000000000001 }
 *                         fullName: { type: string, example: Snehal Patel }
 *                         email: { type: string, example: admin@brisk.ie }
 *                         mobileNumber: { type: string, nullable: true, example: '+353871234567' }
 *                         address: { type: string, nullable: true, example: '12 Grafton Street, Dublin 2' }
 *                         role: { type: string, example: SUPER_ADMIN }
 *                         status: { type: string, example: ACTIVE }
 *                         profilePhotoUrl: { type: string, nullable: true, example: 'https://api.brisk.ie/uploads/profile/admin.jpg' }
 *                         joinedAt: { type: string, format: date-time, example: '2026-01-10T09:00:00.000Z' }
 *                         lastLoginAt: { type: string, format: date-time, nullable: true, example: '2026-10-08T10:15:00.000Z' }
 *       400:
 *         description: Validation error (no fields, bad email / mobile / URL).
 *       401:
 *         description: Missing or invalid Bearer JWT token.
 *       409:
 *         description: Email already used by another admin.
 */
router.patch('/me', adminAuthMiddleware, validate(updateAdminProfileSchema), adminAuthController.updateMe);

/**
 * @swagger
 * /admin/auth/password:
 *   patch:
 *     summary: Change Admin Password (requires old password & strong password rules)
 *     tags: ['Admin / Auth']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 example: Password1!
 *               newPassword:
 *                 type: string
 *                 example: NewSecretPassword1!
 *               confirmPassword:
 *                 type: string
 *                 example: NewSecretPassword1!
 *     responses:
 *       200:
 *         description: Password changed successfully.
 *       400:
 *         description: Incorrect old password or password validation failure.
 *       401:
 *         description: Unauthorized.
 */
router.patch(
  '/password',
  adminAuthMiddleware,
  validate(changePasswordSchema),
  adminAuthController.changePassword
);

/**
 * @swagger
 * /admin/auth/logout:
 *   post:
 *     summary: Invalidate current Admin user session
 *     tags: ['Admin / Auth']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin logged out successfully.
 *       401:
 *         description: Unauthorized.
 */
router.post('/logout', adminAuthMiddleware, adminAuthController.logout);

export default router;
