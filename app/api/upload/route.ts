import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { isR2Configured, uploadToR2 } from "@/lib/r2";
import {
  buildUploadStorageKey,
  isValidUploadScope,
} from "@/lib/r2-scopes";

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

  const file = formData.get("file");
  const scopeRaw = str(formData, "scope") ?? "client-logo";

  if (scopeRaw === "ai-chat") {
    const session = await getServerSession(authOptions);
    if (sessionUserRole(session) !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!isValidUploadScope(scopeRaw)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

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
    key = buildUploadStorageKey(scopeRaw, keyInput, file.name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid upload parameters";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const contentType = file.type?.trim() || "application/octet-stream";

  try {
    const { url } = await uploadToR2(buffer, key, contentType);
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
