-- Add country to consumer survey (website form uses Country dropdown)
ALTER TABLE "survey_consumer_registrations" ADD COLUMN IF NOT EXISTS "country" TEXT;

-- Trader survey registrations (website /trader-survey form)
CREATE TABLE "survey_trader_registrations" (
    "id" UUID NOT NULL,
    "registration_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "company_website" TEXT,
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

    CONSTRAINT "survey_trader_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "survey_trader_registrations_registration_code_key" ON "survey_trader_registrations"("registration_code");

ALTER TABLE "survey_trader_registrations" ADD CONSTRAINT "survey_trader_registrations_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
