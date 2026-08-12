-- CreateEnum
CREATE TYPE "CmsTestimonialPageType" AS ENUM ('CUSTOMER', 'TRADER', 'HOME');

-- AlterTable: testimonials — decimal rating + page type + verified flag
ALTER TABLE "cms_testimonials"
  ALTER COLUMN "rating" TYPE DOUBLE PRECISION USING "rating"::double precision,
  ADD COLUMN IF NOT EXISTS "page_type" "CmsTestimonialPageType" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "cms_marketing_pages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CmsPublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_marketing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page_sections" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "section_type" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "description" TEXT,
    "primary_button_text" TEXT,
    "primary_button_url" TEXT,
    "secondary_button_text" TEXT,
    "secondary_button_url" TEXT,
    "background_image" TEXT,
    "background_video" TEXT,
    "app_store_url" TEXT,
    "google_play_url" TEXT,
    "status" "CmsPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_page_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page_section_items" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "image" TEXT,
    "step_number" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CmsPublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_page_section_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_marketing_pages_slug_key" ON "cms_marketing_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cms_page_sections_page_id_section_key_key" ON "cms_page_sections"("page_id", "section_key");

-- AddForeignKey
ALTER TABLE "cms_page_sections" ADD CONSTRAINT "cms_page_sections_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "cms_marketing_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_section_items" ADD CONSTRAINT "cms_page_section_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "cms_page_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
