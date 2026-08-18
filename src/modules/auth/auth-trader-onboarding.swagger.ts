/**
 * Trader auth steps before onboarding — complements Mobile / Auth routes.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AppNextStep:
 *       type: string
 *       enum:
 *         - VERIFY_PHONE
 *         - TRADER_ONBOARDING
 *         - TRADER_PENDING_APPROVAL
 *         - TRADER_HOME
 *         - CUSTOMER_HOME
 *       description: |
 *         App navigation key returned by register, login, verify-otp, and onboarding status.
 *         Mobile app maps each value to a screen or flow — no API paths in this field.
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
 *       **Response `nextStep`:** Always `VERIFY_PHONE` after register.
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
 *       **Response includes:**
 *       - `accessToken`, `refreshToken` — store for authenticated calls
 *       - `nextStep` — for traders: `TRADER_ONBOARDING`; for customers: `CUSTOMER_HOME`
 *
 *       **No Verify Email step** in the current trader app — go straight to onboarding when `nextStep` is `TRADER_ONBOARDING`.
 *
 *       **Not for forgot-password** — use `POST /auth/verify-reset-otp` instead.
 *     tags: ['Mobile / Auth']
 */

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify trader email (deprecated — not used in current mobile app)
 *     tags: ['Mobile / Auth']
 *     description: |
 *       **Not used** in the current trader onboarding UI. Kept for backward compatibility only.
 *       Traders proceed to onboarding after mobile OTP without email verification.
 */

/**
 * @swagger
 * /auth/resend-email-otp:
 *   post:
 *     summary: Resend email verification code (deprecated — not used in current mobile app)
 *     tags: ['Mobile / Auth']
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     description: |
 *       **Figma screen:** **Welcome back** — Log in to your BRISK account.
 *
 *       **Response `nextStep` values:**
 *       - `VERIFY_PHONE` — mobile not verified yet (also when `requiresOtpVerification: true`)
 *       - `TRADER_ONBOARDING` — trader must complete onboarding
 *       - `TRADER_PENDING_APPROVAL` — onboarding submitted, awaiting admin review
 *       - `TRADER_HOME` — trader approved, go to main app
 *       - `CUSTOMER_HOME` — customer main app
 *
 *       **After login:** Use `nextStep` for routing. If `TRADER_ONBOARDING`, call `GET /traders/onboarding` to load saved form data and `onboardingScreen`.
 *     tags: ['Mobile / Auth']
 */

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     description: |
 *       **Figma screen:** **Forgot Password** — enter email, tap Get OTP.
 *     tags: ['Mobile / Auth']
 */
