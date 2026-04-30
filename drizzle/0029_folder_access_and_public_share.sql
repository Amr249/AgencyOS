ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "share_token" text;
ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "share_expires_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "folders_share_token_idx" ON "folders" USING btree ("share_token");
CREATE UNIQUE INDEX IF NOT EXISTS "folders_share_token_unique"
  ON "folders" ("share_token")
  WHERE "share_token" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "folder_access" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "folder_id" uuid NOT NULL,
  "team_member_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "folder_access"
    ADD CONSTRAINT "folder_access_folder_id_folders_id_fk"
    FOREIGN KEY ("folder_id")
    REFERENCES "public"."folders"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "folder_access"
    ADD CONSTRAINT "folder_access_team_member_id_team_members_id_fk"
    FOREIGN KEY ("team_member_id")
    REFERENCES "public"."team_members"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "folder_access_folder_member_unique"
  ON "folder_access" USING btree ("folder_id","team_member_id");
CREATE INDEX IF NOT EXISTS "folder_access_folder_id_idx"
  ON "folder_access" USING btree ("folder_id");
CREATE INDEX IF NOT EXISTS "folder_access_team_member_id_idx"
  ON "folder_access" USING btree ("team_member_id");
