-- Add KLARNA to PaymentMethod enum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'KLARNA';

-- Disable insurance and unnecessary document rules for onboarding
UPDATE "document_rules"
SET "required" = false, "status" = 'inactive'
WHERE "document_key" ILIKE '%insurance%';

UPDATE "document_rules"
SET "required" = false, "status" = 'inactive'
WHERE "document_key" ILIKE '%garda%';

-- Address proof is not required for Sole Traders
UPDATE "document_rules"
SET "required" = false
WHERE "trader_type" = 'SOLO' AND "document_key" ILIKE '%address%';

-- Ensure address proof is required for Companies
UPDATE "document_rules"
SET "required" = true, "status" = 'active'
WHERE "trader_type" = 'COMPANY' AND "document_key" = 'address_proof';

-- Seed remaining 3 Super Admin accounts: Samuel, Luke, Alex
INSERT INTO "admin_users" (
    "id",
    "full_name",
    "email",
    "mobile_number",
    "address",
    "password_hash",
    "role",
    "status",
    "joined_at",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    'Samuel',
    'samuel@brisk.ie',
    '+353870000002',
    'Dublin, Ireland',
    '$2b$10$aBFyoq0X3OZpVAAj49q5WOg/Xcc.QH96d4ZSN2cNB3KGMUygVTPDG',
    'SUPER_ADMIN'::"AdminRole",
    'ACTIVE'::"AdminStatus",
    NOW(),
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM "admin_users" WHERE "email" = 'samuel@brisk.ie'
);

INSERT INTO "admin_users" (
    "id",
    "full_name",
    "email",
    "mobile_number",
    "address",
    "password_hash",
    "role",
    "status",
    "joined_at",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    'Luke',
    'luke@brisk.ie',
    '+353870000003',
    'Dublin, Ireland',
    '$2b$10$aBFyoq0X3OZpVAAj49q5WOg/Xcc.QH96d4ZSN2cNB3KGMUygVTPDG',
    'SUPER_ADMIN'::"AdminRole",
    'ACTIVE'::"AdminStatus",
    NOW(),
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM "admin_users" WHERE "email" = 'luke@brisk.ie'
);

INSERT INTO "admin_users" (
    "id",
    "full_name",
    "email",
    "mobile_number",
    "address",
    "password_hash",
    "role",
    "status",
    "joined_at",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    'Alex',
    'alex@brisk.ie',
    '+353870000004',
    'Dublin, Ireland',
    '$2b$10$aBFyoq0X3OZpVAAj49q5WOg/Xcc.QH96d4ZSN2cNB3KGMUygVTPDG',
    'SUPER_ADMIN'::"AdminRole",
    'ACTIVE'::"AdminStatus",
    NOW(),
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM "admin_users" WHERE "email" = 'alex@brisk.ie'
);
