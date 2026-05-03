-- First-time welcome toast: existing org members skip the toast (already onboarded).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_seen_welcome" boolean NOT NULL DEFAULT false;
UPDATE "users" SET "has_seen_welcome" = true WHERE "id" IN (SELECT "user_id" FROM "org_members");
