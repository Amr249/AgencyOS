import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";

const allowed = new Set(["ar", "en"]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (sessionUserRole(session) === "member") {
    return NextResponse.json({ error: "Locale is fixed for member accounts" }, { status: 403 });
  }

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
