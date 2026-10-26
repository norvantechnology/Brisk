-- AlterTable traders
ALTER TABLE "traders" ADD COLUMN IF NOT EXISTS "is_vat_registered" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "materials_total" DECIMAL(10,2) NOT NULL DEFAULT 0.0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "site_visit_fee" DECIMAL(10,2) NOT NULL DEFAULT 0.0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "trader_vat_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.135;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "trader_vat_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "platform_fee_vat" DECIMAL(10,2) NOT NULL DEFAULT 0.0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "two_thirds_rule_triggered" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable trader_payment_requests
ALTER TABLE "trader_payment_requests" ALTER COLUMN "vat_rate" SET DEFAULT 0.135;
ALTER TABLE "trader_payment_requests" ADD COLUMN IF NOT EXISTS "platform_fee_vat" DECIMAL(10,2) NOT NULL DEFAULT 0.0;
ALTER TABLE "trader_payment_requests" ADD COLUMN IF NOT EXISTS "two_thirds_rule_triggered" BOOLEAN NOT NULL DEFAULT false;
