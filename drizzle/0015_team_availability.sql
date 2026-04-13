CREATE TABLE IF NOT EXISTS "team_availability" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE cascade,
  "date" date NOT NULL,
  "type" text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_availability_member_date_unique"
  ON "team_availability" ("team_member_id", "date");

CREATE INDEX IF NOT EXISTS "team_availability_member_idx"
  ON "team_availability" ("team_member_id");

CREATE INDEX IF NOT EXISTS "team_availability_date_idx"
  ON "team_availability" ("date");
