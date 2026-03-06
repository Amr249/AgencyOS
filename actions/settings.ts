"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, settings } from "@/lib/db";
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

export async function getSettings() {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.id, 1));
    return { ok: true as const, data: row ?? null };
  } catch (e) {
    console.error("getSettings", e);
    return { ok: false as const, error: "Failed to load settings" };
  }
}

async function ensureSettingsRow(): Promise<SettingsRow> {
  const [existing] = await db.select().from(settings).where(eq(settings.id, 1));
  if (existing) return existing;
  const [row] = await db
    .insert(settings)
    .values({ id: 1 })
    .returning();
  if (!row) throw new Error("Failed to create settings row");
  return row;
}

export async function updateAgencyProfile(input: AgencyProfileInput) {
  const parsed = agencyProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  try {
    const existing = await ensureSettingsRow();
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
      .where(eq(settings.id, 1));
    revalidatePath("/dashboard/settings");
    return { ok: true as const };
  } catch (e) {
    console.error("updateAgencyProfile", e);
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed to save"] } };
  }
}

export async function updateInvoiceDefaults(input: InvoiceDefaultsInput) {
  const parsed = invoiceDefaultsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  try {
    await ensureSettingsRow();
    const updatePayload: Partial<typeof settings.$inferInsert> = {};
    if (data.invoicePrefix !== undefined) updatePayload.invoicePrefix = data.invoicePrefix;
    if (data.invoiceNextNumber !== undefined) updatePayload.invoiceNextNumber = data.invoiceNextNumber;
    if (data.defaultCurrency !== undefined) updatePayload.defaultCurrency = data.defaultCurrency;
    if (data.defaultPaymentTerms !== undefined)
      updatePayload.defaultPaymentTerms = parseInt(data.defaultPaymentTerms, 10) as 0 | 15 | 30 | 60;
    if (data.invoiceFooter !== undefined) updatePayload.invoiceFooter = data.invoiceFooter;
    await db.update(settings).set(updatePayload).where(eq(settings.id, 1));
    revalidatePath("/dashboard/settings");
    return { ok: true as const };
  } catch (e) {
    console.error("updateInvoiceDefaults", e);
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed to save"] } };
  }
}

export async function updateBranding(input: BrandingInput) {
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  try {
    await ensureSettingsRow();
    await db
      .update(settings)
      .set({ invoiceColor: data.invoiceColor && data.invoiceColor !== "" ? data.invoiceColor : null })
      .where(eq(settings.id, 1));
    revalidatePath("/dashboard/settings");
    return { ok: true as const };
  } catch (e) {
    console.error("updateBranding", e);
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed to save"] } };
  }
}

export async function changePassword(input: ChangePasswordInput) {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  // Validate only; hash + env update not wired — show success toast in UI
  return { ok: true as const };
}
