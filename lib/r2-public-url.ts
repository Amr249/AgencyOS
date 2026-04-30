/** Build a public object URL from `r2_key` + `CLOUDFLARE_R2_PUBLIC_URL` (server-side). */
export function publicUrlFromR2Key(r2Key: string | null | undefined): string {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim().replace(/\/$/, "") ?? "";
  const key = r2Key?.trim();
  if (!base || !key) return "";
  return `${base}/${key.replace(/^\/+/, "")}`;
}
