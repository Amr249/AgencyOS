-- Multi-tenant foundation: org_plan / org_member_role enums, organizations, org_members,
-- organization_id on tenant-scoped tables, settings row migrated from integer singleton to UUID per org.
-- Backfill: one default organization + all existing rows point at it (single-tenant → SaaS bootstrap).

DO $$ BEGIN
  CREATE TYPE "public"."org_plan" AS ENUM ('starter', 'pro', 'enterprise', 'internal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."org_member_role" AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "plan" "public"."org_plan" DEFAULT 'starter' NOT NULL,
  "features" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "logo_url" text,
  "trial_ends_at" timestamptz,
  "ai_usage_count" integer DEFAULT 0 NOT NULL,
  "ai_usage_reset_at" timestamptz,
  "storage_used_bytes" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_uidx" ON "organizations" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "organizations_plan_idx" ON "organizations" USING btree ("plan");

CREATE TABLE IF NOT EXISTS "org_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "role" "public"."org_member_role" DEFAULT 'member' NOT NULL,
  "joined_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "org_members"
    ADD CONSTRAINT "org_members_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "org_members"
    ADD CONSTRAINT "org_members_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "org_members_user_organization_uidx"
  ON "org_members" USING btree ("user_id", "organization_id");
CREATE INDEX IF NOT EXISTS "org_members_organization_id_idx" ON "org_members" USING btree ("organization_id");

INSERT INTO "organizations" ("name", "slug", "plan", "features", "storage_used_bytes", "created_at", "updated_at")
SELECT 'Default agency', 'default', 'internal', '{}'::jsonb, 0, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "organizations" WHERE "slug" = 'default');

-- Tenant FK target: first org (by created_at) for backfill
-- ---------------------------------------------------------------------------
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
UPDATE "clients" c
SET "organization_id" = o."id"
FROM (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1) o
WHERE c."organization_id" IS NULL;

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
UPDATE "projects" p
SET "organization_id" = o."id"
FROM (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1) o
WHERE p."organization_id" IS NULL;

ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
UPDATE "proposals" p
SET "organization_id" = o."id"
FROM (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1) o
WHERE p."organization_id" IS NULL;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
UPDATE "tasks" t
SET "organization_id" = o."id"
FROM (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1) o
WHERE t."organization_id" IS NULL;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
UPDATE "invoices" i
SET "organization_id" = o."id"
FROM (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1) o
WHERE i."organization_id" IS NULL;

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
UPDATE "expenses" e
SET "organization_id" = o."id"
FROM (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1) o
WHERE e."organization_id" IS NULL;

ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
UPDATE "files" f
SET "organization_id" = o."id"
FROM (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1) o
WHERE f."organization_id" IS NULL;

ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
UPDATE "team_members" tm
SET "organization_id" = o."id"
FROM (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1) o
WHERE tm."organization_id" IS NULL;

ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
UPDATE "services" s
SET "organization_id" = o."id"
FROM (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1) o
WHERE s."organization_id" IS NULL;

-- settings: add organization_id, replace integer PK with uuid
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
UPDATE "settings" s
SET "organization_id" = o."id"
FROM (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1) o
WHERE s."organization_id" IS NULL;

ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "settings_row_uuid" uuid DEFAULT gen_random_uuid();
UPDATE "settings" SET "settings_row_uuid" = gen_random_uuid() WHERE "settings_row_uuid" IS NULL;
ALTER TABLE "settings" ALTER COLUMN "settings_row_uuid" SET NOT NULL;

ALTER TABLE "settings" DROP CONSTRAINT IF EXISTS "settings_pkey";
ALTER TABLE "settings" DROP COLUMN IF EXISTS "id";
ALTER TABLE "settings" RENAME COLUMN "settings_row_uuid" TO "id";
ALTER TABLE "settings" ADD PRIMARY KEY ("id");

ALTER TABLE "settings" ALTER COLUMN "organization_id" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "settings"
    ADD CONSTRAINT "settings_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "settings_organization_id_uidx" ON "settings" USING btree ("organization_id");

-- NOT NULL + FKs on tenant tables
ALTER TABLE "clients" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "proposals" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "expenses" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "files" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "team_members" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "services" ALTER COLUMN "organization_id" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "team_members" ADD CONSTRAINT "team_members_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "clients_organization_id_idx" ON "clients" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "projects_organization_id_idx" ON "projects" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "proposals_organization_id_idx" ON "proposals" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "tasks_organization_id_idx" ON "tasks" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "invoices_organization_id_idx" ON "invoices" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "expenses_organization_id_idx" ON "expenses" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "files_organization_id_idx" ON "files" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "team_members_organization_id_idx" ON "team_members" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "services_organization_id_idx" ON "services" USING btree ("organization_id");
