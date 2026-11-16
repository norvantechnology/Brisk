-- Activate trader account for brisktrader@gmail.com

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
WHERE LOWER(u."email") = 'brisktrader@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM "traders" t WHERE t."user_id" = u."id");

-- Update user status and verification flags
UPDATE "users"
SET 
    "status" = 'ACTIVE'::"UserStatus",
    "email_verified" = true,
    "mobile_verified" = true
WHERE LOWER("email") = 'brisktrader@gmail.com';

-- Update trader profile to VERIFIED and APPROVED
UPDATE "traders"
SET 
    "verification_status" = 'VERIFIED'::"VerificationStatus",
    "onboarding_status" = 'APPROVED'::"TraderOnboardingStatus",
    "status" = 'active',
    "rejection_reason" = NULL
WHERE "user_id" IN (
    SELECT "id" FROM "users" WHERE LOWER("email") = 'brisktrader@gmail.com'
);

-- Update trader registration status to approved if exists
UPDATE "trader_registrations"
SET "status" = 'approved'
WHERE "user_id" IN (
    SELECT "id" FROM "users" WHERE LOWER("email") = 'brisktrader@gmail.com'
);

