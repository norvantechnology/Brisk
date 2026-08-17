/**
 * Trader onboarding Swagger — see onboarding.routes.ts for route handlers.
 *
 * Figma flow order (Trader app):
 * Sign-up → Verify Phone → Verify Email → Business Type → Entity Documents →
 * Select Categories → Category Documents → Personal/Company Info → Bank Info → Service Radius → Submit
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     OnboardingStatusResponse:
 *       type: object
 *       description: Returned by most onboarding endpoints after save/start/status.
 *       properties:
 *         registrationStatus:
 *           type: string
 *           enum: [in_progress, submitted, approved, rejected]
 *         onboardingStatus:
 *           type: string
 *           enum: [NOT_STARTED, IN_PROGRESS, SUBMITTED, APPROVED, REJECTED]
 *         verificationStatus:
 *           type: string
 *           enum: [PENDING, VERIFIED, REJECTED, SUSPENDED]
 *         entityType:
 *           type: string
 *           enum: [SOLO, COMPANY]
 *         currentStep:
 *           type: integer
 *           example: 3
 *           description: Current wizard step (1–7).
 *         totalSteps:
 *           type: integer
 *           example: 7
 *         currentStepKey:
 *           type: string
 *           example: categories
 *         steps:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               step: { type: integer }
 *               key: { type: string }
 *               completed: { type: boolean }
 *               current: { type: boolean }
 *         selectedCategories:
 *           type: array
 *           description: Trade categories chosen on "Select Your Trade Skills" screen.
 *         uploadedDocuments:
 *           type: array
 *           description: Files already uploaded (match by documentRuleId).
 *         documentRequirements:
 *           type: object
 *           properties:
 *             entityRules:
 *               type: array
 *               description: General docs for SOLO or COMPANY (Passport, Garda Vetting, etc.).
 *             categoryRules:
 *               type: array
 *               description: Per-trade docs after categories selected (Electrician, Plumbing, etc.).
 *         profile:
 *           type: object
 *           description: Saved personal or company info from step 5.
 *         bankDetails:
 *           type: object
 *         serviceRadius:
 *           type: object
 */

/**
 * @swagger
 * /traders/onboarding:
 *   get:
 *     summary: Get onboarding status — resume wizard on any screen
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** Use on **every onboarding screen** when app opens or user returns later.
 *
 *       **Auth:** Bearer token from login/register. Role must be `TRADER`.
 *
 *       **When to call:**
 *       - After login — check if onboarding already started or submitted
 *       - On app resume — restore `currentStep`, uploaded docs, selected categories
 *       - After any PUT/POST step — alternative to using that response (optional refresh)
 *
 *       **No query parameters.**
 *
 *       **If not started:** `data.started = false` → call `POST /traders/onboarding/start`.
 *
 *       **Key response fields:**
 *       - `data.currentStep` / `data.currentStepKey` — which screen to show next
 *       - `data.documentRequirements` — which upload slots to render
 *       - `data.uploadedDocuments` — already filled slots (show filename + delete)
 *
 *       **Example:** `GET /traders/onboarding` with header `Authorization: Bearer {accessToken}`
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding state returned (started or not started).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/OnboardingStatusResponse'
 *                     - type: object
 *                       properties:
 *                         started: { type: boolean, example: false }
 *                         message: { type: string }
 *       401:
 *         description: Missing or expired Bearer token — user must login again.
 *       403:
 *         description: Not a trader account, or email not verified yet (`EMAIL_NOT_VERIFIED`).
 */

/**
 * @swagger
 * /traders/onboarding/start:
 *   post:
 *     summary: Start onboarding wizard (first time after email verified)
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** Call once when user enters onboarding flow after **Verify Email** screen.
 *
 *       **Prerequisites:** `POST /auth/verify-otp` (mobile) + `POST /auth/verify-email` (trader email).
 *
 *       **Auth:** Bearer token, role `TRADER`.
 *
 *       **When to call:** First tap into onboarding — before Business Verification screen.
 *
 *       **No request body.**
 *
 *       **Returns:** Full onboarding state starting at step 1 (`business_type`).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wizard initialized; `currentStep = 1`.
 *       403:
 *         description: Email not verified — complete Verify Email screen first.
 */

/**
 * @swagger
 * /traders/onboarding/business-type:
 *   put:
 *     summary: 'Step 1 — Business Verification (Sole Trader vs Company)'
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** **Business Verification** — "How do you operate?"
 *       - Sole Trader card → send `SOLO`
 *       - Company Trader card → send `COMPANY`
 *
 *       **When to call:** User taps **Save & Continue** on Business Verification screen.
 *
 *       **Effect:** Loads different document lists for step 2 (Sole Trader Document vs Company Trader Document).
 *       Changing type clears previously selected categories and uploaded docs.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entityType]
 *             properties:
 *               entityType:
 *                 type: string
 *                 enum: [SOLO, COMPANY]
 *                 description: |
 *                   `SOLO` = Sole Trader (individual).
 *                   `COMPANY` = Company Trader (registered business).
 *           example:
 *             entityType: SOLO
 *     responses:
 *       200:
 *         description: Business type saved; `documentRequirements.entityRules` updated for chosen type.
 *       400:
 *         description: Validation error.
 */

/**
 * @swagger
 * /traders/onboarding/document-requirements:
 *   get:
 *     summary: Get document checklist for current step (entity + category rules)
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screens:**
 *       - **Sole Trader Document** / **Company Trader Document** (step 2 — general docs)
 *       - **Category Wise Documents** (step 4 — after trade skills selected)
 *
 *       **When to call:**
 *       - On document upload screens to build the list (REQUIRED / OPTIONAL badges)
 *       - After `PUT /business-type` or `PUT /categories` to refresh rules
 *
 *       **No parameters.** Rules depend on saved `entityType` and `categoryIds`.
 *
 *       **Each rule object includes:** `id` (use as `documentRuleId` on upload), `name`, `documentKey`, `required`, `scope` (`ENTITY` or `CATEGORY`).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: |
 *           `data.entityRules[]` — Passport (SOLO), Garda Vetting (COMPANY), etc.
 *           `data.categoryRules[]` — Electrician/Plumbing certs (empty until categories saved).
 */

/**
 * @swagger
 * /traders/onboarding/documents:
 *   put:
 *     summary: Upload or replace one document (PDF/image URL)
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screens:** Any document row with "Tap to upload PDF or Image".
 *       - Sole/Company general documents (step 2)
 *       - Category-wise documents (step 4)
 *
 *       **When to call:** After user picks a file — upload file to your storage first, then send the **URL** here.
 *
 *       **Note:** S3 presign not available yet — mobile must upload elsewhere and pass `fileUrl`.
 *
 *       **Match upload to UI row:** Use `documentRuleId` from `GET /document-requirements` or `data.documentRequirements` in status response.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [documentRuleId, fileUrl]
 *             properties:
 *               documentRuleId:
 *                 type: string
 *                 format: uuid
 *                 description: Rule `id` from document requirements list.
 *               fileUrl:
 *                 type: string
 *                 format: uri
 *                 example: https://cdn.example.com/passport.pdf
 *                 description: Public URL of uploaded PDF or image.
 *               fileName:
 *                 type: string
 *                 example: passport.pdf
 *                 description: Display name on uploaded file chip (optional).
 *           example:
 *             documentRuleId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *             fileUrl: "https://cdn.example.com/passport.pdf"
 *             fileName: "passport.pdf"
 *     responses:
 *       200:
 *         description: Document saved; check `uploadedDocuments` in response.
 *       400:
 *         description: Invalid rule, wrong category, or wrong business type for this document.
 */

/**
 * @swagger
 * /traders/onboarding/documents/{documentRuleId}:
 *   delete:
 *     summary: Remove uploaded document (trash icon on file chip)
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** Document row showing uploaded file with delete/remove action.
 *
 *       **When to call:** User removes an uploaded file before submit.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentRuleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Same UUID used when uploading via `PUT /traders/onboarding/documents`.
 *     responses:
 *       200:
 *         description: Document removed from trader profile.
 */

/**
 * @swagger
 * /traders/onboarding/categories:
 *   put:
 *     summary: 'Step 3 — Select Your Trade Skills (multi-select categories)'
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** **Select Your Trade Skills** — grid of Plumbing, Electricians, Carpentry, etc.
 *
 *       **When to call:** User taps **Save & Continue** after selecting one or more trades.
 *
 *       **Load category list from:** `GET /categories` (public, no auth) — use `id` as `categoryIds[]`.
 *
 *       **Effect:** Enables step 4 category-wise document requirements for each selected trade.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryIds]
 *             properties:
 *               categoryIds:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: One or more category UUIDs from `GET /categories`.
 *           example:
 *             categoryIds:
 *               - "3f0f23dd-dfa2-4606-9eed-acdc22534f0f"
 *               - "88d95784-fc6f-41e0-84bb-8efcf46a0d8c"
 *     responses:
 *       200:
 *         description: Categories saved; `documentRequirements.categoryRules` populated.
 */

/**
 * @swagger
 * /traders/onboarding/personal-info:
 *   put:
 *     summary: 'Step 5 (Sole Trader) — Sole Trader Information'
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** **Sole Trader Information** — Personal Info + Business Address sections.
 *
 *       **Use only when:** `entityType = SOLO` (Sole Trader path).
 *
 *       **When to call:** User taps **Save & Continue** on Sole Trader Information screen.
 *
 *       **Field mapping:**
 *       - Full Legal Name → `fullLegalName`
 *       - PPS Number → `ppsNumber`
 *       - Professional Bio (max 300 chars) → `bio`
 *       - Work Experience → `yearsExperience`
 *       - Street / City / Postcode → address fields
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullLegalName, ppsNumber, yearsExperience, addressLine1, city, postcode]
 *             properties:
 *               fullLegalName:
 *                 type: string
 *                 example: Sarah Mur
 *                 description: As shown on ID.
 *               ppsNumber:
 *                 type: string
 *                 example: "1234567X"
 *                 description: Personal Public Service number (Ireland tax reporting).
 *               bio:
 *                 type: string
 *                 maxLength: 300
 *                 example: Experienced plumber serving Dublin.
 *               yearsExperience:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 80
 *                 example: 8
 *               addressLine1:
 *                 type: string
 *                 example: 45 Oak Road
 *               addressLine2:
 *                 type: string
 *                 example: Suite 2
 *               city:
 *                 type: string
 *                 example: Dublin
 *               postcode:
 *                 type: string
 *                 example: D04 K123
 *               country:
 *                 type: string
 *                 example: Ireland
 *                 default: Ireland
 *     responses:
 *       200:
 *         description: Personal info saved; advances to bank details step.
 *       400:
 *         description: Wrong entity type (COMPANY account) or validation error.
 */

/**
 * @swagger
 * /traders/onboarding/company-info:
 *   put:
 *     summary: 'Step 5 (Company Trader) — Company Information'
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** **Company Information** — Company Details + Director + Address.
 *
 *       **Use only when:** `entityType = COMPANY`.
 *
 *       **When to call:** User taps **Save & Continue** on Company Information screen.
 *
 *       **Field mapping:**
 *       - Company Name → `companyName`
 *       - Registration (CRO) 8-digit → `croNumber`
 *       - VAT Number → `vatNumber` (optional)
 *       - Director Full Legal Name → `directorFullName`
 *       - Professional Bio → `bio`
 *       - Company Experience → `yearsExperience`
 *       - Registered address → address fields
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyName, croNumber, directorFullName, yearsExperience, addressLine1, city, postcode]
 *             properties:
 *               companyName:
 *                 type: string
 *                 example: Metro Plumbing Ltd
 *               croNumber:
 *                 type: string
 *                 pattern: '^\\d{8}$'
 *                 example: "12345678"
 *                 description: 8-digit Companies Registration Office number.
 *               vatNumber:
 *                 type: string
 *                 example: IE1234567X
 *               directorFullName:
 *                 type: string
 *                 example: John Metro
 *               bio:
 *                 type: string
 *                 maxLength: 300
 *               yearsExperience:
 *                 type: integer
 *                 example: 10
 *               addressLine1:
 *                 type: string
 *                 example: 100 Business Park
 *               addressLine2:
 *                 type: string
 *               city:
 *                 type: string
 *                 example: Dublin
 *               postcode:
 *                 type: string
 *                 example: D02 AB12
 *               country:
 *                 type: string
 *                 example: Ireland
 *     responses:
 *       200:
 *         description: Company info saved.
 */

/**
 * @swagger
 * /traders/onboarding/bank-details:
 *   put:
 *     summary: 'Step 6 — Bank Information (add now or skip)'
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screens:**
 *       - **Bank Info Alert** modal — "Add Bank Details" or "Skip for now"
 *       - **Bank Information** form — holder name, bank name, account, IFSC
 *
 *       **When to call:**
 *       - User fills bank form → send all four bank fields
 *       - User taps **Skip for now** on modal → send `{ "skip": true }`
 *
 *       **Either** `skip: true` **or** all of: `bankHolderName`, `bankName`, `accountNumber`, `ifscCode`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required: [skip]
 *                 properties:
 *                   skip:
 *                     type: boolean
 *                     enum: [true]
 *                     description: User chose "Skip for now" on bank modal.
 *               - type: object
 *                 required: [bankHolderName, bankName, accountNumber, ifscCode]
 *                 properties:
 *                   bankHolderName:
 *                     type: string
 *                     example: Alex Smith
 *                   bankName:
 *                     type: string
 *                     example: Bank Of Ireland
 *                   accountNumber:
 *                     type: string
 *                     example: AC56823568235
 *                   ifscCode:
 *                     type: string
 *                     example: BOFIIE2D
 *           examples:
 *             skip:
 *               summary: Skip bank step
 *               value:
 *                 skip: true
 *             addBank:
 *               summary: Add bank details
 *               value:
 *                 bankHolderName: Alex Smith
 *                 bankName: Bank Of Ireland
 *                 accountNumber: AC56823568235
 *                 ifscCode: BOFIIE2D
 *     responses:
 *       200:
 *         description: Bank saved or skipped; advances to service radius step.
 */

/**
 * @swagger
 * /traders/onboarding/service-radius:
 *   put:
 *     summary: 'Step 7 — Service Radius (map + km slider)'
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** **Service Radius** — map with circle, radius km, centre location label.
 *
 *       **When to call:** User confirms service area before final submit.
 *
 *       **Map integration:** Pass map centre coordinates from picker; `serviceCenterLabel` is display text (e.g. "Dublin, Ireland").
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [serviceRadiusKm, serviceCenterLat, serviceCenterLng, serviceCenterLabel]
 *             properties:
 *               serviceRadiusKm:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 500
 *                 example: 50
 *                 description: Radius in kilometres (map circle size).
 *               serviceCenterLat:
 *                 type: number
 *                 format: double
 *                 example: 53.3498
 *                 description: Map centre latitude (-90 to 90).
 *               serviceCenterLng:
 *                 type: number
 *                 format: double
 *                 example: -6.2603
 *                 description: Map centre longitude (-180 to 180).
 *               serviceCenterLabel:
 *                 type: string
 *                 example: Dublin, Ireland
 *                 description: Human-readable location shown under map.
 *     responses:
 *       200:
 *         description: Service area saved.
 */

/**
 * @swagger
 * /traders/onboarding/save-progress:
 *   post:
 *     summary: Save Progress button — persist draft without submitting
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** **Save Progress** button on document verification screens.
 *
 *       **When to call:** User wants to exit and continue later without submitting for review.
 *
 *       **No request body.** Each step should already be saved via its PUT endpoint; this returns latest state.
 *
 *       **Note:** Call individual step PUTs as user completes each screen — this is a convenience refresh/exit action.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current onboarding snapshot (same shape as GET /traders/onboarding when started).
 */

/**
 * @swagger
 * /traders/onboarding/submit:
 *   post:
 *     summary: Submit for verification — final step
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** **Submit** button (Sole/Company document verification or Service Radius screen).
 *
 *       **When to call:** User completes all required steps and taps **Submit for verification**.
 *
 *       **No request body.** Server validates:
 *       - All required entity + category documents uploaded
 *       - Categories selected
 *       - Step 5 profile complete
 *       - Service radius set
 *       - Bank details added OR skipped
 *
 *       **After success:** `onboardingStatus = SUBMITTED`, `verificationStatus = PENDING` — show "awaiting admin review" UI.
 *
 *       **On failure:** `400` with message listing missing items (e.g. missing documents).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Application submitted for admin review.
 *       400:
 *         description: Validation failed — missing required docs, categories, profile, or service radius.
 *       403:
 *         description: Already submitted — cannot edit.
 */
