-- Seed Admin user for Manmeet (manmeet@brisk.ie)
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
    'Manmeet',
    'manmeet@brisk.ie',
    '+353870000001',
    'Dublin, Ireland',
    '$2b$10$aBFyoq0X3OZpVAAj49q5WOg/Xcc.QH96d4ZSN2cNB3KGMUygVTPDG',
    'SUPER_ADMIN'::"AdminRole",
    'ACTIVE'::"AdminStatus",
    NOW(),
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM "admin_users" WHERE "email" = 'manmeet@brisk.ie'
);
