import { NextResponse } from "next/server";
import { getImageKitClient, IMAGEKIT_CLIENT_LOGO_FOLDER, IMAGEKIT_AGENCY_LOGO_FOLDER, IMAGEKIT_PROJECT_COVER_FOLDER, IMAGEKIT_TEAM_AVATAR_FOLDER } from "@/lib/imagekit";

export async function POST(request: Request) {
  const client = getImageKitClient();
  if (!client) {
    return NextResponse.json(
      { error: "ImageKit not configured. Set IMAGEKIT_PRIVATE_KEY, IMAGEKIT_PUBLIC_KEY, IMAGEKIT_URL_ENDPOINT." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const folderParam = formData.get("folder") as string | null;
  const scope = (formData.get("scope") as string) || "client-logo";
  const projectId = formData.get("projectId") as string | null;
  const taskId = formData.get("taskId") as string | null;
  const invoiceId = formData.get("invoiceId") as string | null;
  const expenseId = formData.get("expenseId") as string | null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing or invalid file" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.replace(/^.*\./, "") || "png";
  let folder: string;
  if (folderParam && typeof folderParam === "string" && folderParam.length > 0) {
    folder = folderParam.replace(/\/+$/, "").replace(/^\/+/, "");
  } else if (scope === "invoice-attachment" && invoiceId && /^[0-9a-f-]{36}$/i.test(invoiceId)) {
    folder = `agencyos/invoices/${invoiceId}`;
  } else if (scope === "expense-attachment" && expenseId && /^[0-9a-f-]{36}$/i.test(expenseId)) {
    folder = `agencyos/expenses/${expenseId}`;
  } else if (scope === "task-attachment" && taskId && /^[0-9a-f-]{36}$/i.test(taskId)) {
    folder = `agencyos/tasks/${taskId}`;
  } else if (scope === "agency-logo") {
    folder = IMAGEKIT_AGENCY_LOGO_FOLDER;
  } else if (scope === "client-logo") {
    folder = IMAGEKIT_CLIENT_LOGO_FOLDER;
  } else if (scope === "project-cover") {
    folder = projectId && /^[0-9a-f-]{36}$/i.test(projectId)
      ? `agencyos/projects/${projectId}/cover`
      : IMAGEKIT_PROJECT_COVER_FOLDER;
  } else if (scope === "team-avatar") {
    folder = IMAGEKIT_TEAM_AVATAR_FOLDER;
  } else if (scope === "recurring-vendor-logo") {
    folder = "agencyos/recurring-vendors";
  } else {
    folder = "agencyos/uploads";
  }
  const fileName = `${folder}/${crypto.randomUUID()}.${ext}`;

  try {
    const { toFile } = await import("@imagekit/nodejs");
    const uploadFile = await toFile(buffer, file.name);
    const result = await client.files.upload({
      file: uploadFile,
      fileName,
    });
    const url = result.url;
    if (!url) {
      return NextResponse.json({ error: "Upload failed: no URL returned" }, { status: 500 });
    }
    const size = file.size;
    const mimeType = file.type || null;
    const name = file.name;
    return NextResponse.json({
      url,
      fileId: result.fileId ?? undefined,
      name,
      size,
      mimeType,
      filePath: result.filePath ?? fileName,
    });
  } catch (e) {
    console.error("ImageKit upload error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
