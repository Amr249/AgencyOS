-- Win/loss tracking for CRM pipeline
CREATE TABLE IF NOT EXISTS "win_loss_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "win_loss_reasons_type_reason_unique" ON "win_loss_reasons" ("type","reason");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "win_loss_reasons_type_idx" ON "win_loss_reasons" ("type");
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "won_lost_reason" text;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "won_lost_date" date;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "deal_value" numeric(12, 2);
--> statement-breakpoint
INSERT INTO "win_loss_reasons" ("type", "reason")
SELECT v.type, v.reason FROM (VALUES
	('won'::text, 'Great fit'),
	('won', 'Referral'),
	('won', 'Budget approved'),
	('won', 'Quick decision'),
	('won', 'Strong need'),
	('lost', 'Price too high'),
	('lost', 'Chose competitor'),
	('lost', 'No budget'),
	('lost', 'No response'),
	('lost', 'Bad timing'),
	('lost', 'Not a fit')
) AS v(type, reason)
WHERE NOT EXISTS (
SELECT 1 FROM "win_loss_reasons" r WHERE r.type = v.type AND r.reason = v.reason
);
