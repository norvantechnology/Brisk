DO $$ BEGIN
  CREATE TYPE "SiteVisitTimeSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'ANYTIME');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TraderSiteVisitStatus" AS ENUM ('CONFIRMED', 'RESCHEDULE_REQUIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "trader_site_visit_requests" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "trader_id" UUID NOT NULL,
    "visit_date" DATE NOT NULL,
    "time_slot" "SiteVisitTimeSlot" NOT NULL,
    "status" "TraderSiteVisitStatus" NOT NULL DEFAULT 'CONFIRMED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trader_site_visit_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trader_site_visit_requests_job_id_trader_id_key"
  ON "trader_site_visit_requests"("job_id", "trader_id");

CREATE INDEX IF NOT EXISTS "trader_site_visit_requests_trader_id_status_idx"
  ON "trader_site_visit_requests"("trader_id", "status");

CREATE INDEX IF NOT EXISTS "trader_site_visit_requests_job_id_idx"
  ON "trader_site_visit_requests"("job_id");

DO $$ BEGIN
  ALTER TABLE "trader_site_visit_requests"
    ADD CONSTRAINT "trader_site_visit_requests_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trader_site_visit_requests"
    ADD CONSTRAINT "trader_site_visit_requests_trader_id_fkey"
    FOREIGN KEY ("trader_id") REFERENCES "traders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
