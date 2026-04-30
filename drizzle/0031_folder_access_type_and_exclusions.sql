ALTER TABLE "folder_access" ADD COLUMN IF NOT EXISTS "access_type" text NOT NULL DEFAULT 'view';

CREATE TABLE IF NOT EXISTS "folder_access_exclusions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "folder_id" uuid NOT NULL,
  "team_member_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "folder_access_exclusions"
    ADD CONSTRAINT "folder_access_exclusions_folder_id_folders_id_fk"
    FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "folder_access_exclusions"
    ADD CONSTRAINT "folder_access_exclusions_team_member_id_team_members_id_fk"
    FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "folder_access_exclusions_folder_member_unique"
  ON "folder_access_exclusions" USING btree ("folder_id","team_member_id");
CREATE INDEX IF NOT EXISTS "folder_access_exclusions_folder_id_idx"
  ON "folder_access_exclusions" USING btree ("folder_id");
CREATE INDEX IF NOT EXISTS "folder_access_exclusions_team_member_id_idx"
  ON "folder_access_exclusions" USING btree ("team_member_id");
