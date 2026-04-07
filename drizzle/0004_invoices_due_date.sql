-- Align with lib/db/schema.ts: optional due date for overdue / aging logic.
-- Safe if column already exists (e.g. after drizzle-kit push).
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "due_date" date;
