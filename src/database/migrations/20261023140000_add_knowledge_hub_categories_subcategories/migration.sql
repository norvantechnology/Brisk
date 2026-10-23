-- AlterTable
ALTER TABLE "cms_knowledge_guides" ADD COLUMN "category_id" UUID,
ADD COLUMN "subcategory_id" UUID;

-- CreateTable
CREATE TABLE "cms_knowledge_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon_name" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CmsActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_knowledge_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_knowledge_subcategories" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon_name" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CmsActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_knowledge_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_knowledge_categories_slug_key" ON "cms_knowledge_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cms_knowledge_subcategories_slug_key" ON "cms_knowledge_subcategories"("slug");

-- AddForeignKey
ALTER TABLE "cms_knowledge_subcategories" ADD CONSTRAINT "cms_knowledge_subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cms_knowledge_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_knowledge_guides" ADD CONSTRAINT "cms_knowledge_guides_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cms_knowledge_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_knowledge_guides" ADD CONSTRAINT "cms_knowledge_guides_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "cms_knowledge_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
