"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { and, desc, eq, gt, min } from "drizzle-orm";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { db } from "@/lib/db";
import { invitations, orgMembers, organizations, users } from "@/lib/db/schema";
import { getInvitationPublicUrl } from "@/lib/invitation-url";
import { getRequiredSession } from "@/lib/session";
import { requireWriteAccess, trialExpiredPlain } from "@/lib/trial";

const INVITE_EXPIRY_DAYS = 7;

const inviteRowSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
});

const invitesSchema = z.array(inviteRowSchema).max(50);

function assertOwnerOrAdmin(orgRole: string | undefined): boolean {
  return orgRole === "owner" || orgRole === "admin";
}

function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export type CreateInvitationsResult =
  | { ok: true; count: number; inviteLinks: { email: string; url: string }[] }
  | { ok: false; error: string };

export async function createInvitations(entries: unknown): Promise<CreateInvitationsResult> {
  const parsed = invitesSchema.safeParse(entries);
  if (!parsed.success) {
    return { ok: false, error: "Invalid invitations" };
  }
  if (parsed.data.length === 0) {
    return { ok: true, count: 0, inviteLinks: [] };
  }
  try {
    const session = await getRequiredSession();
    if (!assertOwnerOrAdmin(session.user.orgRole)) {
      return { ok: false, error: "Forbidden" };
    }
    const wa = await requireWriteAccess();
    if (!wa.ok) return { ok: false, error: wa.error };

    const organizationId = session.user.organizationId;
    const inviteLinks: { email: string; url: string }[] = [];
    let count = 0;

    for (const row of parsed.data) {
      const email = row.email.trim().toLowerCase();
      const token = generateInviteToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

      await db
        .delete(invitations)
        .where(
          and(
            eq(invitations.organizationId, organizationId),
            eq(invitations.status, "pending"),
            eq(invitations.email, email)
          )
        );

      await db.insert(invitations).values({
        organizationId,
        email,
        role: row.role,
        invitedBy: session.user.id,
        status: "pending",
        token,
        expiresAt,
      });

      inviteLinks.push({ email, url: getInvitationPublicUrl(token) });
      count += 1;
    }

    revalidatePath("/dashboard/onboarding");
    revalidatePath("/dashboard/settings");
    return { ok: true, count, inviteLinks };
  } catch (e) {
    console.error("createInvitations", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save invitations" };
  }
}

export type InvitationLookup =
  | { kind: "valid"; organizationName: string; inviterName: string; email: string; role: "admin" | "member" }
  | { kind: "not_found" }
  | { kind: "expired" }
  | { kind: "used" };

export async function getInvitationByToken(token: string): Promise<InvitationLookup> {
  const t = z.string().min(16).max(200).safeParse(token);
  if (!t.success) return { kind: "not_found" };

  const [row] = await db
    .select({
      id: invitations.id,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      email: invitations.email,
      role: invitations.role,
      orgName: organizations.name,
      inviterName: users.name,
    })
    .from(invitations)
    .innerJoin(organizations, eq(invitations.organizationId, organizations.id))
    .innerJoin(users, eq(invitations.invitedBy, users.id))
    .where(eq(invitations.token, t.data))
    .limit(1);

  if (!row) return { kind: "not_found" };

  if (row.status === "accepted") return { kind: "used" };

  if (row.status === "expired" || row.expiresAt.getTime() <= Date.now()) {
    return { kind: "expired" };
  }

  return {
    kind: "valid",
    organizationName: row.orgName,
    inviterName: row.inviterName,
    email: row.email,
    role: row.role as "admin" | "member",
  };
}

const acceptInviteSchema = z
  .object({
    token: z.string().min(16).max(200),
    name: z.string().min(1, "Name is required").max(120),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type AcceptInvitationResult =
  | { ok: true; email: string }
  | { ok: false; error: Record<string, string[]> | string }
  | { ok: false; code: "account_exists"; email: string };

export async function acceptInvitation(input: unknown): Promise<AcceptInvitationResult> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { token, name, password } = parsed.data;

  try {
    const [inv] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!inv) {
      return { ok: false, error: "Invitation not found" };
    }
    if (inv.status !== "pending") {
      return { ok: false, error: "Invitation is no longer valid" };
    }
    if (inv.expiresAt.getTime() <= Date.now()) {
      return { ok: false, error: "Invitation has expired" };
    }

    const email = inv.email.trim().toLowerCase();

    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) {
      return { ok: false, code: "account_exists", email };
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email,
        passwordHash,
        role: "member",
      })
      .returning({ id: users.id });

    if (!newUser) {
      throw new Error("Failed to create user");
    }

    // neon-http: no transactions — order matters (member then mark invite accepted).
    await db.insert(orgMembers).values({
      userId: newUser.id,
      organizationId: inv.organizationId,
      role: inv.role as "admin" | "member",
    });

    await db.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, inv.id));

    return { ok: true, email };
  } catch (e) {
    console.error("acceptInvitation", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to accept invitation" };
  }
}

export type OrgInvitationRow = {
  id: string;
  email: string;
  role: "admin" | "member";
  status: "pending" | "accepted" | "expired";
  createdAt: Date;
  expiresAt: Date;
  token: string;
};

export async function getOrgInvitations(): Promise<
  { ok: true; data: OrgInvitationRow[] } | { ok: false; error: string }
> {
  try {
    const session = await getRequiredSession();
    if (!assertOwnerOrAdmin(session.user.orgRole)) {
      return { ok: false, error: "Forbidden" };
    }
    const rows = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        status: invitations.status,
        createdAt: invitations.createdAt,
        expiresAt: invitations.expiresAt,
        token: invitations.token,
      })
      .from(invitations)
      .where(eq(invitations.organizationId, session.user.organizationId))
      .orderBy(desc(invitations.createdAt));

    return {
      ok: true,
      data: rows.map((r) => ({
        ...r,
        role: r.role as "admin" | "member",
        status: r.status as OrgInvitationRow["status"],
      })),
    };
  } catch (e) {
    console.error("getOrgInvitations", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "Failed to load invitations" };
  }
}

const singleInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
});

export async function createSingleInvitation(
  input: unknown
): Promise<{ ok: true; inviteLink: string } | { ok: false; error: string }> {
  const parsed = singleInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid email or role" };
  }
  const r = await createInvitations([parsed.data]);
  if (!r.ok) return r;
  const link = r.inviteLinks[0]?.url;
  if (!link) return { ok: false, error: "Failed to create invitation" };
  return { ok: true, inviteLink: link };
}

export async function cancelInvitation(invitationId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const idParsed = z.string().uuid().safeParse(invitationId);
  if (!idParsed.success) return { ok: false, error: "Invalid invitation" };
  try {
    const session = await getRequiredSession();
    if (!assertOwnerOrAdmin(session.user.orgRole)) {
      return { ok: false, error: "Forbidden" };
    }

    const wa = await requireWriteAccess();
    if (!wa.ok) return { ok: false, error: wa.error };

    const res = await db
      .update(invitations)
      .set({ status: "expired" })
      .where(
        and(
          eq(invitations.id, idParsed.data),
          eq(invitations.organizationId, session.user.organizationId),
          eq(invitations.status, "pending")
        )
      )
      .returning({ id: invitations.id });

    if (!res.length) return { ok: false, error: "Invitation not found or not pending" };

    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    console.error("cancelInvitation", e);
    return { ok: false, error: "Failed to cancel" };
  }
}

export async function resendInvitation(invitationId: string): Promise<
  { ok: true; inviteLink: string } | { ok: false; error: string }
> {
  const idParsed = z.string().uuid().safeParse(invitationId);
  if (!idParsed.success) return { ok: false, error: "Invalid invitation" };
  try {
    const session = await getRequiredSession();
    if (!assertOwnerOrAdmin(session.user.orgRole)) {
      return { ok: false, error: "Forbidden" };
    }

    const wa = await requireWriteAccess();
    if (!wa.ok) return { ok: false, error: wa.error };

    const newToken = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const res = await db
      .update(invitations)
      .set({ token: newToken, expiresAt })
      .where(
        and(
          eq(invitations.id, idParsed.data),
          eq(invitations.organizationId, session.user.organizationId),
          eq(invitations.status, "pending")
        )
      )
      .returning({ id: invitations.id });

    if (!res.length) return { ok: false, error: "Invitation not found or not pending" };

    revalidatePath("/dashboard/settings");
    return { ok: true, inviteLink: getInvitationPublicUrl(newToken) };
  } catch (e) {
    console.error("resendInvitation", e);
    return { ok: false, error: "Failed to resend" };
  }
}

/**
 * After agency login: attach user to any orgs they were invited to (pending, unexpired).
 * New memberships use `joined_at` older than existing ones so the session primary org (newest join) stays unchanged.
 */
export async function applyPendingInvitationsAfterLogin(): Promise<
  { ok: true; addedTo: string[] } | { ok: false }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false };
  if (session.user.role !== "admin" && session.user.role !== "member") {
    return { ok: false };
  }

  const email = session.user.email?.trim().toLowerCase();
  if (!email) return { ok: false };

  try {
    const pending = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.status, "pending"),
          gt(invitations.expiresAt, new Date())
        )
      );

    if (!pending.length) return { ok: true, addedTo: [] };

    const addedNames: string[] = [];

    for (const inv of pending) {
      const [already] = await db
        .select({ id: orgMembers.id })
        .from(orgMembers)
        .where(and(eq(orgMembers.userId, session.user.id), eq(orgMembers.organizationId, inv.organizationId)))
        .limit(1);
      if (already) continue;

      const [minRow] = await db
        .select({ m: min(orgMembers.joinedAt) })
        .from(orgMembers)
        .where(eq(orgMembers.userId, session.user.id));

      const joinedAt =
        minRow?.m != null ? new Date(new Date(minRow.m).getTime() - 1000) : new Date();

      await db.insert(orgMembers).values({
        userId: session.user.id,
        organizationId: inv.organizationId,
        role: inv.role,
        joinedAt,
      });
      await db.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, inv.id));

      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, inv.organizationId))
        .limit(1);
      if (org?.name) addedNames.push(org.name);
    }

    if (addedNames.length) {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/settings");
    }

    return { ok: true, addedTo: addedNames };
  } catch (e) {
    console.error("applyPendingInvitationsAfterLogin", e);
    return { ok: false };
  }
}
