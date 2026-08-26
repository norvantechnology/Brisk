-- AlterEnum
ALTER TYPE "CmsTestimonialPageType" ADD VALUE 'ABOUT_US';

-- AlterTable
ALTER TABLE "cms_faqs" ADD COLUMN "page_type" "CmsTestimonialPageType" NOT NULL DEFAULT 'CUSTOMER';

-- CreateIndex
CREATE INDEX "cms_faqs_page_type_idx" ON "cms_faqs"("page_type");
