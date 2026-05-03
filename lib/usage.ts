import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { getAiMonthlyLimitForPlan, getStorageBytesLimitForPlan } from "@/lib/plan-limits";
import { fetchOrganizationSnapshot } from "@/lib/org-snapshot";

const AI_LIMIT_ERROR = "AI usage limit reached for your plan.";
/** Thrown by {@link addStorageUsage} when the org would exceed its plan storage cap. */
export const STORAGE_LIMIT_ERROR = "Storage limit reached for your plan.";

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

async function ensureAiUsageMonth(organizationId: string): Promise<void> {
  const [row] = await db
    .select({
      aiUsageResetAt: organizations.aiUsageResetAt,
      aiUsageCount: organizations.aiUsageCount,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!row) throw new Error("Organization not found");
  const now = new Date();
  const monthStart = startOfUtcMonth(now);
  const resetAt = row.aiUsageResetAt ? new Date(row.aiUsageResetAt) : null;
  if (!resetAt || resetAt < monthStart) {
    await db
      .update(organizations)
      .set({
        aiUsageCount: 0,
        aiUsageResetAt: now,
        updatedAt: now,
      })
      .where(eq(organizations.id, organizationId));
  }
}

export async function incrementAiUsage(organizationId: string): Promise<void> {
  await ensureAiUsageMonth(organizationId);
  const org = await fetchOrganizationSnapshot(organizationId);
  if (!org) throw new Error("Organization not found");
  const limit = getAiMonthlyLimitForPlan(org.plan);
  if (Number.isFinite(limit) && org.aiUsageCount >= limit) {
    throw new Error(AI_LIMIT_ERROR);
  }
  const now = new Date();
  await db
    .update(organizations)
    .set({
      aiUsageCount: sql`${organizations.aiUsageCount} + 1`,
      updatedAt: now,
    })
    .where(eq(organizations.id, organizationId));
}

/** Check plan storage cap without mutating (e.g. before upload / presign). */
export async function assertStorageAllowsBytes(organizationId: string, bytes: number): Promise<void> {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  const org = await fetchOrganizationSnapshot(organizationId);
  if (!org) throw new Error("Organization not found");
  const limit = getStorageBytesLimitForPlan(org.plan);
  const next = org.storageUsedBytes + bytes;
  if (Number.isFinite(limit) && next > limit) {
    throw new Error(STORAGE_LIMIT_ERROR);
  }
}

export async function addStorageUsage(organizationId: string, bytes: number): Promise<void> {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  await assertStorageAllowsBytes(organizationId, bytes);
  const now = new Date();
  await db
    .update(organizations)
    .set({
      storageUsedBytes: sql`${organizations.storageUsedBytes} + ${bytes}`,
      updatedAt: now,
    })
    .where(eq(organizations.id, organizationId));
}

export async function removeStorageUsage(organizationId: string | null | undefined, bytes: number): Promise<void> {
  if (!organizationId || !Number.isFinite(bytes) || bytes <= 0) return;
  const now = new Date();
  await db
    .update(organizations)
    .set({
      storageUsedBytes: sql`GREATEST(0::bigint, ${organizations.storageUsedBytes}::bigint - ${Math.floor(bytes)}::bigint)`,
      updatedAt: now,
    })
    .where(eq(organizations.id, organizationId));
}

export async function resetAiUsage(organizationId: string): Promise<void> {
  const now = new Date();
  await db
    .update(organizations)
    .set({
      aiUsageCount: 0,
      aiUsageResetAt: now,
      updatedAt: now,
    })
    .where(eq(organizations.id, organizationId));
}
