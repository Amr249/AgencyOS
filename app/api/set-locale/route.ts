import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const allowed = new Set(["ar", "en"]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const locale = body?.locale as string | undefined;
  if (!locale || !allowed.has(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
  const cookieStore = await cookies();
  cookieStore.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true });
}
