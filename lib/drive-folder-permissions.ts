/**
 * Drive UI + server rules for agency system folders (`/drive/system/...`).
 * Root buckets: locked (no rename/delete/share). Auto-synced subfolders: share OK, no rename/delete.
 * User-created folders under the system tree: full control.
 */

export const DRIVE_ROOT_SYSTEM_TYPES = new Set([
  "root_clients",
  "root_projects",
  "root_invoices",
  "root_expenses",
  "root_team",
  "root_general",
]);

export type DriveFolderPermissionInput = {
  isSystem: boolean;
  systemType: string | null;
  projectId: string | null;
};

export function isRootSystemDriveFolder(folder: DriveFolderPermissionInput): boolean {
  const st = folder.systemType ?? "";
  return Boolean(folder.isSystem && st && DRIVE_ROOT_SYSTEM_TYPES.has(st));
}

export function canRenameDriveFolder(folder: DriveFolderPermissionInput): boolean {
  return !folder.isSystem;
}

export function canDeleteDriveFolder(folder: DriveFolderPermissionInput): boolean {
  return !folder.isSystem;
}

/** Public share link — allowed for user folders and auto system folders, not root buckets. */
export function canShareDriveFolder(folder: DriveFolderPermissionInput): boolean {
  if (!folder.isSystem) return true;
  return !isRootSystemDriveFolder(folder);
}

/**
 * Whether to show folder ACL management (admin drive).
 * Pass `false` on member drive so the menu stays hidden.
 */
export function canAccessDriveFolder(_folder: DriveFolderPermissionInput, canManageFolderAccess = true): boolean {
  return canManageFolderAccess;
}

export function showDriveFolderLock(folder: Pick<DriveFolderPermissionInput, "isSystem">): boolean {
  return folder.isSystem;
}
