import { getRequiredSession } from "@/lib/session";
import { requireWriteAccess } from "@/lib/trial";

export type AgencyOrgContext = {
  ok: true;
  organizationId: string;
  userId: string;
};

export type AgencyWriteGuardResult = AgencyOrgContext | { ok: false; error: "trial_expired" };

/**
 * Same guarantees as {@link getRequiredSession} (redirects if invalid), then returns org + user ids.
 * Prefer `getRequiredSession()` when you need the full session.
 */
export async function requireAgencyOrganization(): Promise<AgencyOrgContext> {
  const session = await getRequiredSession();
  return {
    ok: true,
    organizationId: session.user.organizationId,
    userId: session.user.id,
  };
}

/**
 * For server actions that mutate agency data: blocks when the org trial has expired (non-internal).
 * Read-only actions should use {@link requireAgencyOrganization} instead.
 */
export async function requireAgencyWriteContext(): Promise<AgencyWriteGuardResult> {
  const wa = await requireWriteAccess();
  if (!wa.ok) return { ok: false, error: wa.error };
  return {
    ok: true,
    organizationId: wa.session.user.organizationId,
    userId: wa.session.user.id,
  };
}
