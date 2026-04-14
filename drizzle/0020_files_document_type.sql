-- Client documents: typed attachments (separate from general files when document_type is set).
DO $$ BEGIN
  CREATE TYPE "file_document_type" AS ENUM ('contract', 'agreement', 'proposal', 'nda', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "document_type" "file_document_type";
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "description" text;
