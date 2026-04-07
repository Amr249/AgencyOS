-- Invoice-scoped attachments (ImageKit paths under agencyos/invoices/{id}/).
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "invoice_id" uuid REFERENCES "invoices"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "files_invoice_id_idx" ON "files" ("invoice_id");
