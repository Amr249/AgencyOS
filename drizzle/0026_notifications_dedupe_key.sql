ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" text;
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_key_uidx" ON "notifications" ("dedupe_key") WHERE "dedupe_key" IS NOT NULL;
