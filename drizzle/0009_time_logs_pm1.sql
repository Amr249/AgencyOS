-- PM-1 time tracking: billable, hourly override, denormalized project + index
ALTER TABLE "time_logs" ADD COLUMN IF NOT EXISTS "is_billable" boolean DEFAULT true NOT NULL;
ALTER TABLE "time_logs" ADD COLUMN IF NOT EXISTS "hourly_rate" numeric(10, 2);
ALTER TABLE "time_logs" ADD COLUMN IF NOT EXISTS "project_id" uuid;

-- Link FK after column exists (idempotent if already applied by drizzle-kit push)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'time_logs_project_id_projects_id_fk'
  ) THEN
    ALTER TABLE "time_logs"
      ADD CONSTRAINT "time_logs_project_id_projects_id_fk"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

UPDATE "time_logs" AS tl
SET "project_id" = t."project_id"
FROM "tasks" AS t
WHERE tl."task_id" = t."id" AND tl."project_id" IS NULL;

CREATE INDEX IF NOT EXISTS "time_logs_project_id_idx" ON "time_logs" ("project_id");
