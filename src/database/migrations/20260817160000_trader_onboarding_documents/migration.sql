-- CreateEnum
CREATE TYPE "DocumentRuleScope" AS ENUM ('ENTITY', 'CATEGORY');
CREATE TYPE "TraderOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "TraderDocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterTable traders
ALTER TABLE "traders" ADD COLUMN "full_legal_name" TEXT;
ALTER TABLE "traders" ADD COLUMN "pps_number" TEXT;
ALTER TABLE "traders" ADD COLUMN "cro_number" TEXT;
ALTER TABLE "traders" ADD COLUMN "vat_number" TEXT;
ALTER TABLE "traders" ADD COLUMN "director_full_name" TEXT;
ALTER TABLE "traders" ADD COLUMN "address_line_1" TEXT;
ALTER TABLE "traders" ADD COLUMN "address_line_2" TEXT;
ALTER TABLE "traders" ADD COLUMN "city" TEXT;
ALTER TABLE "traders" ADD COLUMN "postcode" TEXT;
ALTER TABLE "traders" ADD COLUMN "country" TEXT DEFAULT 'Ireland';
ALTER TABLE "traders" ADD COLUMN "bank_holder_name" TEXT;
ALTER TABLE "traders" ADD COLUMN "bank_name" TEXT;
ALTER TABLE "traders" ADD COLUMN "account_number" TEXT;
ALTER TABLE "traders" ADD COLUMN "ifsc_code" TEXT;
ALTER TABLE "traders" ADD COLUMN "bank_details_skipped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "traders" ADD COLUMN "service_radius_km" INTEGER;
ALTER TABLE "traders" ADD COLUMN "service_center_lat" DECIMAL(10,7);
ALTER TABLE "traders" ADD COLUMN "service_center_lng" DECIMAL(10,7);
ALTER TABLE "traders" ADD COLUMN "service_center_label" TEXT;
ALTER TABLE "traders" ADD COLUMN "onboarding_status" "TraderOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "traders" ADD COLUMN "onboarding_submitted_at" TIMESTAMP(3);
ALTER TABLE "traders" ADD COLUMN "rejection_reason" TEXT;

-- CreateTable trader_registrations (if not exists from init - model was schema-only)
CREATE TABLE IF NOT EXISTS "trader_registrations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_type" "TraderType" NOT NULL DEFAULT 'SOLO',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "step_data" JSONB,
    "trader_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trader_registrations_pkey" PRIMARY KEY ("id")
);

-- If table already existed with old shape, migrate columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trader_registrations' AND column_name = 'user_id') THEN
    ALTER TABLE "trader_registrations" ADD COLUMN "user_id" UUID;
  END IF;
END $$;

-- CreateTable trader_categories
CREATE TABLE "trader_categories" (
    "trader_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trader_categories_pkey" PRIMARY KEY ("trader_id","category_id")
);

-- CreateTable document_rules
CREATE TABLE "document_rules" (
    "id" UUID NOT NULL,
    "scope" "DocumentRuleScope" NOT NULL,
    "trader_type" "TraderType",
    "category_id" UUID,
    "document_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "accepted_formats" TEXT DEFAULT 'pdf,image',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable trader_documents
CREATE TABLE "trader_documents" (
    "id" UUID NOT NULL,
    "trader_id" UUID NOT NULL,
    "document_rule_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT,
    "status" "TraderDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trader_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "trader_registrations_user_id_key" ON "trader_registrations"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "document_rules_scope_trader_type_category_id_document_key_key" ON "document_rules"("scope", "trader_type", "category_id", "document_key");
CREATE UNIQUE INDEX IF NOT EXISTS "trader_documents_trader_id_document_rule_id_key" ON "trader_documents"("trader_id", "document_rule_id");

-- AddForeignKey
ALTER TABLE "trader_registrations" ADD CONSTRAINT "trader_registrations_trader_id_fkey" FOREIGN KEY ("trader_id") REFERENCES "traders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trader_categories" ADD CONSTRAINT "trader_categories_trader_id_fkey" FOREIGN KEY ("trader_id") REFERENCES "traders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trader_categories" ADD CONSTRAINT "trader_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_rules" ADD CONSTRAINT "document_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trader_documents" ADD CONSTRAINT "trader_documents_trader_id_fkey" FOREIGN KEY ("trader_id") REFERENCES "traders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trader_documents" ADD CONSTRAINT "trader_documents_document_rule_id_fkey" FOREIGN KEY ("document_rule_id") REFERENCES "document_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
