ALTER TABLE "mostaql_scrape_runs" ADD COLUMN "projects_processed" integer DEFAULT 0 NOT NULL;
ALTER TABLE "mostaql_scrape_runs" ADD COLUMN "projects_total" integer DEFAULT 0 NOT NULL;
