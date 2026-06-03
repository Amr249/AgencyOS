ALTER TABLE "projects" ALTER COLUMN "client_id" DROP NOT NULL;
ALTER TABLE "projects" ADD COLUMN "is_internal" boolean DEFAULT false NOT NULL;
