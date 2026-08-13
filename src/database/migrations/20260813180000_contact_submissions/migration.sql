-- Contact Us form submissions (website + admin CRM)

CREATE TABLE "contact_submissions" (
    "id" UUID NOT NULL,
    "reference_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "agreement_accepted" BOOLEAN NOT NULL DEFAULT false,
    "status" "SurveyRegistrationStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by_id" UUID,
    "user_email_sent" BOOLEAN NOT NULL DEFAULT false,
    "admin_email_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_submissions_reference_code_key" ON "contact_submissions"("reference_code");

ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
