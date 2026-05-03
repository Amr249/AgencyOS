-- Idempotent: ensures columns required by session/org snapshot reads exist.
-- Fixes environments where 0033 was not applied but app code expects onboarding columns.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean DEFAULT false NOT NULL;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboarding_step" integer DEFAULT 1 NOT NULL;
