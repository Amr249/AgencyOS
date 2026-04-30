/** Base URL for absolute links (share, emails). No trailing slash. */
export function publicAppBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "https://agencyos.pixlesa.com";
}

export function sharePageUrl(token: string): string {
  return `${publicAppBaseUrl()}/share/${encodeURIComponent(token)}`;
}

export function folderSharePageUrl(token: string): string {
  return `${publicAppBaseUrl()}/share/folder/${encodeURIComponent(token)}`;
}
