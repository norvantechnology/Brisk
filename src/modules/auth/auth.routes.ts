import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { registerUploadMiddleware } from './register-upload.middleware';
import {
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendEmailOtpSchema,
} from './auth.validation';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register Customer or Trader and send OTP (traders get mobile + email OTP)
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Customer:** mobile OTP only. `nextStep` = `VERIFY_PHONE`.
 *       **Trader:** mobile + email OTP. `nextStep` = `VERIFY_OTP`, `requiresEmailVerification` = true.
 *       Mock mobile OTP: `123456`. Email OTP: dynamic 6-digit code sent to the trader's inbox (not a fixed code).
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
 *               country:
 *                 type: string
 *                 example: Ireland
 *                 description: Country selected during sign-up. Saved on user profile and returned in auth/profile responses.
 *               profilePhotoUrl:
 *                 type: string
 *                 format: uri
 *                 description: Optional profile photo URL (if not sending file).
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [fullName, email, mobileNumber, password, role, acceptedTerms]
 *             properties:
 *               fullName: { type: string }
 *               email: { type: string, format: email }
 *               mobileNumber: { type: string, example: "+353871234567" }
 *               password: { type: string }
 *               role: { type: string, enum: [CUSTOMER, TRADER] }
 *               acceptedTerms: { type: boolean, example: true }
 *               country: { type: string, example: Ireland }
 *               profilePhotoUrl: { type: string, format: uri, description: Optional URL instead of file. }
 *               profilePhoto:
 *                 type: string
 *                 format: binary
 *                 description: Optional profile image file — field name `profilePhoto` or `profilePhotoUrl`.
 *     responses:
 *       201:
 *         description: |
 *           Registered. OTP sent.
 *           Customer `nextStep`=`VERIFY_PHONE`. Trader `nextStep`=`VERIFY_OTP` + `requiresEmailVerification`=true.
 *       400:
 *         description: Validation error.
 *       409:
 *         description: Email or mobile number already exists.
 *       429:
 *         description: OTP resend cooldown active.
 */
router.post(
  '/register',
  registerUploadMiddleware,
  validate(registerSchema),
  authController.register
);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify signup OTP (mobile + email for traders on the same screen)
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Customers:** send `mobileNumber` + `mobileCode` (or legacy `code`).
 *       **Traders:** send `mobileNumber` + `mobileCode` + `email` + `emailCode` on the same screen.
 *       Mock mobile OTP: `123456`. Email OTP: use the dynamic code from the verification email (static `654321` is rejected).
 *       For forgot-password use **POST /auth/forgot-password** then **POST /auth/reset-password**
 *       (not this endpoint).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobileNumber]
 *             properties:
 *               mobileNumber: { type: string, example: "+353871234567" }
 *               mobileCode: { type: string, example: "123456" }
 *               code: { type: string, example: "123456", description: Legacy alias for mobileCode }
 *               email: { type: string, example: "trader@example.com" }
 *               emailCode: { type: string, example: "482913", description: Dynamic 6-digit code from the verification email }
 *     responses:
 *       200:
 *         description: Verified. Returns user profile plus access and refresh tokens.
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
 *     summary: Resend signup OTP (mobile and/or email)
 *     tags: ['Mobile / Auth']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mobileNumber: { type: string, example: "+353871234567" }
 *               email: { type: string, example: "trader@example.com" }
 *               channel: { type: string, enum: [mobile, email, both], default: both }
 *     responses:
 *       200:
 *         description: OTP resent
 *       429:
 *         description: Resend cooldown active
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
 *           2) Mobile not verified — **data.requiresOtpVerification=true** with mobileNumber for OTP screen (HTTP 200, not an error).
 *       401:
 *         description: Invalid email or password.
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Forgot password screen 1 - send same OTP to email and/or mobile
 *     tags: ['Mobile / Auth']
 *     description: |
 *       Send **email** OR **mobileNumber** (at least one).
 *
 *       **TRADER:** one shared OTP for email + mobile (emailed; mobile SMS mock / test `123456`).
 *       **CUSTOMER:** OTP on mobile (and email channel when looked up by email).
 *
 *       Next: **POST /auth/reset-password** with
 *       `{ email|mobileNumber, code, newPassword, confirmPassword }`.
 *
 *       Full examples and response schema: see also Mobile / Auth forgot-password in trader onboarding swagger.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *           examples:
 *             byEmail:
 *               value: { email: trader@example.com }
 *             byMobile:
 *               value: { mobileNumber: "+353871234567" }
 *     responses:
 *       200:
 *         description: |
 *           OTP issued. `data` includes `otpSent`, `otpSentToEmail`, `otpSentToMobile`,
 *           `otpExpiresInMinutes`, `resendCooldownSeconds`.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/ForgotPasswordResponseData'
 *       403:
 *         description: Account blocked, suspended, or inactive.
 *       404:
 *         description: No account found for email/mobile.
 *       429:
 *         description: OTP resend cooldown (may also return 200 with otpSent=false).
 */
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

/**
 * @swagger
 * /auth/verify-reset-otp:
 *   post:
 *     summary: Optional - verify forgot-password OTP only (returns resetToken)
 *     tags: ['Mobile / Auth']
 *     description: |
 *       Optional middle step. Preferred trader flow skips this and calls **POST /auth/reset-password**
 *       with OTP + newPassword + confirmPassword in one request.
 *
 *       Body: **email** OR **mobileNumber** + **code** (shared OTP).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyResetOtpRequest'
 *           examples:
 *             byEmail:
 *               value: { email: trader@example.com, code: "123456" }
 *             byMobile:
 *               value: { mobileNumber: "+353871234567", code: "123456" }
 *     responses:
 *       200:
 *         description: OTP OK. Returns resetToken (15 min) for reset-password.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Verification code confirmed. You can now set a new password.
 *               data:
 *                 resetToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 resetTokenExpiresInMinutes: 15
 *                 userId: 2380d295-fef3-4365-bb81-1ecfb9b3ec8c
 *                 email: trader@example.com
 *                 mobileNumber: "+353871234567"
 *                 role: TRADER
 *       400:
 *         description: Invalid or expired OTP.
 *       404:
 *         description: User not found.
 */
router.post('/verify-reset-otp', validate(verifyResetOtpSchema), authController.verifyResetOtp);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Forgot password screen 2 - OTP + new password + confirm password
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Preferred trader flow (2 screens):**
 *       1. POST /auth/forgot-password `{ email }` or `{ mobileNumber }`
 *       2. POST /auth/reset-password `{ email|mobileNumber, code, newPassword, confirmPassword }`
 *
 *       `newPassword` and `confirmPassword` must match.
 *       Same OTP works on email or mobile channel.
 *
 *       Also accepts `{ resetToken, newPassword, confirmPassword }` after verify-reset-otp.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *           examples:
 *             traderNextScreen:
 *               summary: Preferred - OTP + passwords
 *               value:
 *                 email: trader@example.com
 *                 code: "123456"
 *                 newPassword: NewPassword1!
 *                 confirmPassword: NewPassword1!
 *             withResetToken:
 *               summary: After optional verify-reset-otp
 *               value:
 *                 resetToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 newPassword: NewPassword1!
 *                 confirmPassword: NewPassword1!
 *     responses:
 *       200:
 *         description: Password updated (session returned when mobile already verified).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Password reset successfully. You are now logged in.
 *               data:
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user: { id: "2380d295-fef3-4365-bb81-1ecfb9b3ec8c", role: TRADER }
 *                 nextStep: TRADER_HOME
 *       400:
 *         description: Invalid OTP or passwords do not match.
 *       401:
 *         description: Invalid or expired resetToken.
 *       404:
 *         description: User not found.
 */
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify trader email with dynamic OTP (prefer POST /auth/verify-otp)
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Deprecated for signup.** Prefer `POST /auth/verify-otp` with `email` + `emailCode` together with mobile.
 *       Email OTP is a **dynamic** 6-digit code from the inbox (not a fixed mock).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, format: email, example: trader@example.com }
 *               code: { type: string, example: "482913", description: Dynamic code from email inbox }
 *     responses:
 *       200:
 *         description: Email verified. Returns session if mobile already verified, else nextStep VERIFY_OTP.
 *       400:
 *         description: Invalid/expired code, or not a trader account.
 */
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);

/**
 * @swagger
 * /auth/resend-email-otp:
 *   post:
 *     summary: Resend trader email verification OTP (prefer POST /auth/resend-otp)
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Deprecated.** Prefer `POST /auth/resend-otp` with `channel: "email"` or `channel: "both"`.
 *       Sends a new dynamic email OTP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: trader@example.com }
 *     responses:
 *       200:
 *         description: Email OTP resent.
 *       429:
 *         description: Resend cooldown active.
 */
router.post('/resend-email-otp', validate(resendEmailOtpSchema), authController.resendEmailOtp);

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
 *         description: |
 *           Invalid, expired, or revoked token. After admin approves a trader,
 *           existing tokens return `data.code = SESSION_INVALIDATED` — send the user to login.
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
 *     description: |
 *       Returns `user` plus session navigation fields (same as login):
 *       - `nextStep` — e.g. `TRADER_PENDING_APPROVAL`, `TRADER_HOME`
 *       - `traderAccountActive` — `true` only when trader is fully verified
 *       - `onboarding` — snapshot when still in onboarding; otherwise `null`
 *
 *       Use these on page refresh to keep PENDING traders off Jobs/Offers/Dashboard.
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
