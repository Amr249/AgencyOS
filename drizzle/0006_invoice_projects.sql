-- Many-to-many: invoices ↔ projects (one invoice can cover multiple projects).
CREATE TABLE IF NOT EXISTS "invoice_projects" (
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  PRIMARY KEY ("invoice_id", "project_id")
);
CREATE INDEX IF NOT EXISTS "invoice_projects_project_id_idx" ON "invoice_projects" ("project_id");

-- Backfill from legacy single project_id on invoices.
INSERT INTO "invoice_projects" ("invoice_id", "project_id")
SELECT "id", "project_id" FROM "invoices" WHERE "project_id" IS NOT NULL
ON CONFLICT DO NOTHING;
