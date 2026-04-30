/**
 * File / document types for UI and server actions.
 * Not in `actions/files.ts` because `"use server"` modules may only export async functions.
 */

export const FILE_DOCUMENT_TYPES = [
  "contract",
  "agreement",
  "proposal",
  "nda",
  "other",
] as const;
export type FileDocumentType = (typeof FILE_DOCUMENT_TYPES)[number];

export type FileRow = {
  id: string;
  name: string;
  /** Object key in R2 (same as DB `r2_key`). */
  r2Key: string;
  /** Public HTTPS URL: `CLOUDFLARE_R2_PUBLIC_URL` + `/` + `r2Key`. */
  publicFileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  clientId: string | null;
  projectId: string | null;
  taskId: string | null;
  invoiceId: string | null;
  expenseId: string | null;
  documentType: FileDocumentType | null;
  description: string | null;
  /** `users.id` of the uploader, null for legacy rows. */
  uploadedBy: string | null;
  /** Display name of the uploader (`team_members.name` matched via `team_members.user_id`), null if unknown. */
  uploadedByName: string | null;
  /** Avatar URL of the uploader (`team_members.avatar_url`), null if unknown. */
  uploadedByAvatarUrl: string | null;
  createdAt: Date;
  folderId?: string | null;
  isPublic?: boolean;
  shareToken?: string | null;
  shareExpiresAt?: Date | null;
};
