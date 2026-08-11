-- Sub-category: site visit flag, price flags, Q&A form builder JSON
CREATE TYPE "SubcategoryPriceEnteredBy" AS ENUM ('CUSTOMER', 'TRADER');

ALTER TABLE "subcategories"
  ADD COLUMN IF NOT EXISTS "site_visit_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "price_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "price_entered_by" "SubcategoryPriceEnteredBy" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN IF NOT EXISTS "qa_form_schema" JSONB;

-- Jobs: store answers to subcategory Q&A form
ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "qa_form_answers" JSONB;
