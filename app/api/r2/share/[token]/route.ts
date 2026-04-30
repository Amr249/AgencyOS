import { NextResponse } from "next/server";
import { getFileByShareToken } from "@/actions/files";

type Ctx = { params: Promise<{ token: string }> };

/**
 * Direct share access: validates token then redirects to the public R2 URL.
 * For richer UX, prefer `/share/[token]` (guest page).
 */
export async function GET(_request: Request, context: Ctx) {
  const { token } = await context.params;
  if (!token || token.length < 8) {
    return new NextResponse("Invalid token", { status: 400 });
  }

  const res = await getFileByShareToken(token);
  if (!res.ok) {
    if (res.reason === "expired") {
      return new NextResponse("Gone", { status: 410 });
    }
    if (res.reason === "forbidden") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(res.data.imagekitUrl, 302);
}
