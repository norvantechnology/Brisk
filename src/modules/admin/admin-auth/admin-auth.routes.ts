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
 *     summary: Admin authentication login
 *     tags: [Admin Authentication]
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
 *                 example: admin@brisk.com
 *               password:
 *                 type: string
 *                 example: Password1!
 *     responses:
 *       200:
 *         description: Admin logged in successfully. Returns JWT tokens and admin profile.
 *       401:
 *         description: Invalid credentials or inactive admin account.
 */
router.post('/login', validate(adminLoginSchema), adminAuthController.login);

/**
 * @swagger
 * /admin/auth/refresh:
 *   post:
 *     summary: Refresh admin session token
 *     tags: [Admin Authentication]
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
 *     responses:
 *       200:
 *         description: Admin access token refreshed.
 *       401:
 *         description: Invalid or expired refresh token.
 */
router.post('/refresh', validate(adminRefreshSchema), adminAuthController.refresh);

/**
 * @swagger
 * /admin/auth/me:
 *   get:
 *     summary: Retrieve profile of currently authenticated admin
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile returned successfully.
 *       401:
 *         description: Unauthorized access token.
 */
router.get('/me', adminAuthMiddleware, adminAuthController.getMe);

/**
 * @swagger
 * /admin/auth/password:
 *   patch:
 *     summary: Change admin user password
 *     tags: [Admin Authentication]
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
 *         description: Password updated successfully.
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
 *     summary: Logout admin session
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin logged out successfully.
 */
router.post('/logout', adminAuthMiddleware, adminAuthController.logout);

export default router;
