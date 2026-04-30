/** Server action `_form[]` keys; client translates via `driveActionErrors` in messages. */
export const DRIVE_ACTION_ERROR_KEYS = [
  "memberDriveFolderRequired",
  "memberCannotCreateStandaloneFolders",
  "memberCanOnlyCreateProjectFolders",
  "memberCanOnlyUploadToProjectFolders",
  "forbidden",
  "notAuthorized",
  "parentFolderNotFound",
] as const;

export type DriveActionErrorKey = (typeof DRIVE_ACTION_ERROR_KEYS)[number];

export function isDriveActionErrorKey(v: string): v is DriveActionErrorKey {
  return (DRIVE_ACTION_ERROR_KEYS as readonly string[]).includes(v);
}
