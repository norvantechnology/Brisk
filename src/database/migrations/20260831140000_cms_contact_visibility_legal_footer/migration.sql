-- Contact settings visibility toggles
ALTER TABLE "cms_contact_settings"
  ADD COLUMN IF NOT EXISTS "show_general_inquiry_email" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "show_customer_support_phone" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "show_office_address" BOOLEAN NOT NULL DEFAULT true;

-- Legal policy footer visibility
ALTER TABLE "cms_legal_policies"
  ADD COLUMN IF NOT EXISTS "show_in_footer" BOOLEAN NOT NULL DEFAULT true;
