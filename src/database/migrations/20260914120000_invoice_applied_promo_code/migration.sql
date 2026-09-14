-- Persist which promo is applied so re-apply can be idempotent (no stacking).
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "applied_promo_code" TEXT;
