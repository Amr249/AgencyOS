"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, settings, users } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import {
  agencyProfileSchema,
  invoiceDefaultsSchema,
  brandingSchema,
  changePasswordSchema,
  type AgencyProfileInput,
  type InvoiceDefaultsInput,
  type BrandingInput,
  type ChangePasswordInput,
  type SettingsRow,
} from "@/lib/settings-schema";
import { assertAdminSession } from "@/lib/auth-helpers";
import { ensureSettingsForOrganization } from "@/lib/db/default-organization";
import { getRequiredSession } from "@/lib/session";
import { requireAgencyOrganization, requireAgencyWriteContext } from "@/lib/org-session";
import { trialExpiredForm } from "@/lib/trial";

export async function getSettings() {
  try {
    const ctx = await requireAgencyOrganization();
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.organizationId, ctx.organizationId))
      .limit(1);
    return { ok: true as const, data: row ?? null };
  } catch (e) {
    console.error("getSettings", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load settings" };
  }
}

async function ensureSettingsRow(orgId: string): Promise<SettingsRow> {
  const row = await ensureSettingsForOrganization(orgId);
  return row as SettingsRow;
}

export async function updateAgencyProfile(input: AgencyProfileInput) {
  const parsed = agencyProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const gate = await assertAdminSession();
  if (!gate.ok) {
    return {
      ok: false as const,
      error: { _form: [gate.error === "forbidden" ? "Forbidden" : "Unauthorized"] },
    };
  }
  const data = parsed.data;
  try {
    const wctx = await requireAgencyWriteContext();
    if (!wctx.ok) return trialExpiredForm();
    const orgId = wctx.organizationId;
    const existing = await ensureSettingsRow(orgId);
    const agencyAddress = data.agencyAddress
      ? {
          street: data.agencyAddress.street || undefined,
          city: data.agencyAddress.city || undefined,
          country: data.agencyAddress.country || undefined,
          postal: data.agencyAddress.postal || undefined,
        }
      : existing.agencyAddress ?? undefined;
    await db
      .update(settings)
      .set({
        agencyName: data.agencyName !== undefined ? data.agencyName : existing.agencyName,
        agencyEmail: data.agencyEmail !== undefined ? (data.agencyEmail || null) : existing.agencyEmail,
        agencyWebsite: data.agencyWebsite !== undefined ? (data.agencyWebsite || null) : existing.agencyWebsite,
        vatNumber: data.vatNumber !== undefined ? data.vatNumber : existing.vatNumber,
        agencyLogoUrl: data.agencyLogoUrl !== undefined ? (data.agencyLogoUrl || null) : existing.agencyLogoUrl,
        agencyAddress: agencyAddress ?? null,
      })
      .where(eq(settings.organizationId, orgId));
    revalidatePath("/dashboard/settings");
    return { ok: true as const };
  } catch (e) {
    console.error("updateAgencyProfile", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] } };
  }
}

export async function updateInvoiceDefaults(input: InvoiceDefaultsInput) {
  const parsed = invoiceDefaultsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const gate = await assertAdminSession();
  if (!gate.ok) {
    return {
      ok: false as const,
      error: { _form: [gate.error === "forbidden" ? "Forbidden" : "Unauthorized"] },
    };
  }
  const data = parsed.data;
  try {
    const wctx = await requireAgencyWriteContext();
    if (!wctx.ok) return trialExpiredForm();
    const orgId = wctx.organizationId;
    await ensureSettingsRow(orgId);
    const updatePayload: Partial<typeof settings.$inferInsert> = {};
    if (data.invoicePrefix !== undefined) updatePayload.invoicePrefix = data.invoicePrefix;
    if (data.invoiceNextNumber !== undefined) updatePayload.invoiceNextNumber = data.invoiceNextNumber;
    if (data.defaultCurrency !== undefined) updatePayload.defaultCurrency = data.defaultCurrency;
    if (data.defaultPaymentTerms !== undefined)
      updatePayload.defaultPaymentTerms = parseInt(data.defaultPaymentTerms, 10) as 0 | 15 | 30 | 60;
    if (data.invoiceFooter !== undefined) updatePayload.invoiceFooter = data.invoiceFooter;
    await db.update(settings).set(updatePayload).where(eq(settings.organizationId, orgId));
    revalidatePath("/dashboard/settings");
    return { ok: true as const };
  } catch (e) {
    console.error("updateInvoiceDefaults", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] } };
  }
}

export async function updateBranding(input: BrandingInput) {
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const gate = await assertAdminSession();
  if (!gate.ok) {
    return {
      ok: false as const,
      error: { _form: [gate.error === "forbidden" ? "Forbidden" : "Unauthorized"] },
    };
  }
  const data = parsed.data;
  try {
    const wctx = await requireAgencyWriteContext();
    if (!wctx.ok) return trialExpiredForm();
    const orgId = wctx.organizationId;
    await ensureSettingsRow(orgId);
    await db
      .update(settings)
      .set({ invoiceColor: data.invoiceColor && data.invoiceColor !== "" ? data.invoiceColor : null })
      .where(eq(settings.organizationId, orgId));
    revalidatePath("/dashboard/settings");
    return { ok: true as const };
  } catch (e) {
    console.error("updateBranding", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] } };
  }
}

export async function changePassword(input: ChangePasswordInput) {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  try {
    const session = await getRequiredSession();
    const wctx = await requireAgencyWriteContext();
    if (!wctx.ok) return trialExpiredForm();

    const [userRow] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (!userRow?.passwordHash) {
      return {
        ok: false as const,
        error: { _form: ["Password change is not available for this account"] },
      };
    }

    const currentOk = await bcrypt.compare(parsed.data.currentPassword, userRow.passwordHash);
    if (!currentOk) {
      return {
        ok: false as const,
        error: { currentPassword: ["Current password is incorrect"] },
      };
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.update(users).set({ passwordHash }).where(eq(users.id, session.user.id));

    revalidatePath("/dashboard/settings");
    return { ok: true as const };
  } catch (e) {
    console.error("changePassword", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Failed to change password"] },
    };
  }
}
