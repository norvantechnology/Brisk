-- Mutual reviews: trader → customer ratings + customer avg_rating

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avg_rating" DECIMAL(3,2) NOT NULL DEFAULT 0.0;

CREATE TABLE IF NOT EXISTS "trader_customer_reviews" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "trader_id" UUID NOT NULL,
    "stars" INTEGER NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "review" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trader_customer_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trader_customer_reviews_booking_id_key" ON "trader_customer_reviews"("booking_id");
CREATE INDEX IF NOT EXISTS "trader_customer_reviews_customer_id_idx" ON "trader_customer_reviews"("customer_id");
CREATE INDEX IF NOT EXISTS "trader_customer_reviews_trader_id_idx" ON "trader_customer_reviews"("trader_id");

DO $$ BEGIN
  ALTER TABLE "trader_customer_reviews"
    ADD CONSTRAINT "trader_customer_reviews_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trader_customer_reviews"
    ADD CONSTRAINT "trader_customer_reviews_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trader_customer_reviews"
    ADD CONSTRAINT "trader_customer_reviews_trader_id_fkey"
    FOREIGN KEY ("trader_id") REFERENCES "traders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
