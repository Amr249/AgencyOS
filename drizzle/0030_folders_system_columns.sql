-- Agency drive: fixed system folder tree under /drive/system/...
ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false;
ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "system_type" text;
ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "team_member_id" uuid REFERENCES "team_members"("id") ON DELETE SET NULL;
