"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { notifyUserAndAdmins } from "@/actions/notifications";

type ErrorCode =
  | "unauthorized"
  | "validation"
  | "email_exists"
  | "wrong_current_password"
  | "not_found"
  | "unknown"
  | string;

async function requireSessionUserId(): Promise<
  { ok: true; userId: string; name: string; email: string } | { ok: false; error: "unauthorized" }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  return {
    ok: true,
    userId: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}

export type MyAccount = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  themePreference: string | null;
  role: "admin" | "member";
};

export async function getMyAccount(): Promise<
  { ok: true; data: MyAccount } | { ok: false; error: ErrorCode }
> {
  const gate = await requireSessionUserId();
  if (!gate.ok) return { ok: false, error: gate.error };
  try {
    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        themePreference: users.themePreference,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, gate.userId))
      .limit(1);
    if (!row) return { ok: false, error: "not_found" };
    return {
      ok: true,
      data: {
        id: row.id,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatarUrl,
        themePreference: row.themePreference,
        role: row.role as "admin" | "member",
      },
    };
  } catch (e) {
    console.error("getMyAccount", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

const updateNameSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function updateMyName(
  input: z.infer<typeof updateNameSchema>
): Promise<{ ok: true } | { ok: false; error: ErrorCode }> {
  const gate = await requireSessionUserId();
  if (!gate.ok) return { ok: false, error: gate.error };
  const parsed = updateNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const nextName = parsed.data.name.trim();
  if (nextName === gate.name) {
    return { ok: true };
  }

  try {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, gate.userId))
      .limit(1);
    if (!row) return { ok: false, error: "not_found" };

    await db.update(users).set({ name: nextName }).where(eq(users.id, gate.userId));

    await notifyUserAndAdmins({
      targetUserId: gate.userId,
      actorId: gate.userId,
      type: "profile.name_changed",
      title: "تم تحديث الاسم",
      body: `${gate.name || "مستخدم"} غيّر اسمه إلى «${nextName}».`,
      linkUrl: "/dashboard/account",
    });

    revalidatePath("/dashboard/account");
    revalidatePath("/dashboard/settings/users");
    return { ok: true };
  } catch (e) {
    console.error("updateMyName", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

const updateEmailSchema = z.object({
  email: z.string().email().max(320),
});

export async function updateMyEmail(
  input: z.infer<typeof updateEmailSchema>
): Promise<{ ok: true } | { ok: false; error: ErrorCode }> {
  const gate = await requireSessionUserId();
  if (!gate.ok) return { ok: false, error: gate.error };
  const parsed = updateEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const emailNorm = parsed.data.email.trim().toLowerCase();
  try {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, emailNorm), ne(users.id, gate.userId)))
      .limit(1);
    if (existing) return { ok: false, error: "email_exists" };

    if (emailNorm === gate.email.toLowerCase()) {
      return { ok: true };
    }

    await db.update(users).set({ email: emailNorm }).where(eq(users.id, gate.userId));

    await notifyUserAndAdmins({
      targetUserId: gate.userId,
      actorId: gate.userId,
      type: "profile.email_changed",
      title: "تم تحديث البريد الإلكتروني",
      body: `${gate.name || "مستخدم"} غيّر بريده الإلكتروني إلى ${emailNorm}.`,
      linkUrl: "/dashboard/account",
    });

    revalidatePath("/dashboard/account");
    revalidatePath("/dashboard/settings/users");
    return { ok: true };
  } catch (e) {
    console.error("updateMyEmail", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "email_exists" };
    }
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export async function updateMyPassword(
  input: z.infer<typeof updatePasswordSchema>
): Promise<{ ok: true } | { ok: false; error: ErrorCode }> {
  const gate = await requireSessionUserId();
  if (!gate.ok) return { ok: false, error: gate.error };
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const [row] = await db
      .select({ id: users.id, passwordHash: users.passwordHash, name: users.name })
      .from(users)
      .where(eq(users.id, gate.userId))
      .limit(1);
    if (!row) return { ok: false, error: "not_found" };

    const valid = await bcrypt.compare(parsed.data.currentPassword, row.passwordHash);
    if (!valid) return { ok: false, error: "wrong_current_password" };

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, gate.userId));

    await notifyUserAndAdmins({
      targetUserId: gate.userId,
      actorId: gate.userId,
      type: "profile.password_changed",
      title: "تم تغيير كلمة المرور",
      body: `${row.name || "مستخدم"} قام بتحديث كلمة المرور الخاصة به.`,
      linkUrl: "/dashboard/account",
    });

    revalidatePath("/dashboard/account");
    return { ok: true };
  } catch (e) {
    console.error("updateMyPassword", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

const updateAvatarSchema = z.object({
  avatarUrl: z.string().url().max(1024).nullable(),
});

export async function updateMyAvatar(
  input: z.infer<typeof updateAvatarSchema>
): Promise<{ ok: true } | { ok: false; error: ErrorCode }> {
  const gate = await requireSessionUserId();
  if (!gate.ok) return { ok: false, error: gate.error };
  const parsed = updateAvatarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const [row] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, gate.userId))
      .limit(1);

    await db
      .update(users)
      .set({ avatarUrl: parsed.data.avatarUrl })
      .where(eq(users.id, gate.userId));

    await notifyUserAndAdmins({
      targetUserId: gate.userId,
      actorId: gate.userId,
      type: "profile.avatar_changed",
      title: parsed.data.avatarUrl ? "تم تحديث الصورة الشخصية" : "تمت إزالة الصورة الشخصية",
      body: `${row?.name || "مستخدم"} قام بتحديث صورته الشخصية.`,
      linkUrl: "/dashboard/account",
    });

    revalidatePath("/dashboard/account");
    return { ok: true };
  } catch (e) {
    console.error("updateMyAvatar", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

const updateThemeSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
});

export async function updateMyThemePreference(
  input: z.infer<typeof updateThemeSchema>
): Promise<{ ok: true } | { ok: false; error: ErrorCode }> {
  const gate = await requireSessionUserId();
  if (!gate.ok) return { ok: false, error: gate.error };
  const parsed = updateThemeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    await db
      .update(users)
      .set({ themePreference: parsed.data.theme })
      .where(eq(users.id, gate.userId));
    revalidatePath("/dashboard/account");
    return { ok: true };
  } catch (e) {
    console.error("updateMyThemePreference", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}
