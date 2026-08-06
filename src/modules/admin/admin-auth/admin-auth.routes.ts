import { Router } from 'express';
import * as adminAuthController from './admin-auth.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { adminAuthMiddleware } from '../../../middlewares/admin-auth.middleware';
import {
  adminLoginSchema,
  adminRefreshSchema,
  changePasswordSchema,
} from './admin-auth.validation';

const router = Router();

/**
 * @swagger
 * /admin/auth/login:
 *   post:
 *     summary: Authenticate Admin user via Email & Password to retrieve JWT Tokens and Profile
 *     tags: ['🔐 [Admin Auth] Authentication & Profile']
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
 *     tags: ['🔐 [Admin Auth] Authentication & Profile']
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
 *     tags: ['🔐 [Admin Auth] Authentication & Profile']
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
 * /admin/auth/password:
 *   patch:
 *     summary: Change Admin Password (requires old password & strong password rules)
 *     tags: ['🔐 [Admin Auth] Authentication & Profile']
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
 *     tags: ['🔐 [Admin Auth] Authentication & Profile']
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
