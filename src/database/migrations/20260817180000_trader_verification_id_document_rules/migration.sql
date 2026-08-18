-- ID documents for Sole/Company Verification screens (Figma trader onboarding)
INSERT INTO "document_rules" (
  "id",
  "scope",
  "trader_type",
  "category_id",
  "document_key",
  "name",
  "required",
  "accepted_formats",
  "sort_order",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  'ENTITY'::"DocumentRuleScope",
  'SOLO'::"TraderType",
  NULL,
  'driving_license',
  'Driving License',
  true,
  'pdf,image',
  0,
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "document_rules"
  WHERE "scope" = 'ENTITY' AND "trader_type" = 'SOLO' AND "document_key" = 'driving_license'
);

INSERT INTO "document_rules" (
  "id",
  "scope",
  "trader_type",
  "category_id",
  "document_key",
  "name",
  "required",
  "accepted_formats",
  "sort_order",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  'ENTITY'::"DocumentRuleScope",
  'COMPANY'::"TraderType",
  NULL,
  'director_photo_id',
  'Director Photo ID',
  true,
  'pdf,image',
  0,
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "document_rules"
  WHERE "scope" = 'ENTITY' AND "trader_type" = 'COMPANY' AND "document_key" = 'director_photo_id'
);
