-- Folders tree + R2 / sharing columns on files (legacy ImageKit columns retained).

CREATE TABLE IF NOT EXISTS "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"client_id" uuid,
	"project_id" uuid,
	"path" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "folders" ADD CONSTRAINT "folders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "folders" ADD CONSTRAINT "folders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "folders_parent_id_idx" ON "folders" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "folders_client_id_idx" ON "folders" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "folders_project_id_idx" ON "folders" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "folders_path_idx" ON "folders" USING btree ("path");

ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "folder_id" uuid;
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "r2_key" text;
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "share_token" text;
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "share_expires_at" timestamp with time zone;

DO $$ BEGIN
 ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "files_folder_id_idx" ON "files" USING btree ("folder_id");
CREATE INDEX IF NOT EXISTS "files_share_token_idx" ON "files" USING btree ("share_token");
CREATE INDEX IF NOT EXISTS "files_r2_key_idx" ON "files" USING btree ("r2_key");

CREATE UNIQUE INDEX IF NOT EXISTS "files_share_token_unique" ON "files" ("share_token") WHERE "share_token" IS NOT NULL;
