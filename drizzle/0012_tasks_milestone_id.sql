DO $$ BEGIN
 ALTER TABLE "tasks" ADD COLUMN "milestone_id" uuid;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_milestone_id_idx" ON "tasks" USING btree ("milestone_id");
