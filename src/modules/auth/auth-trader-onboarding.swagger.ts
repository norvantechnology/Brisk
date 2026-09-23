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
 *       **Mock codes (staging):** mobile `123456`, email `654321`.
 *
 *       **Response includes:**
 *       - `accessToken`, `refreshToken` - store for authenticated calls
 *       - `nextStep` - traders: `TRADER_ONBOARDING`; customers: `CUSTOMER_HOME`
 *
 *       Do **not** call separate `/auth/verify-email` for signup - email is verified here for traders.
 *
 *       **Not for forgot-password** - use `POST /auth/verify-reset-otp` instead.
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
 *       **Deprecated for signup.** Traders now verify email OTP on the same screen as mobile via
 *       `POST /auth/verify-otp` with `email` + `emailCode`. Kept for backward compatibility only.
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
 * /auth/forgot-password:
 *   post:
 *     description: |
 *       **Figma screen:** **Forgot Password** - enter email, tap Get OTP.
 *     tags: ['Mobile / Auth']
 */
