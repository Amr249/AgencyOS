-- Tenant-isolate agency Drive system folders: paths become /drive/system/<organization_id>/...
-- Legacy rows used /drive/system/<bucket name>/... (second segment not a UUID). Re-prefix those
-- under the bootstrap organization (oldest by created_at) so existing single-tenant data stays usable.

DO $$
DECLARE
  bootstrap_org uuid;
BEGIN
  SELECT id INTO bootstrap_org FROM organizations ORDER BY created_at ASC LIMIT 1;
  IF bootstrap_org IS NULL THEN
    RAISE NOTICE 'drive path migration: no organizations row, skip';
    RETURN;
  END IF;

  UPDATE folders f
  SET path = '/drive/system/' || bootstrap_org::text || '/' || substring(f.path FROM 15)
  WHERE f.path LIKE '/drive/system/%'
    AND substring(f.path FROM 15) IS NOT NULL
    AND substring(f.path FROM 15) <> ''
    AND split_part(f.path, '/', 4) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
END $$;
