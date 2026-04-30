import { NextRequest, NextResponse } from "next/server";
import { assertFileReadableViaSharedFolder } from "@/lib/shared-folder-access";

function normalizeBase(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/$/, "");
}

/**
 * Streams a file for **public folder share** viewers. Auth is the folder `token` + `fileId`
 * (file must live under the shared folder tree). Same R2 allowlist as `/api/drive-inline-file`.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  const fileId = req.nextUrl.searchParams.get("fileId")?.trim() ?? "";
  if (!token || !fileId) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const access = await assertFileReadableViaSharedFolder(token, fileId);
  if (!access.ok) {
    return new NextResponse("Not found", { status: access.status === 403 ? 403 : 404 });
  }

  const raw = access.file.publicFileUrl.trim();
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse("Invalid file URL", { status: 502 });
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return new NextResponse("Invalid file URL", { status: 400 });
  }

  const allowedBase = normalizeBase(process.env.CLOUDFLARE_R2_PUBLIC_URL);
  if (!allowedBase) {
    return new NextResponse("Storage not configured", { status: 503 });
  }

  const withoutHash = raw.split("#")[0] ?? raw;
  if (!withoutHash.startsWith(allowedBase)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const upstream = await fetch(withoutHash, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new NextResponse("Bad gateway", { status: 502 });
  }

  let ct = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!ct || ct === "application/octet-stream" || ct === "binary/octet-stream") {
    const pathLower = target.pathname.toLowerCase();
    if (pathLower.endsWith(".pdf")) {
      ct = "application/pdf";
    } else {
      ct = "application/octet-stream";
    }
  }

  const headers = new Headers();
  headers.set("Content-Type", ct);
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("X-Content-Type-Options", "nosniff");

  if (upstream.body) {
    return new NextResponse(upstream.body, { status: 200, headers });
  }

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, { status: 200, headers });
}
