/**
 * Trader auth steps before onboarding — complements Mobile / Auth routes.
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     description: |
 *       **Figma screen (Trader):** **Sign-up** — Create your account.
 *
 *       **Trader vs Customer:** Send `role: "TRADER"`. Customer uses same endpoint with `role: "CUSTOMER"`.
 *
 *       **Trader-only:** Also sends email OTP; user must verify email after mobile OTP before onboarding.
 *
 *       **Fields on screen:**
 *       - Full Name → `fullName`
 *       - Email → `email`
 *       - Phone (+353) → `mobileNumber` (E.164, e.g. `+353871234567`)
 *       - Password → `password`
 *       - Terms checkbox → `acceptedTerms: true` (required)
 *       - Profile photo → `profilePhotoUrl` (optional URL after upload)
 *     tags: ['Mobile / Auth']
 */

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     description: |
 *       **Figma screen (Trader):** **Verify your number** — 6-digit SMS code.
 *
 *       **When to call:** After Sign-up, user enters 6-digit code from SMS.
 *
 *       **Trader response:** Includes `requiresEmailVerification: true` — navigate to Verify Email screen next.
 *
 *       **Not for forgot-password** — use `POST /auth/verify-reset-otp` instead.
 *     tags: ['Mobile / Auth']
 */

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify trader email — required before onboarding
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Figma screen (Trader):** **Verify your Email Address** — 6-digit code sent to email.
 *
 *       **Trader only.** Customers skip this step.
 *
 *       **When to call:** After mobile OTP verified. User enters 6-digit email code.
 *
 *       **Next screen:** Call `POST /traders/onboarding/start` (Trader / Onboarding tag).
 *
 *       **Test OTP (v1):** `123456`
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Same email used at registration.
 *               code:
 *                 type: string
 *                 pattern: '^\\d{6}$'
 *                 example: "123456"
 *                 description: 6-digit verification code from email.
 *     responses:
 *       200:
 *         description: Email verified; proceed to onboarding.
 *       400:
 *         description: Invalid or expired code.
 */

/**
 * @swagger
 * /auth/resend-email-otp:
 *   post:
 *     summary: Resend email verification code (trader)
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Figma screen (Trader):** **Verify Email** — "Resend code" link.
 *
 *       **Trader only.** 60 second cooldown between sends.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: New code sent.
 *       400:
 *         description: Email already verified.
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     description: |
 *       **Figma screen:** **Welcome back** — Log in to your BRISK account.
 *
 *       **Returning trader:** If onboarding incomplete, use `GET /traders/onboarding` after login to resume correct step.
 *     tags: ['Mobile / Auth']
 */

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     description: |
 *       **Figma screen:** **Forgot Password** — enter email, OTP sent to registered phone.
 *     tags: ['Mobile / Auth']
 */
