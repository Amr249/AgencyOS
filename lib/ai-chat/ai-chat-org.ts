import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";

/**
 * Resolves the active organization for AI data access from the server session only.
 * Used by API routes and tool executors (no client-supplied org id).
 */
export async function getOrganizationIdForAiDataAccess(): Promise<
  { ok: true; organizationId: string } | { ok: false }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false };
  if (sessionUserRole(session) !== "admin") return { ok: false };
  const organizationId = session.user.organizationId;
  if (typeof organizationId !== "string" || organizationId.length === 0) {
    return { ok: false };
  }
  return { ok: true, organizationId };
}
