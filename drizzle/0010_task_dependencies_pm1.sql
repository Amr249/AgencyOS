CREATE TABLE IF NOT EXISTS "task_dependencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "depends_on_task_id" uuid NOT NULL,
  "type" text DEFAULT 'finish_to_start' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_dependencies_task_id_tasks_id_fk'
  ) THEN
    ALTER TABLE "task_dependencies"
      ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk"
      FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_dependencies_depends_on_task_id_tasks_id_fk'
  ) THEN
    ALTER TABLE "task_dependencies"
      ADD CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk"
      FOREIGN KEY ("depends_on_task_id") REFERENCES "tasks"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "task_dependencies_task_id_idx" ON "task_dependencies" ("task_id");
CREATE INDEX IF NOT EXISTS "task_dependencies_depends_on_task_id_idx" ON "task_dependencies" ("depends_on_task_id");
