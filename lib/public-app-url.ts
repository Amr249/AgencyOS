/** Base URL for absolute links (share, emails). No trailing slash. */
export function publicAppBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

export function sharePageUrl(token: string): string {
  return `${publicAppBaseUrl()}/share/${encodeURIComponent(token)}`;
}
