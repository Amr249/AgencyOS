import type { DbErrorKey } from "@/lib/db-errors";

export const DB_ERROR_KEYS: DbErrorKey[] = ["connectionTimeout", "unknown", "fetchFailed"];

export function isDbErrorKey(s: string): s is DbErrorKey {
  return (DB_ERROR_KEYS as readonly string[]).includes(s);
}
