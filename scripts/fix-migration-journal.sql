-- Fix: Mark migration 0000_common_sage as already applied so "relation already exists" is avoided.
-- Run this in Neon SQL Editor (console.neon.tech → your project → SQL Editor) if
-- npm run db:migrate fails with "relation \"clients\" already exists".
--
-- 1. Ensure the migrations schema and table exist (Drizzle default):
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

-- 2. Insert the first migration as applied (hash = SHA256 of 0000_common_sage.sql, created_at from journal).
--    Safe to run multiple times (only inserts if this hash is not already recorded):
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'b076324eda705cb3289351b94df4a2f756687d95e759d54306a361b2f8617aa2', 1772746971338
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations
  WHERE hash = 'b076324eda705cb3289351b94df4a2f756687d95e759d54306a361b2f8617aa2'
);

-- If your project uses a different migrations schema (e.g. "public"), run this instead:
-- INSERT INTO public.__drizzle_migrations (hash, created_at)
-- SELECT 'b076324eda705cb3289351b94df4a2f756687d95e759d54306a361b2f8617aa2', 1772746971338
-- WHERE NOT EXISTS (SELECT 1 FROM public.__drizzle_migrations WHERE hash = 'b076324eda705cb3289351b94df4a2f756687d95e759d54306a361b2f8617aa2');
