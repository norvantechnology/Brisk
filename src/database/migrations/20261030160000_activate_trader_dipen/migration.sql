-- Activate trader account for dipen@gmail.com

-- Ensure trader profile exists if user exists but trader profile was not yet created
INSERT INTO "traders" (
    "id",
    "user_id",
    "verification_status",
    "onboarding_status",
    "status",
    "created_at",
    "updated_at"
)
SELECT 
    gen_random_uuid(),
    u."id",
    'VERIFIED'::"VerificationStatus",
    'APPROVED'::"TraderOnboardingStatus",
    'active',
    NOW(),
    NOW()
FROM "users" u
WHERE LOWER(u."email") = 'dipen@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM "traders" t WHERE t."user_id" = u."id");

-- Update user status and verification flags
UPDATE "users"
SET 
    "status" = 'ACTIVE'::"UserStatus",
    "email_verified" = true,
    "mobile_verified" = true
WHERE LOWER("email") = 'dipen@gmail.com';

-- Update trader profile to VERIFIED and APPROVED
UPDATE "traders"
SET 
    "verification_status" = 'VERIFIED'::"VerificationStatus",
    "onboarding_status" = 'APPROVED'::"TraderOnboardingStatus",
    "status" = 'active',
    "rejection_reason" = NULL
WHERE "user_id" IN (
    SELECT "id" FROM "users" WHERE LOWER("email") = 'dipen@gmail.com'
);

-- Update trader registration status to approved if exists
UPDATE "trader_registrations"
SET "status" = 'approved'
WHERE "user_id" IN (
    SELECT "id" FROM "users" WHERE LOWER("email") = 'dipen@gmail.com'
);

-- Approve all uploaded documents for this trader
UPDATE "trader_documents"
SET "status" = 'APPROVED'::"TraderDocumentStatus"
WHERE "trader_id" IN (
    SELECT t."id" FROM "traders" t
    JOIN "users" u ON u."id" = t."user_id"
    WHERE LOWER(u."email") = 'dipen@gmail.com'
);
