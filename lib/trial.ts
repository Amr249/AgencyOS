import type { Session } from "next-auth";
import { getRequiredSession } from "@/lib/session";
import { getCachedOrganization } from "@/lib/org-snapshot";
import { isTrialExpired } from "@/lib/trial-status";

export type { TrialOrgInput, TrialStatus } from "@/lib/trial-status";
export { getTrialStatus, isTrialExpired } from "@/lib/trial-status";

export type WriteAccessResult =
  | { ok: true; session: Session; organizationId: string }
  | { ok: false; error: "trial_expired" };

/**
 * Agency dashboard writes: blocks when org trial has ended (non-internal, `trial_ends_at` in the past).
 * Call at the top of create/update/delete server actions. Read-only actions should not call this.
 */
export async function requireWriteAccess(): Promise<WriteAccessResult> {
  const session = await getRequiredSession();
  const org = await getCachedOrganization(session.user.organizationId);
  if (!org) {
    return { ok: true, session, organizationId: session.user.organizationId };
  }
  if (isTrialExpired(org)) {
    return { ok: false, error: "trial_expired" };
  }
  return { ok: true, session, organizationId: session.user.organizationId };
}

/** Stable machine key; map to `errors.trial_expired` in the UI. */
export const TRIAL_EXPIRED_ERROR = "trial_expired" as const;

export function trialExpiredPlain(): { ok: false; error: typeof TRIAL_EXPIRED_ERROR } {
  return { ok: false, error: TRIAL_EXPIRED_ERROR };
}

export function trialExpiredForm(): {
  ok: false;
  error: { _form: [typeof TRIAL_EXPIRED_ERROR] };
} {
  return { ok: false, error: { _form: [TRIAL_EXPIRED_ERROR] } };
}
