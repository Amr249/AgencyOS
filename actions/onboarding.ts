"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, settings } from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { ensureSettingsForOrganization } from "@/lib/db/default-organization";
import { getRequiredSession } from "@/lib/session";
import { requireWriteAccess, trialExpiredForm, trialExpiredPlain } from "@/lib/trial";

const profileSchema = z.object({
  agencyName: z.string().min(1, "Agency name is required").max(200),
  agencyLogoUrl: z.string().url().optional().or(z.literal("")),
  agencyEmail: z.string().email("Invalid email"),
  agencyWebsite: z.string().url().optional().or(z.literal("")),
  country: z.string().min(1).max(120),
  currency: z.enum(["SAR", "USD", "EUR", "EGP", "AED"]),
});

const invoiceSchema = z.object({
  invoicePrefix: z.string().min(1).max(32),
  vatNumber: z.string().max(80).optional().or(z.literal("")),
  defaultPaymentTerms: z.enum(["0", "15", "30", "60"]),
});

function assertLeader(orgRole: string | undefined): boolean {
  return orgRole === "owner" || orgRole === "admin";
}

export type OnboardingStatePayload = {
  onboardingCompleted: boolean;
  onboardingStep: number;
  agencyName: string;
  agencyLogoUrl: string | null;
  agencyEmail: string | null;
  agencyWebsite: string | null;
  country: string | null;
  defaultCurrency: string | null;
  invoicePrefix: string | null;
  vatNumber: string | null;
  defaultPaymentTerms: number | null;
  userEmail: string;
  orgRole: string;
};

export async function getOnboardingState(): Promise<
  { ok: true; data: OnboardingStatePayload } | { ok: false; error: string }
> {
  try {
    const session = await getRequiredSession();
    const orgRole = session.user.orgRole;
    if (!assertLeader(orgRole)) {
      return { ok: false, error: "forbidden" };
    }

    const organizationId = session.user.organizationId;
    const [org] = await db
      .select({
        onboardingCompleted: organizations.onboardingCompleted,
        onboardingStep: organizations.onboardingStep,
        name: organizations.name,
        logoUrl: organizations.logoUrl,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!org) return { ok: false, error: "Organization not found" };

    const row = await ensureSettingsForOrganization(organizationId);
    const country =
      row.agencyAddress && typeof row.agencyAddress === "object"
        ? ((row.agencyAddress as { country?: string }).country ?? null)
        : null;

    return {
      ok: true,
      data: {
        onboardingCompleted: org.onboardingCompleted,
        onboardingStep: Math.min(4, Math.max(1, org.onboardingStep)),
        agencyName: row.agencyName?.trim() || org.name,
        agencyLogoUrl: row.agencyLogoUrl ?? org.logoUrl ?? null,
        agencyEmail: row.agencyEmail ?? session.user.email ?? null,
        agencyWebsite: row.agencyWebsite,
        country: country ?? "SA",
        defaultCurrency: row.defaultCurrency ?? "SAR",
        invoicePrefix: row.invoicePrefix ?? "INV",
        vatNumber: row.vatNumber,
        defaultPaymentTerms: row.defaultPaymentTerms ?? 30,
        userEmail: session.user.email ?? "",
        orgRole,
      },
    };
  } catch (e) {
    console.error("getOnboardingState", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "Failed to load onboarding" };
  }
}

export async function updateOnboardingProfile(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: Record<string, string[]> | string }> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const session = await getRequiredSession();
    if (!assertLeader(session.user.orgRole)) {
      return { ok: false, error: "Forbidden" };
    }

    const wa = await requireWriteAccess();
    if (!wa.ok) return trialExpiredForm();

    const d = parsed.data;
    const organizationId = session.user.organizationId;
    const existing = await ensureSettingsForOrganization(organizationId);
    const prevAddr =
      existing.agencyAddress && typeof existing.agencyAddress === "object"
        ? (existing.agencyAddress as Record<string, unknown>)
        : {};
    const agencyAddress = {
      ...prevAddr,
      country: d.country,
    };

    const now = new Date();
    // neon-http: no transactions — run updates in order (same effect for this use case).
    await db
      .update(organizations)
      .set({
        name: d.agencyName.trim(),
        logoUrl: d.agencyLogoUrl && d.agencyLogoUrl.length > 0 ? d.agencyLogoUrl : null,
        updatedAt: now,
        onboardingStep: sql`GREATEST(${organizations.onboardingStep}, 2)`,
      })
      .where(eq(organizations.id, organizationId));

    await db
      .update(settings)
      .set({
        agencyName: d.agencyName.trim(),
        agencyEmail: d.agencyEmail.trim(),
        agencyWebsite: d.agencyWebsite && d.agencyWebsite.length > 0 ? d.agencyWebsite : null,
        agencyLogoUrl: d.agencyLogoUrl && d.agencyLogoUrl.length > 0 ? d.agencyLogoUrl : null,
        agencyAddress,
        defaultCurrency: d.currency,
      })
      .where(eq(settings.organizationId, organizationId));

    revalidatePath("/dashboard/onboarding");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    console.error("updateOnboardingProfile", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}

export async function updateOnboardingInvoice(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: Record<string, string[]> | string }> {
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const session = await getRequiredSession();
    if (!assertLeader(session.user.orgRole)) {
      return { ok: false, error: "Forbidden" };
    }

    const wa = await requireWriteAccess();
    if (!wa.ok) return trialExpiredForm();

    const d = parsed.data;
    const organizationId = session.user.organizationId;
    const terms = parseInt(d.defaultPaymentTerms, 10) as 0 | 15 | 30 | 60;
    await ensureSettingsForOrganization(organizationId);
    const now = new Date();
    await db
      .update(settings)
      .set({
        invoicePrefix: d.invoicePrefix.trim(),
        vatNumber: d.vatNumber && d.vatNumber.length > 0 ? d.vatNumber : null,
        defaultPaymentTerms: terms,
      })
      .where(eq(settings.organizationId, organizationId));

    await db
      .update(organizations)
      .set({
        updatedAt: now,
        onboardingStep: sql`GREATEST(${organizations.onboardingStep}, 3)`,
      })
      .where(eq(organizations.id, organizationId));

    revalidatePath("/dashboard/onboarding");
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    console.error("updateOnboardingInvoice", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}

export async function setOnboardingStep(
  step: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = Math.min(4, Math.max(1, Math.floor(step)));
  try {
    const session = await getRequiredSession();
    if (!assertLeader(session.user.orgRole)) {
      return { ok: false, error: "Forbidden" };
    }

    const wa = await requireWriteAccess();
    if (!wa.ok) return trialExpiredPlain();

    await db
      .update(organizations)
      .set({ onboardingStep: s, updatedAt: new Date() })
      .where(eq(organizations.id, session.user.organizationId));

    revalidatePath("/dashboard/onboarding");
    return { ok: true };
  } catch (e) {
    console.error("setOnboardingStep", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "Failed" };
  }
}

export async function completeOnboarding(organizationId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const idParsed = z.string().uuid().safeParse(organizationId);
  if (!idParsed.success) return { ok: false, error: "Invalid organization" };
  try {
    const session = await getRequiredSession();
    if (session.user.organizationId !== idParsed.data) {
      return { ok: false, error: "Forbidden" };
    }
    if (!assertLeader(session.user.orgRole)) {
      return { ok: false, error: "Forbidden" };
    }

    const wa = await requireWriteAccess();
    if (!wa.ok) return trialExpiredPlain();

    await db
      .update(organizations)
      .set({
        onboardingCompleted: true,
        onboardingStep: 4,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, session.user.organizationId));

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/onboarding");
    return { ok: true };
  } catch (e) {
    console.error("completeOnboarding", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to complete" };
  }
}
