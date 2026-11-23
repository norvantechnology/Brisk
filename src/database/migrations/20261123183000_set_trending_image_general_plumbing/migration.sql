-- Set test trendingImageUrl and bannerImageUrl for subcategory General plumbing
UPDATE "subcategories"
SET "trending_image_url" = 'https://api.brisk.ie/uploads/files/category_banner/afea3952-2e23-4d03-ba6c-89f74ecadd62/1794916681514-47evd8nt.png',
    "banner_image_url" = COALESCE("banner_image_url", 'https://api.brisk.ie/uploads/files/category_banner/afea3952-2e23-4d03-ba6c-89f74ecadd62/1794916681514-47evd8nt.png')
WHERE "id" = '5970bb98-a91d-45e2-9752-fa732c12072d'
   OR LOWER("name") = 'general plumbing';
