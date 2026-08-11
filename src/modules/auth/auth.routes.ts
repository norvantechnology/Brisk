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
  forgotPasswordSchema,
  resetPasswordSchema,
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
 *         description: |
 *           Success in two forms:
 *           1) Fully verified user — returns accessToken, refreshToken, user.
 *           2) Mobile not verified — `data.requiresOtpVerification=true` with mobileNumber for OTP screen (HTTP 200, not an error).
 *       401:
 *         description: Invalid email or password.
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset code (SMS OTP to registered mobile)
 *     tags: ['Mobile / Auth']
 *     description: |
 *       Customer and Trader apps — user enters email on "Forgot Password".
 *       If the account exists, a 6-digit OTP is sent to the registered mobile number.
 *       Response always uses the same message (does not reveal whether the email exists).
 *       When `data.mobileNumber` is present, open the OTP + new-password screen.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *     responses:
 *       200:
 *         description: Generic success. Includes mobileNumber + otpSent when account found.
 *       403:
 *         description: Account blocked, suspended, or inactive.
 *       429:
 *         description: OTP resend cooldown active (returned as 200 with otpSent=false when applicable).
 */
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using SMS OTP from forgot-password flow
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
 *               - newPassword
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 example: "+353871234567"
 *               code:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 example: NewPassword1!
 *     responses:
 *       200:
 *         description: |
 *           Password updated. If mobile already verified, returns access + refresh tokens.
 *           If mobile still unverified, returns requiresOtpVerification for account activation.
 *       400:
 *         description: Invalid or expired OTP.
 *       404:
 *         description: User not found.
 */
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

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
