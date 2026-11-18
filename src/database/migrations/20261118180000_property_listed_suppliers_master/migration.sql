-- CreateTable property_supplier_categories
CREATE TABLE IF NOT EXISTS "property_supplier_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_supplier_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable property_suppliers
CREATE TABLE IF NOT EXISTS "property_suppliers" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "trading_name" TEXT,
    "logo_url" TEXT,
    "icon_url" TEXT,
    "website_url" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "description" TEXT,
    "typical_service" TEXT,
    "coverage_summary" TEXT,
    "provides_electricity" BOOLEAN NOT NULL DEFAULT false,
    "provides_gas" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable property_supplier_county_coverages
CREATE TABLE IF NOT EXISTS "property_supplier_county_coverages" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "county" TEXT NOT NULL,
    "is_domestic_collector" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_supplier_county_coverages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "property_supplier_categories_slug_key" ON "property_supplier_categories"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "property_supplier_categories_code_key" ON "property_supplier_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "property_suppliers_slug_key" ON "property_suppliers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "property_supplier_county_coverages_supplier_id_county_key" ON "property_supplier_county_coverages"("supplier_id", "county");
CREATE INDEX IF NOT EXISTS "property_supplier_county_coverages_county_idx" ON "property_supplier_county_coverages"("county");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'property_suppliers_category_id_fkey'
    ) THEN
        ALTER TABLE "property_suppliers" ADD CONSTRAINT "property_suppliers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "property_supplier_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'property_suppliers_parent_id_fkey'
    ) THEN
        ALTER TABLE "property_suppliers" ADD CONSTRAINT "property_suppliers_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "property_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'property_supplier_county_coverages_supplier_id_fkey'
    ) THEN
        ALTER TABLE "property_supplier_county_coverages" ADD CONSTRAINT "property_supplier_county_coverages_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "property_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
