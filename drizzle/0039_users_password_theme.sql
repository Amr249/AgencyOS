-- Align public.users with lib/db/schema.ts: credential login + theme + welcome flag.
-- Older databases only had 0000 columns (no password_hash / theme_preference).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "theme_preference" text;

-- Rows without a hash cannot use password login; placeholder is a real bcrypt of a long random secret (not user-guessable).
UPDATE "users"
SET "password_hash" = '$2a$12$HmZ200wpckMD2J2p3hv7c.UdqhXqTiUZv8A54e7.A1b7hENFrdpWy'
WHERE "password_hash" IS NULL OR trim("password_hash") = '';

ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_seen_welcome" boolean NOT NULL DEFAULT false;
