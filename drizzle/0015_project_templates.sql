CREATE TABLE IF NOT EXISTS "project_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_phases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_budget" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_template_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"estimated_hours" numeric(6, 2),
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"phase_index" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_project_template_id_project_templates_id_fk" FOREIGN KEY ("project_template_id") REFERENCES "public"."project_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_templates_project_template_id_idx" ON "task_templates" USING btree ("project_template_id");
