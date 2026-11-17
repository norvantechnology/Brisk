-- Fix currency preferences for brisktrader and convert erroneously recorded GBP quotes to EUR
UPDATE "users"
SET "preferred_currency" = 'EUR', "country" = COALESCE("country", 'Ireland')
WHERE LOWER("email") = 'brisktrader@gmail.com';

UPDATE "traders"
SET "country" = COALESCE("country", 'Ireland'), "city" = COALESCE("city", 'Dublin')
WHERE "user_id" IN (
    SELECT "id" FROM "users" WHERE LOWER("email") = 'brisktrader@gmail.com'
);

-- Fix existing quotes that were saved as GBP back to EUR
UPDATE "quotes"
SET "currency_code" = 'EUR'
WHERE "currency_code" = 'GBP';

