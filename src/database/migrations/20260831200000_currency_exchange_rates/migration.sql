-- Currencies catalog
CREATE TABLE IF NOT EXISTS "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimal_places" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- Platform base currency singleton
CREATE TABLE IF NOT EXISTS "platform_currency_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "base_currency" TEXT NOT NULL DEFAULT 'EUR',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "platform_currency_settings_pkey" PRIMARY KEY ("id")
);

-- Exchange rates (admin-managed, relative to base currency)
CREATE TABLE IF NOT EXISTS "exchange_rates" (
    "id" UUID NOT NULL,
    "from_currency" TEXT NOT NULL,
    "to_currency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exchange_rates_from_currency_to_currency_key"
  ON "exchange_rates"("from_currency", "to_currency");

ALTER TABLE "exchange_rates"
  ADD CONSTRAINT "exchange_rates_from_currency_fkey"
  FOREIGN KEY ("from_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exchange_rates"
  ADD CONSTRAINT "exchange_rates_to_currency_fkey"
  FOREIGN KEY ("to_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exchange_rates"
  ADD CONSTRAINT "exchange_rates_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- User preferred currency
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "preferred_currency" TEXT NOT NULL DEFAULT 'EUR';

-- Immutable currency on financial records (history preserved at original currency)
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'EUR';
