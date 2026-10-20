-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_messages_job_id_sender_id_read_at_idx"
  ON "chat_messages"("job_id", "sender_id", "read_at");
