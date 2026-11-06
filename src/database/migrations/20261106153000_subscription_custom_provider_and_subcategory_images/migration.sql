-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "custom_provider_name" TEXT;

-- AlterTable
ALTER TABLE "subcategories" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "subcategories" ADD COLUMN IF NOT EXISTS "banner_image_url" TEXT;
ALTER TABLE "subcategories" ADD COLUMN IF NOT EXISTS "icon_url" TEXT;
