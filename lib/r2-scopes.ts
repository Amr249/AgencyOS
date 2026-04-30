import { randomUUID } from "crypto";

import { sanitizeFilename } from "./r2";

/**
 * Folder scopes for R2 keys. `CLIENT_LOGO_SCOPE` and `CLIENT_FILES_SCOPE` are both `"clients"`;
 * `buildR2Key` tells them apart by `entityId`: logo uses plain `clientId`, files uses `clientId/fileId`.
 * Same for `projects`: cover uses `projectId`, files uses `projectId/files`.
 */
export const CLIENT_LOGO_SCOPE = "clients";
export const CLIENT_FILES_SCOPE = "clients";
export const PROJECT_COVER_SCOPE = "projects";
export const PROJECT_FILES_SCOPE = "projects";
export const TEAM_AVATAR_SCOPE = "team";
export const AGENCY_LOGO_SCOPE = "agency";
export const EXPENSE_RECEIPT_SCOPE = "expenses";
export const DRIVE_SCOPE = "drive";

export type R2BuildScope =
  | typeof CLIENT_LOGO_SCOPE
  | typeof CLIENT_FILES_SCOPE
  | typeof PROJECT_COVER_SCOPE
  | typeof PROJECT_FILES_SCOPE
  | typeof TEAM_AVATAR_SCOPE
  | typeof AGENCY_LOGO_SCOPE
  | typeof EXPENSE_RECEIPT_SCOPE
  | typeof DRIVE_SCOPE;

function extFromFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, "");
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i) : "";
}

/** Normalizes drive folder path segments (no leading/trailing slashes, no `..`). */
function normalizeDrivePath(folderPath: string): string {
  return folderPath
    .split(/[/\\]+/)
    .filter((s) => s.length > 0 && s !== "." && s !== "..")
    .map((s) => s.replace(/[^a-zA-Z0-9._-]+/g, "_"))
    .join("/");
}

/**
 * Builds an object key for the given scope.
 *
 * - **clients (logo):** `entityId` = `clientId` → `clients/{clientId}/logo_{timestamp}.{ext}`
 * - **clients (files):** `entityId` = `clientId/fileId` → `clients/{clientId}/files/{fileId}_{sanitizedName}`
 * - **projects (cover):** `entityId` = `projectId` (must not end with `/files`) → `projects/{projectId}/cover_{timestamp}.{ext}`
 * - **projects (files):** `entityId` = `projectId/files` → `projects/{projectId}/files/{sanitizedName}`
 * - **team:** `entityId` = `memberId` → `team/{memberId}/avatar_{timestamp}.{ext}`
 * - **agency:** `entityId` ignored → `agency/logo_{timestamp}.{ext}`
 * - **expenses:** `entityId` = `expenseId` → `expenses/receipts/{expenseId}_{sanitizedName}`
 * - **drive:** `entityId` = folder path (use `""` for root) → `drive/{folderPath}/{sanitizedName}`
 */
export function buildR2Key(
  scope: R2BuildScope,
  entityId: string,
  filename: string
): string {
  const ts = Date.now();
  const safeName = sanitizeFilename(filename);

  // Both logo and files use the literal "clients"; one `scope ===` avoids TS narrowing bugs.
  if (scope === "clients") {
    if (entityId.includes("/")) {
      const slash = entityId.indexOf("/");
      const clientId = entityId.slice(0, slash);
      const fileId = entityId.slice(slash + 1);
      return `clients/${clientId}/files/${fileId}_${safeName}`;
    }
    const ext = extFromFilename(filename) || ".bin";
    return `clients/${entityId}/logo_${ts}${ext}`;
  }

  if (scope === "projects") {
    if (entityId.endsWith("/files")) {
      const projectId = entityId.slice(0, -"/files".length);
      return `projects/${projectId}/files/${safeName}`;
    }
    const ext = extFromFilename(filename) || ".bin";
    return `projects/${entityId}/cover_${ts}${ext}`;
  }

  if (scope === TEAM_AVATAR_SCOPE) {
    const ext = extFromFilename(filename) || ".bin";
    return `team/${entityId}/avatar_${ts}${ext}`;
  }

  if (scope === AGENCY_LOGO_SCOPE) {
    const ext = extFromFilename(filename) || ".bin";
    return `agency/logo_${ts}${ext}`;
  }

  if (scope === EXPENSE_RECEIPT_SCOPE) {
    return `expenses/receipts/${entityId}_${safeName}`;
  }

  if (scope === DRIVE_SCOPE) {
    const sub = normalizeDrivePath(entityId);
    const prefix = sub ? `drive/${sub}` : "drive";
    return `${prefix}/${safeName}`;
  }

  const _exhaustive: never = scope;
  return _exhaustive;
}

/** API `scope` values accepted by `POST /api/upload` (multipart). */
export const UPLOAD_SCOPES = [
  "client-logo",
  "client-files",
  "project-cover",
  "project-files",
  "team-avatar",
  "agency-logo",
  "expense-receipt",
  "drive",
  "ai-chat",
  "invoice-attachment",
  "expense-attachment",
  "task-attachment",
  "recurring-vendor-logo",
] as const;

export type UploadApiScope = (typeof UPLOAD_SCOPES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string | null | undefined): s is string {
  return !!s && UUID_RE.test(s);
}

function orRandomId(s: string | null | undefined): string {
  const t = s?.trim();
  return t && t.length > 0 ? t : randomUUID();
}

export type BuildUploadKeyInput = {
  entityId?: string | null;
  folderId?: string | null;
  fileId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  invoiceId?: string | null;
  expenseId?: string | null;
};

/**
 * Maps the upload API `scope` (and related ids) to an R2 object key.
 * Uses {@link buildR2Key} for standard layout; attachment scopes use dedicated prefixes.
 */
export function buildUploadStorageKey(
  scope: string,
  input: BuildUploadKeyInput,
  filename: string
): string {
  const safe = sanitizeFilename(filename);
  const ts = Date.now();

  switch (scope) {
    case "client-logo":
      return buildR2Key("clients", orRandomId(input.entityId), filename);
    case "client-files": {
      const clientId = orRandomId(input.entityId);
      const fileId = orRandomId(input.fileId);
      return buildR2Key("clients", `${clientId}/${fileId}`, filename);
    }
    case "project-cover": {
      const projectId = orRandomId(input.entityId ?? input.projectId);
      return buildR2Key("projects", projectId, filename);
    }
    case "project-files": {
      const projectId = orRandomId(input.entityId ?? input.projectId);
      return buildR2Key("projects", `${projectId}/files`, filename);
    }
    case "team-avatar":
      return buildR2Key("team", orRandomId(input.entityId), filename);
    case "agency-logo":
      return buildR2Key("agency", "", filename);
    case "expense-receipt":
      return buildR2Key("expenses", orRandomId(input.entityId ?? input.expenseId), filename);
    case "drive":
      return buildR2Key(
        "drive",
        (input.folderId ?? input.entityId ?? "").trim(),
        filename
      );
    case "ai-chat":
      return `ai-chat/${ts}_${safe}`;
    case "invoice-attachment": {
      const iid = input.invoiceId?.trim();
      if (!isUuid(iid)) throw new Error("invoiceId is required and must be a UUID");
      return `invoices/${iid}/${ts}_${safe}`;
    }
    case "expense-attachment": {
      const eid = input.expenseId?.trim();
      if (!isUuid(eid)) throw new Error("expenseId is required and must be a UUID");
      return `expenses/attachments/${eid}/${ts}_${safe}`;
    }
    case "task-attachment": {
      const tid = input.taskId?.trim();
      if (!isUuid(tid)) throw new Error("taskId is required and must be a UUID");
      return `tasks/${tid}/${ts}_${safe}`;
    }
    case "recurring-vendor-logo":
      return `vendors/recurring/${ts}_${safe}`;
    default:
      throw new Error(`Invalid scope: ${scope}`);
  }
}

export function isValidUploadScope(scope: string): scope is UploadApiScope {
  return (UPLOAD_SCOPES as readonly string[]).includes(scope);
}
