/** Custom MIME types for HTML5 drag-and-drop in the drive file manager. */
export const DRIVE_FILE_DRAG_MIME = "application/x-drive-file-id";
export const DRIVE_FOLDER_DRAG_MIME = "application/x-drive-folder-id";

export function dataTransferHasDriveFile(types: DOMStringList | readonly string[]): boolean {
  return Array.from(types as string[]).includes(DRIVE_FILE_DRAG_MIME);
}

export function dataTransferHasDriveFolder(types: DOMStringList | readonly string[]): boolean {
  return Array.from(types as string[]).includes(DRIVE_FOLDER_DRAG_MIME);
}
