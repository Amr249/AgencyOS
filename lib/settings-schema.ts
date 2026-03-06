import { z } from "zod";

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postal: z.string().optional(),
});

// Section 1 — Agency Profile
export const agencyProfileSchema = z.object({
  agencyName: z.string().optional(),
  agencyEmail: z.string().email().optional().or(z.literal("")),
  agencyWebsite: z.string().url().optional().or(z.literal("")),
  vatNumber: z.string().optional(),
  agencyLogoUrl: z.string().url().optional().or(z.literal("")),
  agencyAddress: addressSchema.optional(),
});

// Section 2 — Invoice Defaults
const currencyEnum = z.enum(["USD", "EUR", "GBP", "SAR", "AED", "EGP"]);
export const invoiceDefaultsSchema = z.object({
  invoicePrefix: z.string().optional(),
  invoiceNextNumber: z.number().int().min(1).optional(),
  defaultCurrency: currencyEnum.optional(),
  defaultPaymentTerms: z.enum(["0", "15", "30", "60"]).optional(),
  invoiceFooter: z.string().optional(),
});

// Section 3 — Branding (hex color)
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().or(z.literal(""));
export const brandingSchema = z.object({
  invoiceColor: hexColor.optional(),
});

// Section 4 — Change password (validate only; no DB update for now)
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmNewPassword: z.string().min(1, "Please confirm new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export type AgencyProfileInput = z.infer<typeof agencyProfileSchema>;
export type InvoiceDefaultsInput = z.infer<typeof invoiceDefaultsSchema>;
export type BrandingInput = z.infer<typeof brandingSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Shape of the single settings row (id = 1). Used by client and server. */
export type SettingsRow = {
  id: number;
  agencyName: string | null;
  agencyEmail: string | null;
  agencyWebsite: string | null;
  vatNumber: string | null;
  agencyLogoUrl: string | null;
  agencyAddress: { street?: string; city?: string; country?: string; postal?: string } | null;
  invoicePrefix: string | null;
  invoiceNextNumber: number | null;
  defaultCurrency: string | null;
  defaultPaymentTerms: number | null;
  invoiceFooter: string | null;
  invoiceColor: string | null;
};
