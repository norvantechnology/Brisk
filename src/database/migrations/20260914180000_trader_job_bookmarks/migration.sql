-- Trader Discover: bookmark nearby jobs
CREATE TABLE IF NOT EXISTS "trader_job_bookmarks" (
    "id" UUID NOT NULL,
    "trader_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trader_job_bookmarks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trader_job_bookmarks_trader_id_job_id_key"
  ON "trader_job_bookmarks"("trader_id", "job_id");

CREATE INDEX IF NOT EXISTS "trader_job_bookmarks_trader_id_idx"
  ON "trader_job_bookmarks"("trader_id");

CREATE INDEX IF NOT EXISTS "jobs_status_category_id_idx"
  ON "jobs"("status", "category_id");

DO $$ BEGIN
  ALTER TABLE "trader_job_bookmarks"
    ADD CONSTRAINT "trader_job_bookmarks_trader_id_fkey"
    FOREIGN KEY ("trader_id") REFERENCES "traders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trader_job_bookmarks"
    ADD CONSTRAINT "trader_job_bookmarks_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
