import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../middlewares/validate.middleware';
import { registerSchema, verifyOtpSchema, loginSchema, refreshSchema } from './auth.validation';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register Customer or Trader account & send 6-digit SMS OTP verification code
 *     tags: ['[Customer & Trader] Authentication']
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
 *     responses:
 *       201:
 *         description: User registered successfully. OTP code sent.
 *       400:
 *         description: Validation error or invalid input parameters.
 *       409:
 *         description: Email or mobile number already exists.
 */
router.post('/register', validate(registerSchema), authController.register);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify 6-digit SMS OTP code to activate Customer/Trader mobile number
 *     tags: ['[Customer & Trader] Authentication']
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
 *         description: Mobile number verified successfully. Account activated.
 *       400:
 *         description: Invalid or expired OTP code.
 *       404:
 *         description: User with this mobile number does not exist.
 */
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate Customer or Trader via Email & Password to retrieve JWT Tokens
 *     tags: ['[Customer & Trader] Authentication']
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
 *         description: Logged in successfully. Returns JWT tokens.
 *       401:
 *         description: Invalid email/password, or mobile number unverified.
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Issue new User Access Token using valid Refresh Token
 *     tags: ['[Customer & Trader] Authentication']
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
 *         description: Session token refreshed successfully.
 *       401:
 *         description: Invalid or expired refresh token.
 */
router.post('/refresh', validate(refreshSchema), authController.refresh);

export default router;
