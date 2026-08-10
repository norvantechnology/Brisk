-- CreateEnum
CREATE TYPE "CmsAudience" AS ENUM ('BOTH', 'CUSTOMER', 'TRADER');

-- CreateEnum
CREATE TYPE "CmsPublishStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CmsActiveStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CmsKnowledgeBlockType" AS ENUM ('STEP_CARD', 'FEATURE_CARD', 'TEXT_BLOCK', 'CTA_BANNER');

-- CreateEnum
CREATE TYPE "SurveyRegistrationStatus" AS ENUM ('NEW', 'PENDING', 'REVIEWED', 'CONTACTED', 'REJECTED');

-- CreateTable
CREATE TABLE "cms_static_pages" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT,
    "target_audience" "CmsAudience" NOT NULL DEFAULT 'BOTH',
    "status" "CmsPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_static_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_social_links" (
    "id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "profile_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CmsActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_knowledge_guides" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "detailed_content" TEXT,
    "graphic_image_url" TEXT,
    "icon_name" TEXT,
    "cta_button_text" TEXT,
    "cta_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CmsPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "seo_title" TEXT,
    "seo_description" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_knowledge_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_knowledge_blocks" (
    "id" UUID NOT NULL,
    "guide_id" UUID NOT NULL,
    "block_type" "CmsKnowledgeBlockType" NOT NULL DEFAULT 'TEXT_BLOCK',
    "title" TEXT,
    "description" TEXT,
    "content" TEXT,
    "icon_name" TEXT,
    "image_url" TEXT,
    "button_text" TEXT,
    "button_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_knowledge_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_blog_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon_name" TEXT,
    "status" "CmsActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_blog_posts" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category_id" UUID,
    "cover_image_url" TEXT,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "author_name" TEXT,
    "author_role" TEXT,
    "reading_time" TEXT,
    "published_at" TIMESTAMP(3),
    "status" "CmsPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_by_id" UUID,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_faq_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_faq_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_faqs" (
    "id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category_id" UUID,
    "target_audience" "CmsAudience" NOT NULL DEFAULT 'BOTH',
    "status" "CmsPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_testimonials" (
    "id" UUID NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_role" TEXT,
    "company_name" TEXT,
    "badge_label" TEXT,
    "author_avatar_url" TEXT,
    "quote_text" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "target_audience" "CmsAudience" NOT NULL DEFAULT 'BOTH',
    "status" "CmsPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_legal_policies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_legal_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_legal_policy_versions" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "version_label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "status" "CmsPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "published_by_id" UUID,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_legal_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_seo_settings" (
    "id" UUID NOT NULL,
    "global_site_title" TEXT NOT NULL,
    "meta_description" TEXT NOT NULL,
    "meta_keywords" TEXT,
    "canonical_base_url" TEXT NOT NULL,
    "og_image_url" TEXT,
    "twitter_handle" TEXT,
    "ga_measurement_id" TEXT,
    "robots_txt" TEXT,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_seo_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_consumer_registrations" (
    "id" UUID NOT NULL,
    "registration_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "county" TEXT,
    "age_range" TEXT,
    "consent_launch_updates" BOOLEAN NOT NULL DEFAULT false,
    "consent_marketing" BOOLEAN NOT NULL DEFAULT false,
    "consent_partner_comm" BOOLEAN NOT NULL DEFAULT false,
    "agreement_accepted" BOOLEAN NOT NULL DEFAULT false,
    "status" "SurveyRegistrationStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_consumer_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_static_pages_slug_key" ON "cms_static_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cms_knowledge_guides_slug_key" ON "cms_knowledge_guides"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cms_blog_categories_slug_key" ON "cms_blog_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cms_blog_posts_slug_key" ON "cms_blog_posts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cms_faq_categories_slug_key" ON "cms_faq_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cms_legal_policies_slug_key" ON "cms_legal_policies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "survey_consumer_registrations_registration_code_key" ON "survey_consumer_registrations"("registration_code");

-- AddForeignKey
ALTER TABLE "cms_static_pages" ADD CONSTRAINT "cms_static_pages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_knowledge_blocks" ADD CONSTRAINT "cms_knowledge_blocks_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "cms_knowledge_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_blog_posts" ADD CONSTRAINT "cms_blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cms_blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_blog_posts" ADD CONSTRAINT "cms_blog_posts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_faqs" ADD CONSTRAINT "cms_faqs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cms_faq_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_legal_policy_versions" ADD CONSTRAINT "cms_legal_policy_versions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "cms_legal_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_legal_policy_versions" ADD CONSTRAINT "cms_legal_policy_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_seo_settings" ADD CONSTRAINT "cms_seo_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_consumer_registrations" ADD CONSTRAINT "survey_consumer_registrations_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
