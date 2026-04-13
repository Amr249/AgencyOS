DO $$ BEGIN
 CREATE TYPE "public"."milestone_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"due_date" date NOT NULL,
	"status" "milestone_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"linked_invoice_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestones" ADD CONSTRAINT "milestones_linked_invoice_id_invoices_id_fk" FOREIGN KEY ("linked_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_project_id_idx" ON "milestones" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_due_date_idx" ON "milestones" USING btree ("due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_status_idx" ON "milestones" USING btree ("status");
