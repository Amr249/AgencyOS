import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getCachedOrganization } from "@/lib/org-snapshot";
import { isTrialExpired } from "@/lib/trial";
import { deleteFromR2, isR2Configured, uploadToR2 } from "@/lib/r2";
import { buildUploadStorageKey, isValidUploadScope } from "@/lib/r2-scopes";
import { addStorageUsage, assertStorageAllowsBytes, STORAGE_LIMIT_ERROR } from "@/lib/usage";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json(
      {
        error:
          "R2 not configured. Set CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME, and CLOUDFLARE_R2_PUBLIC_URL.",
      },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.user.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = sessionUserRole(session);
  if (role !== "admin" && role !== "member") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await getCachedOrganization(orgId);
  if (org && isTrialExpired(org)) {
    return NextResponse.json({ error: "trial_expired" }, { status: 403 });
  }
  if (!org?.slug) {
    return NextResponse.json({ error: "Organization not found" }, { status: 400 });
  }

  const scopeRaw = str(formData, "scope") ?? "client-logo";
  if (scopeRaw === "ai-chat" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isValidUploadScope(scopeRaw)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing or invalid file" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)` },
      { status: 400 }
    );
  }

  try {
    await assertStorageAllowsBytes(orgId, file.size);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === STORAGE_LIMIT_ERROR || msg.includes("Storage limit")) {
      return NextResponse.json({ error: STORAGE_LIMIT_ERROR }, { status: 413 });
    }
    throw e;
  }

  const keyInput = {
    entityId: str(formData, "entityId"),
    folderId: str(formData, "folderId"),
    fileId: str(formData, "fileId"),
    projectId: str(formData, "projectId"),
    taskId: str(formData, "taskId"),
    invoiceId: str(formData, "invoiceId"),
    expenseId: str(formData, "expenseId"),
  };

  let key: string;
  try {
    key = buildUploadStorageKey(scopeRaw, keyInput, file.name, org.slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid upload parameters";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const contentType = file.type?.trim() || "application/octet-stream";

  try {
    const { url } = await uploadToR2(buffer, key, contentType);
    try {
      await addStorageUsage(orgId, file.size);
    } catch (e) {
      await deleteFromR2(key).catch(() => {});
      const msg = e instanceof Error ? e.message : "";
      if (msg === STORAGE_LIMIT_ERROR || msg.includes("Storage limit")) {
        return NextResponse.json({ error: STORAGE_LIMIT_ERROR }, { status: 413 });
      }
      throw e;
    }
    const name = file.name;
    const size = file.size;
    const mimeType = contentType;
    return NextResponse.json({
      url,
      key,
      name,
      size,
      mimeType,
    });
  } catch (e) {
    console.error("R2 upload error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
