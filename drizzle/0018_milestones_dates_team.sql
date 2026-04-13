-- Milestones: start date, drop invoice link & amount; milestone ↔ team members
ALTER TABLE "milestones" DROP CONSTRAINT IF EXISTS "milestones_linked_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "milestones" DROP COLUMN IF EXISTS "linked_invoice_id";
--> statement-breakpoint
ALTER TABLE "milestones" DROP COLUMN IF EXISTS "amount";
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "start_date" date;
--> statement-breakpoint
UPDATE "milestones" SET "start_date" = "due_date" WHERE "start_date" IS NULL;
--> statement-breakpoint
ALTER TABLE "milestones" ALTER COLUMN "start_date" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_start_date_idx" ON "milestones" ("start_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "milestone_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_id" uuid NOT NULL,
	"team_member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestone_team_members" ADD CONSTRAINT "milestone_team_members_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestone_team_members" ADD CONSTRAINT "milestone_team_members_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "milestone_team_members_milestone_team_unique" ON "milestone_team_members" ("milestone_id", "team_member_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestone_team_members_milestone_id_idx" ON "milestone_team_members" ("milestone_id");
