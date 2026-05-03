import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getCachedOrganization } from "@/lib/org-snapshot";
import { isTrialExpired } from "@/lib/trial";
import { getPresignedUploadUrl, getPublicUrl, isR2Configured } from "@/lib/r2";
import { buildUploadStorageKey, isValidUploadScope } from "@/lib/r2-scopes";
import { assertStorageAllowsBytes, STORAGE_LIMIT_ERROR } from "@/lib/usage";

const MAX_FILE_BYTES = 200 * 1024 * 1024;

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
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
  if (scopeRaw === "ai-chat") {
    if (sessionUserRole(session) !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (!isValidUploadScope(scopeRaw)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  const filename = str(formData, "filename");
  if (!filename) {
    return NextResponse.json({ error: "filename is required" }, { status: 400 });
  }

  const sizeRaw = str(formData, "sizeBytes");
  const sizeBytes = sizeRaw ? Number(sizeRaw) : 0;
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "Invalid sizeBytes" }, { status: 400 });
  }
  if (sizeBytes > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)` }, { status: 400 });
  }

  try {
    await assertStorageAllowsBytes(orgId, sizeBytes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === STORAGE_LIMIT_ERROR || msg.includes("Storage limit")) {
      return NextResponse.json({ error: STORAGE_LIMIT_ERROR }, { status: 413 });
    }
    throw e;
  }

  const mimeType = str(formData, "mimeType") ?? "application/octet-stream";
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
    key = buildUploadStorageKey(scopeRaw, keyInput, filename, org.slug);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid upload parameters";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const uploadUrl = await getPresignedUploadUrl(key, mimeType, 900);
    const url = getPublicUrl(key);
    return NextResponse.json({
      uploadUrl,
      url,
      key,
      name: filename,
      size: sizeBytes,
      mimeType,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create upload URL" },
      { status: 500 }
    );
  }
}
