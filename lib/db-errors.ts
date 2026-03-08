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

export const DB_CONNECTION_ERROR_MESSAGE =
  "تعذر الاتصال بقاعدة البيانات. تحقق من الاتصال بالإنترنت وحاول مرة أخرى.";
