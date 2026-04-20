ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "uploaded_by" uuid;
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "files_task_id_idx" ON "files" ("task_id");
