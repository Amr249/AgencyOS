-- Single-row app settings (id always 1); was in schema but never migrated on some DBs.
CREATE TABLE IF NOT EXISTS "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"agency_name" text,
	"agency_email" text,
	"agency_website" text,
	"vat_number" text,
	"agency_logo_url" text,
	"agency_address" jsonb,
	"invoice_prefix" text DEFAULT 'INV',
	"invoice_next_number" integer DEFAULT 1,
	"default_currency" char(3) DEFAULT 'SAR',
	"default_payment_terms" integer DEFAULT 30,
	"invoice_footer" text,
	"invoice_color" char(7)
);
--> statement-breakpoint
INSERT INTO "settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
