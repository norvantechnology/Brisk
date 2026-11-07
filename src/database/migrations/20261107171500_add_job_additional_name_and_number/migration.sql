-- AlterTable
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "additional_name" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "additional_number" TEXT;

