import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";

export function sessionUserRole(session: Session | null): "admin" | "member" | null {
  const r = (session?.user as { role?: string } | undefined)?.role;
  if (r === "admin" || r === "member") return r;
  return null;
}

/** Server-only: require admin for mutating agency-wide data. */
export async function assertAdminSession(): Promise<
  | { ok: true; session: NonNullable<Session>; userId: string }
  | { ok: false; error: "unauthorized" | "forbidden" }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (sessionUserRole(session) !== "admin") return { ok: false, error: "forbidden" };
  return { ok: true, session, userId: session.user.id };
}
