/**
 * Agency-wide system folder tree lives under this path prefix (one tree per organization).
 * Keep in sync with `actions/system-folders.ts`.
 */
export function agencySystemDrivePathPrefix(organizationId: string): string {
  return `/drive/system/${organizationId}`;
}
