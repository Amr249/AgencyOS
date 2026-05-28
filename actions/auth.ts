"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgMembers, organizations, settings, users } from "@/lib/db/schema";
import { findPostgresErrorCode } from "@/lib/db-errors";

const signUpSchema = z
  .object({
    name: z.string().min(1, "Full name is required").max(200),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    agencyName: z.string().min(1, "Agency or company name is required").max(200),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function baseSlug(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s.slice(0, 72) || "agency";
}

async function uniqueOrganizationSlug(base: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 12; i++) {
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    const suffix = Math.random().toString(36).slice(2, 8);
    candidate = `${base}-${suffix}`.slice(0, 80);
  }
  throw new Error("Could not allocate a unique organization slug");
}

export type SignUpFieldErrors = Record<string, string[] | undefined>;

export async function signUp(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: SignUpFieldErrors }> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors as SignUpFieldErrors };
  }
  const { name, email, password, agencyName } = parsed.data;
  const emailNorm = email.trim().toLowerCase();

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, emailNorm))
    .limit(1);
  if (existingUser) {
    return { ok: false, error: { email: ["An account with this email already exists"] } };
  }

  const slug = await uniqueOrganizationSlug(baseSlug(agencyName));
  const passwordHash = await bcrypt.hash(password, 12);
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);
  const now = new Date();

  let createdOrgId: string | null = null;
  try {
    const [org] = await db
      .insert(organizations)
      .values({
        name: agencyName.trim(),
        slug,
        plan: "starter",
        trialEndsAt,
        updatedAt: now,
      })
      .returning({ id: organizations.id });
    if (!org?.id) throw new Error("Failed to create organization");
    createdOrgId = org.id;

    const [user] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: emailNorm,
        passwordHash,
        role: "admin",
      })
      .returning({ id: users.id });
    if (!user?.id) throw new Error("Failed to create user");

    await db.insert(orgMembers).values({
      userId: user.id,
      organizationId: org.id,
      role: "owner",
      joinedAt: now,
    });

    await db.insert(settings).values({
      organizationId: org.id,
      agencyName: agencyName.trim(),
    });
  } catch (e) {
    if (createdOrgId) {
      try {
        await db.delete(organizations).where(eq(organizations.id, createdOrgId));
      } catch (cleanupErr) {
        console.error("signUp: failed to remove orphan organization", createdOrgId, cleanupErr);
      }
    }
    console.error("signUp", e);
    const pg = findPostgresErrorCode(e);
    if (pg === "23505") {
      return {
        ok: false,
        error: { email: ["An account with this email already exists"] },
      };
    }
    const msg = e instanceof Error ? e.message : String(e);
    const looksLikeMissingColumn =
      /column .* does not exist/i.test(msg) ||
      (typeof msg === "string" && msg.includes("42703"));
    if (looksLikeMissingColumn) {
      return {
        ok: false,
        error: {
          _form: [
            "The database is missing required columns (often password_hash on users). Apply pending migrations on the server (e.g. drizzle/0039_users_password_theme.sql), then try again.",
          ],
        },
      };
    }
    return {
      ok: false,
      error: { _form: [msg || "Sign up failed"] },
    };
  }

  return { ok: true };
}
