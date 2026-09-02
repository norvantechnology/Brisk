/**
 * Trader onboarding Swagger — see onboarding.routes.ts for route handlers.
 *
 * Figma flow (Trader app — branches after Business Verification):
 * Sign-up → Verify Phone → Start onboarding →
 * Business Verification → Sole/Company Verification → Sole/Company Document Verification → Submit
 *
 * Navigation: use `nextStep` from login/verify-otp to choose the app flow.
 * When `nextStep` is `TRADER_ONBOARDING`, call GET /traders/onboarding for saved data and `onboardingScreen`.
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
 *           example: sole_trader_verification
 *         nextStep:
 *           type: string
 *           enum: [TRADER_ONBOARDING, TRADER_PENDING_APPROVAL, TRADER_HOME]
 *           description: App-level navigation key (same values as login response).
 *         onboardingScreen:
 *           type: string
 *           enum:
 *             - business_verification
 *             - sole_trader_verification
 *             - company_verification
 *             - sole_trader_document_verification
 *             - company_document_verification
 *             - service_radius
 *             - submitted
 *             - approved
 *           description: |
 *             Which screen to show inside the trader onboarding flow.
 *             After required documents are uploaded, this becomes `service_radius`.
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
 *         documentRequirements:
 *           type: object
 *           properties:
 *             entityRules:
 *               type: array
 *               description: |
 *                 Entity docs for current trader type. Each item includes upload state:
 *                 - `uploadStatus`: `UPLOADED` | `NOT_UPLOADED`
 *                 - `uploadedDocument`: null or `{ id, fileUrl, fileName, status, uploadedAt }`
 *                   where `status` is admin review (`PENDING` / `APPROVED` / `REJECTED` / `EXPIRED`).
 *             categoryRules:
 *               type: array
 *               description: |
 *                 **Category Wise Documents screen** — one object per selected trade category.
 *                 Each group has `title`, `subtitle`, and `documents[]` (REQUIRED/OPTIONAL rows with upload state).
 *               items:
 *                 type: object
 *                 properties:
 *                   categoryId: { type: string, format: uuid }
 *                   categoryName: { type: string, example: 'Electrical & Wiring' }
 *                   categoryCode: { type: string, example: 'CAT-ELECT' }
 *                   title: { type: string, example: 'Electrical & Wiring Category' }
 *                   subtitle: { type: string, example: 'Upload the required documents for your Electrical & Wiring category.' }
 *                   documents:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id: { type: string, format: uuid }
 *                         documentKey: { type: string }
 *                         name: { type: string, example: 'Insurance' }
 *                         required: { type: boolean, example: true }
 *                         uploadStatus: { type: string, enum: [UPLOADED, NOT_UPLOADED] }
 *                         uploadedDocument: { type: object, nullable: true }
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
 *     summary: Get onboarding status — load saved data and resume screen
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Purpose:** Load full onboarding state when user enters the `TRADER_ONBOARDING` flow.
 *
 *       **When to call:**
 *       - After login when `nextStep` is `TRADER_ONBOARDING` — to know which onboarding screen to open and pre-fill forms
 *       - On app resume — restore uploaded docs, saved profile, document checklist
 *       - After any PUT/POST step — optional refresh
 *
 *       **Do not use for routing after login alone** — login already returns `nextStep`.
 *       Use this API only after deciding the user should enter onboarding.
 *
 *       **Auth:** Bearer token from login/register. Role must be `TRADER`.
 *
 *       **Key response fields:**
 *       - `data.nextStep` — same key as login (`TRADER_ONBOARDING`, `TRADER_PENDING_APPROVAL`, `TRADER_HOME`)
 *       - `data.onboardingScreen` — which screen inside onboarding (Business Verification, Sole Trader Verification, etc.)
 *       - `data.documentRequirements.entityRules` — entity docs with upload state
 *       - `data.documentRequirements.categoryRules` — **grouped by category** for Category Wise Documents UI:
 *         `[{ categoryId, categoryName, title, subtitle, documents: [{ name, required, uploadStatus, uploadedDocument }] }]`
 *       - `data.profile` / `data.bankDetails` — pre-filled form values
 *
 *       **If not started:** `data.started = false`, `onboardingScreen = business_verification` → call `POST /traders/onboarding/start` on first entry.
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
 *         description: Not a trader account.
 */

/**
 * @swagger
 * /traders/onboarding/start:
 *   post:
 *     summary: Start onboarding wizard (first time after phone verified)
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **When to call:** First time user enters onboarding after `nextStep` is `TRADER_ONBOARDING` and `started` is false.
 *
 *       **Prerequisites:** `POST /auth/verify-otp` (mobile verified).
 *
 *       **Auth:** Bearer token, role `TRADER`.
 *
 *       **No request body.**
 *
 *       **Returns:** Full onboarding state starting at Business Verification (`onboardingScreen: business_verification`).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wizard initialized.
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
 *       **When to call:** User taps **Submit** on Business Verification screen (Sole Trader or Company Trader card).
 *
 *       **Do not** call `POST /submit` here — that is only for final document verification submit.
 *
 *       **Effect:** Sets branch for Sole Trader vs Company Trader paths. Clears categories and uploads if type changes.
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
 *       **Category Wise Documents screen:** use `data.categoryRules` — **array of category groups**, not a flat list:
 *       ```
 *       categoryRules: [{
 *         categoryId, categoryName, categoryCode,
 *         title: "Electrical & Wiring Category",
 *         subtitle: "Upload the required documents for your Electrical & Wiring category.",
 *         documents: [{ id, name, required, uploadStatus, uploadedDocument, ... }]
 *       }]
 *       ```
 *
 *       **When to call:**
 *       - On document upload screens to build the list (REQUIRED / OPTIONAL badges)
 *       - After `PUT /business-type` or `PUT /categories` to refresh rules
 *
 *       **No parameters.** Rules depend on saved `entityType` and `categoryIds`.
 *
 *       **Upload:** use each document's `id` as `documentRuleId` on `PUT /traders/onboarding/documents`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: |
 *           `data.entityRules[]` / `data.categoryRules[]` — each row is requirement + upload state. */

/**
 * @swagger
 * /traders/onboarding/documents:
 *   put:
 *     summary: Upload or replace one document (PDF/image URL)
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screens:**
 *       - **Sole Trader Verification** — Driving License upload (`documentKey: driving_license`)
 *       - **Company Verification** — Director Photo ID upload (`documentKey: director_photo_id`)
 *       - **Sole/Company Document Verification** — Passport, Garda Vetting, certificates, etc.
 *
 *       **When to call:** After user picks a file — upload via `POST /uploads` first, then send the returned **`url`** here.
 *
 *       **Upload purpose (required):** Always use `purpose: trader_document` for **all** onboarding documents
 *       (entity-level, category-wise, passport, license, etc.). Do **not** use `category_banner` — that is
 *       admin-only for CMS category images.
 *
 *       **Flow:**
 *       1. `POST /uploads` — multipart: `file` + `purpose=trader_document` (Bearer trader token)
 *       2. `PUT /traders/onboarding/documents` — JSON: `{ documentRuleId, fileUrl: <url from step 1>, fileName? }`
 *
 *       **Allowed trader upload purposes:** `GET /uploads/purposes` (includes `trader_document`).
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
 *     summary: 'Optional — Select Your Trade Skills (multi-select categories)'
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** **Select Your Trade Skills** — not in current trader onboarding UI batch.
 *
 *       **Optional.** When categories are selected, category-wise documents become required on submit.
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
 *     summary: 'Step 5 (Sole Trader) — Sole Trader Verification'
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** **Sole Trader Verification** — Personal Info + Business Address + Bank Details + Driving License.
 *
 *       **Use only when:** `entityType = SOLO` (Sole Trader path).
 *
 *       **One screen = multiple API calls on Save & Continue:**
 *       1. `PUT /personal-info` — text fields below
 *       2. `PUT /bank-details` — bank fields from same screen
 *       3. `PUT /documents` — Driving License file (`documentKey: driving_license`)
 *
 *       **Field mapping (personal-info):**
 *       - Full Legal Name → `fullLegalName`
 *       - PPS Number → `ppsNumber`
 *       - Street / City / Postcode → address fields
 *       - Professional Bio / Work Experience → optional (`bio`, `yearsExperience`)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullLegalName, ppsNumber, addressLine1, city, postcode]
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
 *                 description: Optional on verification screen; defaults to 0 if omitted.
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
 *     summary: 'Step 5 (Company Trader) — Company Verification'
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** **Company Verification** — Company Details + Director + Address + Bank + Photo ID.
 *
 *       **Use only when:** `entityType = COMPANY`.
 *
 *       **One screen = multiple API calls on Save & Continue:**
 *       1. `PUT /company-info` — text fields below
 *       2. `PUT /bank-details` — bank fields from same screen
 *       3. `PUT /documents` — Director Photo ID (`documentKey: director_photo_id`)
 *
 *       **Field mapping (company-info):**
 *       - Company Name → `companyName`
 *       - Registration (CRO) 8-digit → `croNumber`
 *       - VAT Number → `vatNumber` (optional)
 *       - Director Full Legal Name → `directorFullName`
 *       - Registered address → address fields
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyName, croNumber, directorFullName, addressLine1, city, postcode]
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
 *       - **Sole Trader Verification** / **Company Verification** — bank section on same screen as profile
 *       - Optional **Bank Info Alert** modal in other builds — "Add Bank Details" or "Skip for now"
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
 *     summary: 'Optional — Service Radius (map + km slider)'
 *     tags: ['Trader / Onboarding']
 *     description: |
 *       **Figma screen:** **Service Radius** — not in current trader onboarding UI batch; optional for later.
 *
 *       **Not required for submit** in the current flow. Can be set after approval or in a future release.
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
 *       **Figma screen:** **Submit** button on **Sole Trader Document Verification** or **Company Document Verification**.
 *
 *       **When to call:** User completes required documents and taps **Submit**.
 *
 *       **No request body.** Server validates:
 *       - All required entity documents uploaded (including Driving License / Director Photo ID from verification screen)
 *       - Category documents — only if trade categories were selected (optional step)
 *       - Profile + address complete for chosen entity type
 *       - Bank details added OR skipped
 *
 *       **Not required for current UI:** trade categories, service radius.
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
 *         description: Validation failed — missing required docs, profile, or bank details.
 *       403:
 *         description: Already submitted — cannot edit.
 */
