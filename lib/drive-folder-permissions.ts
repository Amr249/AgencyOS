/**
 * Drive UI + server rules for agency system folders (`/drive/system/...`).
 * Root buckets: locked (no rename/delete/share). Auto-synced subfolders: share OK, no rename/delete.
 * User-created folders under the system tree: full control (based on the folder row itself, not the parent).
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

/** Normalize DB / serialization quirks (e.g. string booleans) for permission checks. */
function toTruthyBoolean(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true" || s === "t" || s === "1") return true;
    if (s === "false" || s === "f" || s === "0" || s === "") return false;
  }
  return Boolean(value);
}

export function isRootSystemDriveFolder(folder: DriveFolderPermissionInput): boolean {
  const st = folder.systemType ?? "";
  return Boolean(toTruthyBoolean(folder.isSystem) && st && DRIVE_ROOT_SYSTEM_TYPES.has(st));
}

/**
 * True for root buckets and typed auto-managed rows (`team_member`, `client`, …).
 * Rows with `is_system` set but empty `system_type` are treated as user-managed (misclassified / legacy).
 */
export function isDriveFolderProtectedFromUserEdits(folder: DriveFolderPermissionInput): boolean {
  if (!toTruthyBoolean(folder.isSystem)) return false;
  if (isRootSystemDriveFolder(folder)) return true;
  return Boolean((folder.systemType ?? "").trim());
}

export function canRenameDriveFolder(folder: DriveFolderPermissionInput): boolean {
  return !isDriveFolderProtectedFromUserEdits(folder);
}

export function canDeleteDriveFolder(folder: DriveFolderPermissionInput): boolean {
  return !isDriveFolderProtectedFromUserEdits(folder);
}

/** Public share link — allowed for user folders and auto system folders, not root buckets. */
export function canShareDriveFolder(folder: DriveFolderPermissionInput): boolean {
  return !isRootSystemDriveFolder(folder);
}

/**
 * Whether to show folder ACL management (admin drive).
 * Pass `false` on member drive so the menu stays hidden.
 */
export function canAccessDriveFolder(_folder: DriveFolderPermissionInput, canManageFolderAccess = true): boolean {
  return canManageFolderAccess;
}

export function showDriveFolderLock(folder: DriveFolderPermissionInput): boolean {
  return isDriveFolderProtectedFromUserEdits(folder);
}
