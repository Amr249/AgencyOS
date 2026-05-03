"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { and, asc, count, eq, isNull, notExists, sql } from "drizzle-orm";
import { z } from "zod";
import { assertAdminSession } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { orgMembers, teamMembers, users } from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { notifyUserAndAdmins } from "@/actions/notifications";
import { requireAgencyOrganization } from "@/lib/org-session";
import { requireWriteAccess, trialExpiredPlain } from "@/lib/trial";

const createUserManualSchema = z.object({
  source: z.literal("manual"),
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "member"]),
});

const createUserFromTeamSchema = z.object({
  source: z.literal("team_member"),
  teamMemberId: z.string().uuid(),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "member"]),
});

const createUserInputSchema = z.discriminatedUnion("source", [
  createUserManualSchema,
  createUserFromTeamSchema,
]);

export type TeamMemberInviteRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export async function listTeamMembersForUserInvite(): Promise<
  { ok: true; data: TeamMemberInviteRow[] } | { ok: false; error: string }
> {
  const gate = await assertAdminSession();
  if (!gate.ok) return { ok: false, error: gate.error };

  try {
    const ctx = await requireAgencyOrganization();
    const orgId = ctx.organizationId;
    const rows = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        email: teamMembers.email,
        avatarUrl: teamMembers.avatarUrl,
      })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.organizationId, orgId),
          eq(teamMembers.status, "active"),
          isNull(teamMembers.userId),
          sql`trim(coalesce(${teamMembers.email}, '')) <> ''`,
          notExists(
            db
              .select({ id: users.id })
              .from(users)
              .where(
                sql`lower(trim(${users.email})) = lower(trim(coalesce(${teamMembers.email}, '')))`
              )
          )
        )
      )
      .orderBy(asc(teamMembers.name));

    const data: TeamMemberInviteRow[] = rows
      .filter((r) => r.email && r.email.trim().length > 0)
      .map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email!.trim(),
        avatarUrl: r.avatarUrl,
      }));

    return { ok: true, data };
  } catch (e) {
    console.error("listTeamMembersForUserInvite", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "member"]),
});

const updateAgencyUserSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  /** When set and non-empty, replaces password. */
  password: z.string().min(8).max(128).optional(),
});

export type AgencyUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
};

export async function listAgencyUsers(): Promise<
  { ok: true; data: AgencyUserRow[] } | { ok: false; error: string }
> {
  const gate = await assertAdminSession();
  if (!gate.ok) return { ok: false, error: gate.error };

  try {
    const ctx = await requireAgencyOrganization();
    const orgId = ctx.organizationId;
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(orgMembers, eq(users.id, orgMembers.userId))
      .where(eq(orgMembers.organizationId, orgId))
      .orderBy(asc(users.createdAt));
    return { ok: true, data: rows };
  } catch (e) {
    console.error("listAgencyUsers", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

export async function createAgencyUser(
  input: z.infer<typeof createUserInputSchema>
): Promise<
  | { ok: true; data: { id: string } }
  | {
      ok: false;
      error:
        | "validation"
        | "email_exists"
        | "team_member_not_found"
        | "team_member_no_email"
        | "team_member_already_linked"
        | "unauthorized"
        | "forbidden"
        | string;
    }
> {
  const gate = await assertAdminSession();
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = createUserInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const wa = await requireWriteAccess();
  if (!wa.ok) return { ok: false, error: wa.error };

  const ctx = await requireAgencyOrganization();
  const orgId = ctx.organizationId;

  let name: string;
  let emailNorm: string;
  let avatarUrl: string | null = null;
  let linkTeamMemberId: string | null = null;

  if (parsed.data.source === "manual") {
    name = parsed.data.name.trim();
    emailNorm = parsed.data.email.trim().toLowerCase();
  } else {
    const [tm] = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        email: teamMembers.email,
        avatarUrl: teamMembers.avatarUrl,
        userId: teamMembers.userId,
      })
      .from(teamMembers)
      .where(and(eq(teamMembers.id, parsed.data.teamMemberId), eq(teamMembers.organizationId, orgId)))
      .limit(1);

    if (!tm) return { ok: false, error: "team_member_not_found" };
    if (tm.userId) return { ok: false, error: "team_member_already_linked" };

    const rawEmail = tm.email?.trim() ?? "";
    if (!rawEmail) return { ok: false, error: "team_member_no_email" };

    name = tm.name.trim();
    emailNorm = rawEmail.toLowerCase();
    avatarUrl = tm.avatarUrl?.trim() || null;
    linkTeamMemberId = tm.id;
  }

  try {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailNorm))
      .limit(1);
    if (existing) return { ok: false, error: "email_exists" };

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const [row] = await db
      .insert(users)
      .values({
        name,
        email: emailNorm,
        passwordHash,
        role: parsed.data.role,
        avatarUrl,
      })
      .returning({ id: users.id });

    if (!row) return { ok: false, error: "unknown" };

    await db.insert(orgMembers).values({
      userId: row.id,
      organizationId: orgId,
      role: parsed.data.role === "admin" ? "admin" : "member",
    });

    if (linkTeamMemberId) {
      await db
        .update(teamMembers)
        .set({ userId: row.id })
        .where(and(eq(teamMembers.id, linkTeamMemberId), eq(teamMembers.organizationId, orgId)));
    } else {
      const [tm] = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.organizationId, orgId),
            sql`lower(trim(coalesce(${teamMembers.email}, ''))) = ${emailNorm}`
          )
        )
        .limit(1);
      if (tm) {
        await db
          .update(teamMembers)
          .set({ userId: row.id })
          .where(eq(teamMembers.id, tm.id));
      }
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/users");
    revalidatePath("/dashboard/team");
    return { ok: true, data: row };
  } catch (e) {
    console.error("createAgencyUser", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "email_exists" };
    }
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

export async function updateAgencyUserRole(
  input: z.infer<typeof updateRoleSchema>
): Promise<
  { ok: true } | { ok: false; error: "validation" | "last_admin" | "unauthorized" | "forbidden" | string }
> {
  const gate = await assertAdminSession();
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const wa = await requireWriteAccess();
  if (!wa.ok) return { ok: false, error: wa.error };

  try {
    const ctx = await requireAgencyOrganization();
    const orgId = ctx.organizationId;

    const [membership] = await db
      .select({ userId: orgMembers.userId })
      .from(orgMembers)
      .where(and(eq(orgMembers.userId, parsed.data.userId), eq(orgMembers.organizationId, orgId)))
      .limit(1);
    if (!membership) return { ok: false, error: "unknown" };

    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, parsed.data.userId))
      .limit(1);
    if (!target) return { ok: false, error: "unknown" };

    if (target.role === "admin" && parsed.data.role === "member") {
      const [agg] = await db
        .select({ n: count(users.id) })
        .from(orgMembers)
        .innerJoin(users, eq(orgMembers.userId, users.id))
        .where(and(eq(orgMembers.organizationId, orgId), eq(users.role, "admin")));
      const n = Number(agg?.n ?? 0);
      if (n <= 1) return { ok: false, error: "last_admin" };
    }

    await db
      .update(users)
      .set({ role: parsed.data.role })
      .where(eq(users.id, parsed.data.userId));

    await db
      .update(orgMembers)
      .set({ role: parsed.data.role === "admin" ? "admin" : "member" })
      .where(and(eq(orgMembers.userId, parsed.data.userId), eq(orgMembers.organizationId, orgId)));

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/users");
    return { ok: true };
  } catch (e) {
    console.error("updateAgencyUserRole", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

export async function updateAgencyUser(
  input: z.infer<typeof updateAgencyUserSchema>
): Promise<
  | { ok: true }
  | {
      ok: false;
      error: "validation" | "email_exists" | "unauthorized" | "forbidden" | string;
    }
> {
  const gate = await assertAdminSession();
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = updateAgencyUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const wa = await requireWriteAccess();
  if (!wa.ok) return { ok: false, error: wa.error };

  const emailNorm = parsed.data.email.trim().toLowerCase();
  const pwd = parsed.data.password?.trim();

  try {
    const ctx = await requireAgencyOrganization();
    const orgId = ctx.organizationId;

    const [subjectMembership] = await db
      .select({ userId: orgMembers.userId })
      .from(orgMembers)
      .where(and(eq(orgMembers.userId, parsed.data.userId), eq(orgMembers.organizationId, orgId)))
      .limit(1);
    if (!subjectMembership) return { ok: false, error: "unknown" };

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailNorm))
      .limit(1);
    if (existing && existing.id !== parsed.data.userId) {
      return { ok: false, error: "email_exists" };
    }

    const [before] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, parsed.data.userId))
      .limit(1);

    const updatePayload: { name: string; email: string; passwordHash?: string } = {
      name: parsed.data.name.trim(),
      email: emailNorm,
    };
    if (pwd) {
      updatePayload.passwordHash = await bcrypt.hash(pwd, 12);
    }

    const [updated] = await db
      .update(users)
      .set(updatePayload)
      .where(eq(users.id, parsed.data.userId))
      .returning({ id: users.id });
    if (!updated) return { ok: false, error: "unknown" };

    const emailChanged = before ? before.email.toLowerCase() !== emailNorm : false;
    const displayName = parsed.data.name.trim() || before?.name || "المستخدم";
    if (emailChanged) {
      await notifyUserAndAdmins({
        targetUserId: parsed.data.userId,
        actorId: gate.userId,
        type: "profile.email_changed_by_admin",
        title: "تم تحديث البريد الإلكتروني",
        body: `قام المشرف بتحديث البريد الإلكتروني لـ ${displayName} إلى ${emailNorm}.`,
        linkUrl: "/dashboard/account",
      });
    }
    if (pwd) {
      await notifyUserAndAdmins({
        targetUserId: parsed.data.userId,
        actorId: gate.userId,
        type: "profile.password_changed_by_admin",
        title: "تم تغيير كلمة المرور",
        body: `قام المشرف بتحديث كلمة المرور لـ ${displayName}.`,
        linkUrl: "/dashboard/account",
      });
    }

    const [tm] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.organizationId, orgId),
          sql`lower(trim(coalesce(${teamMembers.email}, ''))) = ${emailNorm}`
        )
      )
      .limit(1);
    if (tm) {
      await db
        .update(teamMembers)
        .set({ userId: updated.id })
        .where(and(eq(teamMembers.id, tm.id), eq(teamMembers.organizationId, orgId)));
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/users");
    revalidatePath("/dashboard/team");
    return { ok: true };
  } catch (e) {
    console.error("updateAgencyUser", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "email_exists" };
    }
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

export async function deleteAgencyUser(
  userId: string
): Promise<
  | { ok: true }
  | {
      ok: false;
      error: "validation" | "self_delete" | "last_admin" | "unauthorized" | "forbidden" | string;
    }
> {
  const gate = await assertAdminSession();
  if (!gate.ok) return { ok: false, error: gate.error };

  const idParsed = z.string().uuid().safeParse(userId);
  if (!idParsed.success) return { ok: false, error: "validation" };

  if (idParsed.data === gate.userId) {
    return { ok: false, error: "self_delete" };
  }

  const wa = await requireWriteAccess();
  if (!wa.ok) return { ok: false, error: wa.error };

  try {
    const ctx = await requireAgencyOrganization();
    const orgId = ctx.organizationId;

    const [membership] = await db
      .select({ userId: orgMembers.userId })
      .from(orgMembers)
      .where(and(eq(orgMembers.userId, idParsed.data), eq(orgMembers.organizationId, orgId)))
      .limit(1);
    if (!membership) return { ok: false, error: "unknown" };

    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, idParsed.data))
      .limit(1);
    if (!target) return { ok: false, error: "unknown" };

    if (target.role === "admin") {
      const [agg] = await db
        .select({ n: count(users.id) })
        .from(orgMembers)
        .innerJoin(users, eq(orgMembers.userId, users.id))
        .where(and(eq(orgMembers.organizationId, orgId), eq(users.role, "admin")));
      const n = Number(agg?.n ?? 0);
      if (n <= 1) return { ok: false, error: "last_admin" };
    }

    await db
      .delete(orgMembers)
      .where(and(eq(orgMembers.userId, idParsed.data), eq(orgMembers.organizationId, orgId)));

    const [remaining] = await db
      .select({ n: count(orgMembers.id) })
      .from(orgMembers)
      .where(eq(orgMembers.userId, idParsed.data));
    if (Number(remaining?.n ?? 0) === 0) {
      await db.delete(users).where(eq(users.id, idParsed.data));
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/users");
    revalidatePath("/dashboard/team");
    return { ok: true };
  } catch (e) {
    console.error("deleteAgencyUser", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}
