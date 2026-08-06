import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../middlewares/validate.middleware';
import { registerSchema, verifyOtpSchema, loginSchema, refreshSchema } from './auth.validation';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register Customer or Trader
 *     description: Register a new account as a Customer or Trader. Generates and sends a 6-digit SMS verification OTP to the user's mobile number.
 *     tags: [Customer & Trader Auth]
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
 *                 description: User's full display name.
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *                 description: User's unique email address.
 *               mobileNumber:
 *                 type: string
 *                 example: "+353871234567"
 *                 description: Unique mobile phone number with country code.
 *               password:
 *                 type: string
 *                 example: Password1!
 *                 description: Account password (min 8 chars, 1 uppercase, 1 number/special char).
 *               role:
 *                 type: string
 *                 enum: [CUSTOMER, TRADER]
 *                 example: CUSTOMER
 *                 description: Account role (CUSTOMER or TRADER).
 *     responses:
 *       201:
 *         description: User registered successfully. OTP code sent.
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
 *                   example: Registration successful. Verification code has been sent to your mobile number.
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                       example: a1b2c3d4-e5f6-7890-abcd-ef1234567890
 *       400:
 *         description: Validation error or invalid input.
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email or mobile number is already registered.
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', validate(registerSchema), authController.register);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify Mobile Phone OTP
 *     description: Verify the 6-digit SMS OTP code sent during registration to activate the mobile number.
 *     tags: [Customer & Trader Auth]
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
 *                 description: Mobile number used during registration.
 *               code:
 *                 type: string
 *                 example: "123456"
 *                 description: 6-digit OTP verification code.
 *     responses:
 *       200:
 *         description: Mobile number verified successfully.
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
 *                   example: Mobile number verified successfully. Your account is now active.
 *       400:
 *         description: Invalid or expired OTP code.
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Customer / Trader Login
 *     description: Authenticate user using email and password. Returns JWT access and refresh tokens. Requires verified mobile number.
 *     tags: [Customer & Trader Auth]
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
 *                 description: Registered account email.
 *               password:
 *                 type: string
 *                 example: Password1!
 *                 description: Account password.
 *     responses:
 *       200:
 *         description: Logged in successfully. Returns JWT tokens.
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
 *                   example: Logged in successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id: { type: string, format: uuid, example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
 *                         fullName: { type: string, example: 'Jane Doe' }
 *                         email: { type: string, example: 'jane@example.com' }
 *                         mobileNumber: { type: string, example: '+353871234567' }
 *                         role: { type: string, enum: ['CUSTOMER', 'TRADER'], example: 'CUSTOMER' }
 *                     accessToken: { type: string, example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
 *                     refreshToken: { type: string, example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
 *       401:
 *         description: Invalid email/password, or mobile number unverified.
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh User Session Token
 *     description: Issue a new user access token using a valid refresh token.
 *     tags: [Customer & Trader Auth]
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
 *                 description: Valid user refresh token.
 *     responses:
 *       200:
 *         description: Session token refreshed successfully.
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
 *                   example: Session token refreshed successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string, example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
 *       401:
 *         description: Invalid or expired refresh token.
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', validate(refreshSchema), authController.refresh);

export default router;
