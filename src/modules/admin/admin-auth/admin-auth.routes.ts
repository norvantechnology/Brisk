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
 *     summary: Admin Portal Login
 *     description: Authenticate Admin or Super Admin user using email and password. Updates last login timestamp and returns JWT access and refresh tokens. Writes event to audit logs.
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
 *                 format: email
 *                 example: admin@brisk.com
 *                 description: Admin account email address.
 *               password:
 *                 type: string
 *                 example: Password1!
 *                 description: Admin account password.
 *     responses:
 *       200:
 *         description: Admin logged in successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Admin logged in successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       $ref: '#/components/schemas/AdminUserProfile'
 *                     tokens:
 *                       $ref: '#/components/schemas/AuthTokens'
 *       400:
 *         description: Validation error (e.g. invalid email format or missing password).
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials or inactive admin account.
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', validate(adminLoginSchema), adminAuthController.login);

/**
 * @swagger
 * /admin/auth/refresh:
 *   post:
 *     summary: Refresh Admin Session Token
 *     description: Issue a new admin access token and refresh token using a valid admin refresh token.
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
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 description: Valid refresh token returned from login or previous refresh.
 *     responses:
 *       200:
 *         description: Admin access token refreshed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Admin session refreshed successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokens:
 *                       $ref: '#/components/schemas/AuthTokens'
 *       401:
 *         description: Invalid or expired refresh token.
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', validate(adminRefreshSchema), adminAuthController.refresh);

/**
 * @swagger
 * /admin/auth/me:
 *   get:
 *     summary: Get Current Admin Profile
 *     description: Retrieve detailed profile of the currently authenticated admin user.
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Admin profile retrieved successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       $ref: '#/components/schemas/AdminUserProfile'
 *       401:
 *         description: Missing, invalid, or expired admin access token.
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', adminAuthMiddleware, adminAuthController.getMe);

/**
 * @swagger
 * /admin/auth/password:
 *   patch:
 *     summary: Change Admin Password
 *     description: Change the authenticated admin's password. Password rules require min 8 characters, one uppercase letter, and one number or special character.
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
 *                 description: Current admin password.
 *               newPassword:
 *                 type: string
 *                 example: NewSecretPassword1!
 *                 description: New password (min 8 chars, 1 uppercase, 1 number/special char).
 *               confirmPassword:
 *                 type: string
 *                 example: NewSecretPassword1!
 *                 description: Must match newPassword.
 *     responses:
 *       200:
 *         description: Password changed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password changed successfully.
 *       400:
 *         description: Incorrect old password or new password validation failure.
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized access.
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
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
 *     summary: Logout Admin Session
 *     description: Invalidate active admin session on the client side.
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin logged out successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Admin logged out successfully.
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', adminAuthMiddleware, adminAuthController.logout);

export default router;
