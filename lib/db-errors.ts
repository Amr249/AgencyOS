/** Walk Error.cause, AggregateError.errors, and Neon-style sourceError chains. */
function collectRelatedErrors(e: unknown, out: unknown[], seen: Set<unknown>): void {
  if (e == null || seen.has(e)) return;
  seen.add(e);
  out.push(e);

  if (e instanceof AggregateError) {
    for (const sub of e.errors) collectRelatedErrors(sub, out, seen);
  }
  if (e instanceof Error && e.cause != null) {
    collectRelatedErrors(e.cause, out, seen);
  }
  if (typeof e === "object" && e !== null && "sourceError" in e) {
    collectRelatedErrors((e as { sourceError: unknown }).sourceError, out, seen);
  }
}

function allRelatedErrors(e: unknown): unknown[] {
  const out: unknown[] = [];
  collectRelatedErrors(e, out, new Set());
  return out;
}

function messageOf(x: unknown): string {
  if (x instanceof Error) return x.message.toLowerCase();
  if (typeof x === "string") return x.toLowerCase();
  return "";
}

function codeOf(x: unknown): string | null {
  if (typeof x === "object" && x !== null && "code" in x) {
    const c = (x as { code: unknown }).code;
    if (typeof c === "string" || typeof c === "number") return String(c).toUpperCase();
  }
  return null;
}

export function isDbConnectionError(e: unknown): boolean {
  for (const x of allRelatedErrors(e)) {
    const msg = messageOf(x);
    if (
      msg.includes("fetch failed") ||
      msg.includes("etimedout") ||
      msg.includes("econnrefused") ||
      msg.includes("error connecting to database") ||
      msg.includes("eai_again") ||
      msg.includes("enotfound") ||
      msg.includes("socket hang up") ||
      msg.includes("network error")
    ) {
      return true;
    }
    const code = codeOf(x);
    if (code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "EAI_AGAIN" || code === "ENOTFOUND") {
      return true;
    }
  }
  return false;
}

/** Keys under `errors` namespace — translate in UI with `useTranslations('errors')` / `getTranslations('errors')`. */
export type DbErrorKey = "connectionTimeout" | "unknown" | "fetchFailed";

export function getDbErrorKey(error: unknown): DbErrorKey {
  if (!isDbConnectionError(error)) return "unknown";
  for (const x of allRelatedErrors(error)) {
    const msg = messageOf(x);
    if (msg.includes("fetch failed")) return "fetchFailed";
  }
  return "connectionTimeout";
}

/** PostgreSQL `sqlstate` / driver `code` (e.g. 23505 unique, 23503 FK) from nested driver errors. */
export function findPostgresErrorCode(e: unknown): string | null {
  for (const x of allRelatedErrors(e)) {
    const c = codeOf(x);
    if (c && /^[0-9]{5}$/.test(c)) return c;
  }
  return null;
}
