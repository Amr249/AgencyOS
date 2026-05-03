-- Public invite links: unique token per invitation row.
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "token" text;

UPDATE "invitations"
SET "token" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE "token" IS NULL;

ALTER TABLE "invitations" ALTER COLUMN "token" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_uidx" ON "invitations" ("token");
