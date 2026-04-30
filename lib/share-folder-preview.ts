/** Same-origin PDF/video-safe proxy for **guest** folder shares (no session). */
export function shareFolderInlineFileUrl(token: string, fileId: string): string {
  const t = token.trim();
  const id = fileId.trim();
  if (!t || !id) return "";
  const q = new URLSearchParams({ token: t, fileId: id });
  return `/api/share-folder-file?${q.toString()}`;
}
