-- Website branding assets on global SEO settings (logo / footer logo / favicon)
ALTER TABLE "cms_seo_settings" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
ALTER TABLE "cms_seo_settings" ADD COLUMN IF NOT EXISTS "footer_logo_url" TEXT;
ALTER TABLE "cms_seo_settings" ADD COLUMN IF NOT EXISTS "favicon_url" TEXT;
