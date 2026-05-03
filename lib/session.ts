import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

/**
 * Dashboard / agency Server Actions: requires a logged-in agency user (`admin` | `member`)
 * with `organizationId` on the session. Redirects to login or portal when invalid.
 */
export async function getRequiredSession(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  const role = session.user.role;
  if (role === "client_portal") {
    redirect("/portal");
  }
  if (role !== "admin" && role !== "member") {
    redirect("/login");
  }
  const orgId = session.user.organizationId;
  if (!orgId) {
    redirect("/login");
  }
  return session;
}
