CREATE TYPE "public"."service_status" AS ENUM('active', 'inactive');

CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "service_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "project_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "project_services" ADD CONSTRAINT "project_services_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "project_services" ADD CONSTRAINT "project_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "project_services_project_service_unique" ON "project_services" USING btree ("project_id","service_id");
CREATE INDEX "services_name_idx" ON "services" USING btree ("name");
CREATE INDEX "services_status_idx" ON "services" USING btree ("status");
CREATE INDEX "project_services_project_id_idx" ON "project_services" USING btree ("project_id");
CREATE INDEX "project_services_service_id_idx" ON "project_services" USING btree ("service_id");
