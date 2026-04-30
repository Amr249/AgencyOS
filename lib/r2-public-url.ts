/** Build a public object URL from `r2_key` + `CLOUDFLARE_R2_PUBLIC_URL` (server-side). */
export function publicUrlFromR2Key(r2Key: string | null | undefined): string {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim().replace(/\/$/, "") ?? "";
  const key = r2Key?.trim();
  if (!base || !key) return "";
  return `${base}/${key.replace(/^\/+/, "")}`;
}

/** Reverse `publicUrlFromR2Key` when the URL is served from the configured public R2 base. */
export function r2ObjectKeyFromPublicUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim().replace(/\/$/, "") ?? "";
  if (!base) return null;
  const u = url.trim();
  const prefix = `${base}/`;
  if (!u.startsWith(prefix)) return null;
  const rest = u.slice(prefix.length);
  try {
    const decoded = decodeURIComponent(rest);
    const key = decoded.replace(/^\/+/, "");
    return key.length > 0 ? key : null;
  } catch {
    const key = rest.replace(/^\/+/, "");
    return key.length > 0 ? key : null;
  }
}
