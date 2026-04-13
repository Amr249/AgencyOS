ALTER TABLE "project_templates" ADD COLUMN IF NOT EXISTS "source_project_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_source_project_id_projects_id_fk" FOREIGN KEY ("source_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "task_templates" ADD COLUMN IF NOT EXISTS "parent_task_template_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_parent_task_template_id_task_templates_id_fk" FOREIGN KEY ("parent_task_template_id") REFERENCES "public"."task_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_templates_parent_task_template_id_idx" ON "task_templates" USING btree ("parent_task_template_id");
