CREATE TYPE "invitation_role" AS ENUM ('admin', 'member');
CREATE TYPE "invitation_status" AS ENUM ('pending', 'accepted', 'expired');

CREATE TABLE "invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" "invitation_role" NOT NULL,
  "invited_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" "invitation_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);

CREATE INDEX "invitations_organization_id_idx" ON "invitations" ("organization_id");

CREATE UNIQUE INDEX "invitations_org_email_pending_uidx"
  ON "invitations" ("organization_id", lower(trim(email)))
  WHERE "status" = 'pending';

ALTER TABLE "organizations" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;
ALTER TABLE "organizations" ADD COLUMN "onboarding_step" integer DEFAULT 1 NOT NULL;

UPDATE "organizations" SET "onboarding_completed" = true, "onboarding_step" = 4;
