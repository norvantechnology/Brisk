-- CreateTable
CREATE TABLE IF NOT EXISTS "cms_contact_settings" (
    "id" UUID NOT NULL,
    "general_inquiry_email" TEXT NOT NULL,
    "customer_support_phone" TEXT NOT NULL,
    "office_address" TEXT NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_contact_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "cms_contact_settings"
    ADD CONSTRAINT "cms_contact_settings_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "admin_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
