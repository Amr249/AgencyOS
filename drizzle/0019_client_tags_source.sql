-- Client tags, tag assignments, and client source tracking
CREATE TABLE IF NOT EXISTS "client_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_tag_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_tag_assignments" ADD CONSTRAINT "client_tag_assignments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_tag_assignments" ADD CONSTRAINT "client_tag_assignments_tag_id_client_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."client_tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_tag_assignments_client_tag_unique" ON "client_tag_assignments" ("client_id","tag_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_tag_assignments_client_id_idx" ON "client_tag_assignments" ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_tag_assignments_tag_id_idx" ON "client_tag_assignments" ("tag_id");
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "source" text;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "source_details" text;
