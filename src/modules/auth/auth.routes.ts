import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  refreshSchema,
} from './auth.validation';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register Customer or Trader account and send 6-digit SMS OTP verification code
 *     tags: ['Mobile / Auth']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - mobileNumber
 *               - password
 *               - role
 *               - acceptedTerms
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               mobileNumber:
 *                 type: string
 *                 example: "+353871234567"
 *               password:
 *                 type: string
 *                 example: Password1!
 *               role:
 *                 type: string
 *                 enum: [CUSTOMER, TRADER]
 *                 example: CUSTOMER
 *               acceptedTerms:
 *                 type: boolean
 *                 example: true
 *                 description: Must be true — user accepted Terms & Privacy Policy.
 *     responses:
 *       201:
 *         description: User registered successfully. OTP sent. Returns mobileNumber for the OTP screen.
 *       400:
 *         description: Validation error.
 *       409:
 *         description: Email or mobile number already exists.
 *       429:
 *         description: OTP resend cooldown active.
 */
router.post('/register', validate(registerSchema), authController.register);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify 6-digit SMS OTP code to activate Customer/Trader mobile number
 *     tags: ['Mobile / Auth']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobileNumber
 *               - code
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 example: "+353871234567"
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Mobile verified. Returns user profile plus access and refresh tokens.
 *       400:
 *         description: Invalid or expired OTP, or already verified.
 *       404:
 *         description: User not found.
 */
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend 6-digit SMS OTP to an unverified mobile number (60s cooldown)
 *     tags: ['Mobile / Auth']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobileNumber
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 example: "+353871234567"
 *     responses:
 *       200:
 *         description: New OTP sent successfully.
 *       400:
 *         description: Mobile number already verified.
 *       404:
 *         description: User not found.
 *       429:
 *         description: Resend cooldown active — wait before requesting again.
 */
router.post('/resend-otp', validate(resendOtpSchema), authController.resendOtp);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate Customer or Trader via email and password
 *     tags: ['Mobile / Auth']
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
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 example: Password1!
 *     responses:
 *       200:
 *         description: Logged in successfully. Returns JWT tokens and user profile (includes mobileNumber).
 *       401:
 *         description: Invalid email or password.
 *       403:
 *         description: |
 *           Mobile not verified (`data.code` = `MOBILE_NOT_VERIFIED`).
 *           Response `data` includes `mobileNumber`, `userId`, `otpSent`, and cooldown fields so the app can open the OTP screen.
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Issue a new access token using a valid refresh token
 *     tags: ['Mobile / Auth']
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
 *         description: Access token refreshed successfully.
 *       401:
 *         description: Invalid or expired refresh token.
 */
router.post('/refresh', validate(refreshSchema), authController.refresh);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get the currently authenticated Customer or Trader profile
 *     tags: ['Mobile / Auth']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully.
 *       401:
 *         description: Missing or invalid access token.
 */
router.get('/me', authMiddleware, authController.getMe);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out the current Customer or Trader session (client should discard tokens)
 *     tags: ['Mobile / Auth']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully.
 *       401:
 *         description: Missing or invalid access token.
 */
router.post('/logout', authMiddleware, authController.logout);

export default router;
