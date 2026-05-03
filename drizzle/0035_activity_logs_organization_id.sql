-- Tenant-scope activity log reads (dashboard recent activity).
ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "activity_logs_organization_id_idx" ON "activity_logs" USING btree ("organization_id");
