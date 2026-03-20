export function isDbConnectionError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const msg = e.message.toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("etimedout") ||
    msg.includes("econnrefused") ||
    msg.includes("error connecting to database")
  );
}

/** Keys under `errors` namespace — translate in UI with `useTranslations('errors')` / `getTranslations('errors')`. */
export type DbErrorKey = "connectionTimeout" | "unknown" | "fetchFailed";

export function getDbErrorKey(error: unknown): DbErrorKey {
  if (isDbConnectionError(error)) return "connectionTimeout";
  if (error instanceof Error && error.message.toLowerCase().includes("fetch failed")) {
    return "fetchFailed";
  }
  return "unknown";
}
