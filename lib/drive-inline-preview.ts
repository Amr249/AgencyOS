/** Same-origin preview URL so the browser embeds files with `Content-Disposition: inline` instead of downloading (R2 often sends `attachment`). */
export function driveInlinePreviewUrl(publicFileUrl: string): string {
  const u = publicFileUrl?.trim();
  if (!u) return "";
  return `/api/drive-inline-file?url=${encodeURIComponent(u)}`;
}
