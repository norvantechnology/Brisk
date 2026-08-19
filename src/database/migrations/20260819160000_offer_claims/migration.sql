-- CreateEnum
CREATE TYPE "OfferClaimStatus" AS ENUM ('CLAIMED', 'USED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "OfferCtaAction" AS ENUM ('CLAIM', 'BOOK_INSPECTION');

-- AlterTable
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "cta_label" TEXT;
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "cta_action" "OfferCtaAction" NOT NULL DEFAULT 'CLAIM';

-- CreateTable
CREATE TABLE IF NOT EXISTS "offer_claims" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_id" UUID,
    "status" "OfferClaimStatus" NOT NULL DEFAULT 'CLAIMED',
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "offer_claims_offer_id_user_id_key" ON "offer_claims"("offer_id", "user_id");
CREATE INDEX IF NOT EXISTS "offer_claims_user_id_status_idx" ON "offer_claims"("user_id", "status");

ALTER TABLE "offer_claims" DROP CONSTRAINT IF EXISTS "offer_claims_offer_id_fkey";
ALTER TABLE "offer_claims" ADD CONSTRAINT "offer_claims_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "offer_claims" DROP CONSTRAINT IF EXISTS "offer_claims_user_id_fkey";
ALTER TABLE "offer_claims" ADD CONSTRAINT "offer_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
