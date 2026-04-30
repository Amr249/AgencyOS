import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

function normalizeBase(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/$/, "");
}

/**
 * Proxies a **public R2 object URL** for authenticated users and strips forced download
 * by setting `Content-Disposition: inline`. Prevents SSRF by allowlisting `CLOUDFLARE_R2_PUBLIC_URL`.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("url")?.trim();
  if (!raw) {
    return new NextResponse("Missing url", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return new NextResponse("Invalid url", { status: 400 });
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
  /** `inline` only — avoid `filename=` which can make Chrome treat navigation as a download. */
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("X-Content-Type-Options", "nosniff");

  if (upstream.body) {
    return new NextResponse(upstream.body, { status: 200, headers });
  }

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, { status: 200, headers });
}
