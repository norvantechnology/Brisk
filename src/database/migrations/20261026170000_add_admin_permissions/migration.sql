-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
