import type { FolderRow } from "@/actions/folders";

/** R2 `drive` scope path segment (no leading slash) for `buildUploadStorageKey("drive", …)`. */
export function driveEntityPathFromFolder(
  folder: Pick<FolderRow, "path"> | null,
  clientId?: string,
  projectId?: string,
  /** No leading/trailing slashes, e.g. `drive/user/{uuid}` for `/dashboard/drive`. */
  standalonePathPrefix?: string
): string {
  if (folder?.path) {
    return folder.path.replace(/^\/+/, "").replace(/\/+$/, "");
  }
  if (clientId) return `client/${clientId}`;
  if (projectId) return `project/${projectId}`;
  if (standalonePathPrefix) {
    return standalonePathPrefix.replace(/^\/+/, "").replace(/\/+$/, "");
  }
  return "";
}
