/**
 * Trader auth steps before onboarding - complements Mobile / Auth routes.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AppNextStep:
 *       type: string
 *       enum:
 *         - VERIFY_PHONE
 *         - VERIFY_OTP
 *         - TRADER_ONBOARDING
 *         - TRADER_PENDING_APPROVAL
 *         - TRADER_HOME
 *         - CUSTOMER_HOME
 *       description: |
 *         App navigation key returned by register, login, verify-otp, and onboarding status.
 *         Mobile app maps each value to a screen or flow - no API paths in this field.
 *
 *         - `VERIFY_PHONE` - customer (or mobile-only) OTP screen
 *         - `VERIFY_OTP` - trader dual OTP screen (mobile + email on the same screen)
 *         - `TRADER_ONBOARDING` - trader onboarding wizard
 *         - `TRADER_PENDING_APPROVAL` - docs submitted, waiting admin approval
 *         - `TRADER_HOME` - trader fully verified
 *         - `CUSTOMER_HOME` - customer main app
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     description: |
 *       **Figma screen (Trader):** **Sign-up** - Create your account.
 *
 *       **Trader vs Customer:** Send `role: "TRADER"`. Customer uses same endpoint with `role: "CUSTOMER"`.
 *
 *       **OTP behaviour:**
 *       - **Customer:** mobile OTP only. Response `nextStep` = `VERIFY_PHONE`.
 *       - **Trader:** mobile OTP + email OTP. Response `nextStep` = `VERIFY_OTP`,
 *         `requiresEmailVerification` = `true`.
 *
 *       **Fields on screen:**
 *       - Full Name -> `fullName`
 *       - Email -> `email`
 *       - Phone (+353) -> `mobileNumber` (E.164, e.g. `+353871234567`)
 *       - Password -> `password`
 *       - Terms checkbox -> `acceptedTerms: true` (required)
 *       - Country picker -> `country` (e.g. `Ireland`, `United Kingdom`) - saved on user profile
 *       - Profile photo at signup -> send `profilePhoto` file in **multipart/form-data** on this endpoint (no token). Or optional `profilePhotoUrl` if you already have a URL.
 *       - Profile photo after login -> `POST /uploads` then PATCH `/traders/me/account` with `profilePhotoUrl`.
 *     tags: ['Mobile / Auth']
 */

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     description: |
 *       **Same screen for traders:** verify **mobile + email** OTP together.
 *
 *       **Customers:** send `mobileNumber` + `mobileCode` (or legacy `code`).
 *       **Traders:** send `mobileNumber` + `mobileCode` + `email` + `emailCode` on the same API/screen.
 *
 *       **OTP:** mobile mock `123456`; email = dynamic code from inbox (not fixed).
 *
 *       **Response includes:**
 *       - `accessToken`, `refreshToken` - store for authenticated calls
 *       - `nextStep` - traders: `TRADER_ONBOARDING`; customers: `CUSTOMER_HOME`
 *
 *       Do **not** call separate `/auth/verify-email` for signup - email is verified here for traders.
 *
 *       **Not for forgot-password** - use `POST /auth/forgot-password` then `POST /auth/reset-password`.
 *     tags: ['Mobile / Auth']
 */

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     description: |
 *       Resend signup OTP.
 *
 *       **Traders:** can resend mobile and/or email via `channel`: `mobile` | `email` | `both` (default `both`).
 *       Provide `mobileNumber` and/or `email` matching the registered account.
 *
 *       **Customers:** mobile only (`mobileNumber`).
 *     tags: ['Mobile / Auth']
 */

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify trader email (deprecated - use POST /auth/verify-otp with emailCode)
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Deprecated for signup.** Prefer `POST /auth/verify-otp` with mobile + email codes together.
 *       Dynamic email OTP only (static codes rejected).
 *       If mobile is already verified → activates account + returns session (same as verify-otp).
 *       If mobile is still pending → marks email verified and returns `nextStep: VERIFY_OTP`.
 */

/**
 * @swagger
 * /auth/resend-email-otp:
 *   post:
 *     summary: Resend email verification code (deprecated - use POST /auth/resend-otp)
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Deprecated.** Prefer `POST /auth/resend-otp` with `channel: "email"` or `channel: "both"`.
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     description: |
 *       **Figma screen:** **Welcome back** - Log in to your BRISK account.
 *
 *       **Response `nextStep` values:**
 *       - `VERIFY_OTP` - trader email/mobile OTP still pending (same dual-OTP screen)
 *       - `VERIFY_PHONE` - mobile not verified yet (also when `requiresOtpVerification: true`)
 *       - `TRADER_ONBOARDING` - trader must complete onboarding
 *       - `TRADER_PENDING_APPROVAL` - onboarding submitted / documents not fully verified (`traderAccountActive: false`)
 *       - `TRADER_HOME` - trader `verificationStatus=VERIFIED` and onboarding approved (`traderAccountActive: true`)
 *       - `CUSTOMER_HOME` - customer main app
 *
 *       **After login:** Use `nextStep` + `traderAccountActive` for routing. Do **not** open Jobs/Offers/Dashboard
 *       until `nextStep` is `TRADER_HOME`. Pending traders may call `GET /traders/me` / onboarding only;
 *       `/traders/jobs/*` and `/traders/offers/*` return **403** `TRADER_NOT_VERIFIED`.
 *       If `TRADER_ONBOARDING`, call `GET /traders/onboarding` to load saved form data and `onboardingScreen`.
 *     tags: ['Mobile / Auth']
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ForgotPasswordRequest:
 *       type: object
 *       description: Provide **email** OR **mobileNumber** (at least one).
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: trader@example.com
 *         mobileNumber:
 *           type: string
 *           example: "+353871234567"
 *     ForgotPasswordResponseData:
 *       type: object
 *       properties:
 *         requiresPasswordReset: { type: boolean, example: true }
 *         userId: { type: string, format: uuid }
 *         email: { type: string, format: email }
 *         mobileNumber: { type: string, example: "+353871234567" }
 *         role: { type: string, enum: [CUSTOMER, TRADER] }
 *         otpSent: { type: boolean, example: true }
 *         otpSentToEmail: { type: boolean, example: true, description: True when password-reset email was attempted }
 *         otpSentToMobile: { type: boolean, example: true, description: True when OTP stored for mobile (SMS mock until provider wired) }
 *         otpExpiresInMinutes: { type: integer, example: 10 }
 *         resendCooldownSeconds: { type: integer, example: 60 }
 *         retryAfterSeconds: { type: integer, description: Present when otpSent is false due to cooldown }
 *     ResetPasswordRequest:
 *       type: object
 *       required: [newPassword, confirmPassword]
 *       description: |
 *         Preferred: email|mobileNumber + code + newPassword + confirmPassword.
 *         Legacy: resetToken + newPassword + confirmPassword.
 *       properties:
 *         email: { type: string, format: email }
 *         mobileNumber: { type: string, example: "+353871234567" }
 *         code: { type: string, example: "123456", description: Same OTP from email or mobile }
 *         newPassword: { type: string, example: NewPassword1! }
 *         confirmPassword: { type: string, example: NewPassword1! }
 *         resetToken: { type: string, description: From optional POST /auth/verify-reset-otp }
 *     VerifyResetOtpRequest:
 *       type: object
 *       required: [code]
 *       description: Optional middle step. Provide email OR mobileNumber + code.
 *       properties:
 *         email: { type: string, format: email }
 *         mobileNumber: { type: string, example: "+353871234567" }
 *         code: { type: string, example: "123456" }
 */

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Forgot password screen 1 - send same OTP to email and mobile
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Figma:** Forgot Password - enter email **or** mobile, tap Get OTP.
 *
 *       **Trader flow (2 screens):**
 *       1. This API - issues **one shared OTP** for email + mobile
 *       2. `POST /auth/reset-password` - submit OTP + newPassword + confirmPassword
 *
 *       **Channels:**
 *       - Email: branded password-reset email with the code
 *       - Mobile: OTP stored (SMS provider not wired; test with `123456` or the emailed code)
 *
 *       Lookup accepts **email** OR **mobileNumber**.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *           examples:
 *             byEmail:
 *               summary: Trader enters email
 *               value: { email: trader@example.com }
 *             byMobile:
 *               summary: Trader enters mobile
 *               value: { mobileNumber: "+353871234567" }
 *     responses:
 *       200:
 *         description: OTP issued. Open OTP + new password screen.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Verification code sent to your email and mobile. Enter the code with your new password.
 *               data:
 *                 requiresPasswordReset: true
 *                 userId: 2380d295-fef3-4365-bb81-1ecfb9b3ec8c
 *                 email: trader@example.com
 *                 mobileNumber: "+353871234567"
 *                 role: TRADER
 *                 otpSent: true
 *                 otpSentToEmail: true
 *                 otpSentToMobile: true
 *                 otpExpiresInMinutes: 10
 *                 resendCooldownSeconds: 60
 *       403:
 *         description: Account blocked, suspended, or inactive.
 *       404:
 *         description: No account found for email/mobile.
 *       429:
 *         description: Resend cooldown (may also return 200 with otpSent=false).
 */

/**
 * @swagger
 * /auth/verify-reset-otp:
 *   post:
 *     summary: Optional - verify forgot-password OTP only (returns resetToken)
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Optional.** Preferred trader UX skips this and calls `POST /auth/reset-password`
 *       with code + newPassword + confirmPassword in one step.
 *
 *       Body: **email** OR **mobileNumber** + **code** (same shared OTP).
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

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Forgot password screen 2 - OTP + new password + confirm password
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Figma:** Enter OTP, new password, confirm password.
 *
 *       **Preferred body:**
 *       `{ email|mobileNumber, code, newPassword, confirmPassword }`
 *
 *       - `newPassword` and `confirmPassword` must match
 *       - Same OTP works whether user received it by email or mobile
 *       - On success, returns login session if mobile is already verified
 *
 *       **Legacy:** `{ resetToken, newPassword, confirmPassword }` after verify-reset-otp.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *           examples:
 *             traderScreen2Email:
 *               summary: Preferred - email + OTP + passwords
 *               value:
 *                 email: trader@example.com
 *                 code: "123456"
 *                 newPassword: NewPassword1!
 *                 confirmPassword: NewPassword1!
 *             traderScreen2Mobile:
 *               summary: Preferred - mobile + OTP + passwords
 *               value:
 *                 mobileNumber: "+353871234567"
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
 *         description: Password updated. Session tokens returned when mobile already verified.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Password reset successfully. You are now logged in.
 *               data:
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   id: 2380d295-fef3-4365-bb81-1ecfb9b3ec8c
 *                   email: trader@example.com
 *                   role: TRADER
 *                 nextStep: TRADER_HOME
 *       400:
 *         description: Invalid OTP, passwords do not match, or validation error.
 *       401:
 *         description: Invalid or expired resetToken.
 *       404:
 *         description: User not found.
 */
