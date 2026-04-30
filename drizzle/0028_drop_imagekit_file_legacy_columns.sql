-- Drop legacy ImageKit columns from files; require R2 key.
-- Run only after all file rows have r2_key set (see scripts/migrate-imagekit-to-r2.ts).

ALTER TABLE "files" DROP COLUMN IF EXISTS "imagekit_file_id";
ALTER TABLE "files" DROP COLUMN IF EXISTS "imagekit_url";
ALTER TABLE "files" DROP COLUMN IF EXISTS "file_path";

ALTER TABLE "files" ALTER COLUMN "r2_key" SET NOT NULL;
