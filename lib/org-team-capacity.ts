import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitations, orgMembers } from "@/lib/db/schema";
import { getMaxTeamMembersForPlan, type PlanTier } from "@/lib/plan-limits";

/** Returned from server actions; clients map to `errors.starterTeamMemberLimit`. */
export const STARTER_TEAM_LIMIT_ERROR = "STARTER_TEAM_LIMIT" as const;

export async function getOrgMemberCount(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(orgMembers)
    .where(eq(orgMembers.organizationId, organizationId));
  return Number(row?.c ?? 0);
}

export async function getActivePendingInviteCount(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.status, "pending"),
        gt(invitations.expiresAt, new Date())
      )
    );
  return Number(row?.c ?? 0);
}

export async function getPendingInviteEmailsLowercased(organizationId: string): Promise<Set<string>> {
  const rows = await db
    .select({ email: invitations.email })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.status, "pending"),
        gt(invitations.expiresAt, new Date())
      )
    );
  return new Set(rows.map((r) => r.email.trim().toLowerCase()));
}

/** Counts distinct emails in `emails` that are not already covered by a pending invite. */
export function countNetNewPendingInvites(emails: string[], pendingLower: Set<string>): number {
  const seen = new Set<string>();
  let n = 0;
  for (const raw of emails) {
    const e = raw.trim().toLowerCase();
    if (seen.has(e)) continue;
    seen.add(e);
    if (!pendingLower.has(e)) n += 1;
  }
  return n;
}

/** True if adding `netNewPendingInvites` would exceed the org’s team cap (Starter = 3). */
export async function wouldExceedTeamCapWithNewInvites(params: {
  organizationId: string;
  plan: PlanTier;
  netNewPendingInvites: number;
}): Promise<boolean> {
  const max = getMaxTeamMembersForPlan(params.plan);
  if (!Number.isFinite(max)) return false;
  const m = await getOrgMemberCount(params.organizationId);
  const p = await getActivePendingInviteCount(params.organizationId);
  return m + p + params.netNewPendingInvites > max;
}

/** True if accepting one more member would exceed cap (pending for this accept is “consumed”). */
export async function wouldExceedTeamCapWithOneMoreMember(params: {
  organizationId: string;
  plan: PlanTier;
}): Promise<boolean> {
  const max = getMaxTeamMembersForPlan(params.plan);
  if (!Number.isFinite(max)) return false;
  const m = await getOrgMemberCount(params.organizationId);
  return m + 1 > max;
}
