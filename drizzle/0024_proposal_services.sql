CREATE TABLE IF NOT EXISTS "proposal_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "proposal_services" ADD CONSTRAINT "proposal_services_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "proposal_services" ADD CONSTRAINT "proposal_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_services_proposal_service_unique" ON "proposal_services" ("proposal_id","service_id");
CREATE INDEX IF NOT EXISTS "proposal_services_proposal_id_idx" ON "proposal_services" ("proposal_id");
CREATE INDEX IF NOT EXISTS "proposal_services_service_id_idx" ON "proposal_services" ("service_id");
