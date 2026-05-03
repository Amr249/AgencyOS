-- Scope Mostaql scrape runs per organization (AI chat + reports must not leak cross-tenant).
ALTER TABLE "mostaql_scrape_runs" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "mostaql_scrape_runs_organization_id_idx" ON "mostaql_scrape_runs" ("organization_id");
