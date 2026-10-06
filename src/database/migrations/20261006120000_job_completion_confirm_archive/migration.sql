-- Customer "Confirm Completion" + admin "Archive Job"
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "customer_confirmed_at" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
