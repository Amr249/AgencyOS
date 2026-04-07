"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateAgencyProfile,
  updateInvoiceDefaults,
  updateBranding,
} from "@/actions/settings";
import {
  changePasswordSchema,
  type AgencyProfileInput,
  type InvoiceDefaultsInput,
  type BrandingInput,
} from "@/lib/settings-schema";
import { toast } from "sonner";
import type { settings } from "@/lib/db/schema";
import type { AddressJson } from "@/lib/db/schema";

type SettingsRow = typeof settings.$inferSelect;

const PAYMENT_TERMS_OPTIONS = [
  { value: 0, label: "Due on receipt" },
  { value: 15, label: "Net 15" },
  { value: 30, label: "Net 30" },
  { value: 60, label: "Net 60" },
] as const;

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "SAR", "AED", "EGP"] as const;

export function SettingsSections({
  initial,
  adminEmail,
}: {
  initial: SettingsRow | null;
  adminEmail: string;
}) {
  const addr = (initial?.agencyAddress as AddressJson | null) ?? {};

  // Section 1 — Agency Profile
  const [agencyName, setAgencyName] = React.useState(initial?.agencyName ?? "");
  const [agencyEmail, setAgencyEmail] = React.useState(initial?.agencyEmail ?? "");
  const [agencyWebsite, setAgencyWebsite] = React.useState(initial?.agencyWebsite ?? "");
  const [vatNumber, setVatNumber] = React.useState(initial?.vatNumber ?? "");
  const [agencyLogoUrl, setAgencyLogoUrl] = React.useState(initial?.agencyLogoUrl ?? "");
  const [street, setStreet] = React.useState(addr.street ?? "");
  const [city, setCity] = React.useState(addr.city ?? "");
  const [country, setCountry] = React.useState(addr.country ?? "");
  const [postal, setPostal] = React.useState(addr.postal ?? "");
  const [logoUploading, setLogoUploading] = React.useState(false);

  const saveAgencyProfile = async () => {
    const payload: AgencyProfileInput = {
      agencyName: agencyName || undefined,
      agencyEmail: agencyEmail || undefined,
      agencyWebsite: agencyWebsite || undefined,
      vatNumber: vatNumber || undefined,
      agencyLogoUrl: agencyLogoUrl || undefined,
      agencyAddress: { street: street || undefined, city: city || undefined, country: country || undefined, postal: postal || undefined },
    };
    const result = await updateAgencyProfile(payload);
    if (result.ok) {
      toast.success("Agency profile saved");
    } else {
      const err = "error" in result ? result.error : "Failed to save";
      const msg = typeof err === "object" ? Object.values(err).flat().join(" ") : err;
      toast.error(msg || "Failed to save");
    }
  };

  const onLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("scope", "agency-logo");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (data.url) {
        setAgencyLogoUrl(data.url);
        const result = await updateAgencyProfile({ agencyLogoUrl: data.url });
        if (result.ok) toast.success("Logo updated");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  };

  // Section 2 — Invoice Defaults
  const [invoicePrefix, setInvoicePrefix] = React.useState(initial?.invoicePrefix ?? "INV");
  const [invoiceNextNumber, setInvoiceNextNumber] = React.useState(
    initial?.invoiceNextNumber ?? 1
  );
  const [defaultCurrency, setDefaultCurrency] = React.useState(
    (initial?.defaultCurrency as string) ?? "USD"
  );
  const [defaultPaymentTerms, setDefaultPaymentTerms] = React.useState(
    initial?.defaultPaymentTerms ?? 30
  );
  const [invoiceFooter, setInvoiceFooter] = React.useState(initial?.invoiceFooter ?? "");

  const saveInvoiceDefaults = async () => {
    const payload: InvoiceDefaultsInput = {
      invoicePrefix: invoicePrefix || undefined,
      invoiceNextNumber,
      defaultCurrency: defaultCurrency as InvoiceDefaultsInput["defaultCurrency"],
      defaultPaymentTerms: String(defaultPaymentTerms) as "0" | "15" | "30" | "60",
      invoiceFooter: invoiceFooter || undefined,
    };
    const result = await updateInvoiceDefaults(payload);
    if (result.ok) {
      toast.success("Invoice defaults saved");
    } else {
      const err = "error" in result ? result.error : "Failed to save";
      const msg = typeof err === "object" ? Object.values(err).flat().join(" ") : err;
      toast.error(msg || "Failed to save");
    }
  };

  // Section 3 — Branding
  const [invoiceColor, setInvoiceColor] = React.useState(
    initial?.invoiceColor ?? "#2563eb"
  );

  const saveBranding = async () => {
    const payload: BrandingInput = { invoiceColor: invoiceColor || undefined };
    const result = await updateBranding(payload);
    if (result.ok) {
      toast.success("Branding saved");
    } else {
      toast.error("Failed to save branding");
    }
  };

  // Section 4 — Account
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const savePassword = async () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmNewPassword: confirmPassword,
    });
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join(" ");
      toast.error(msg);
      return;
    }
    // Not wired to backend: show success toast only
    toast.success("Password change requested. Update ADMIN_PASSWORD_HASH in your environment and restart the server to apply.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="space-y-8">
      {/* Section 1 — Agency Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Agency Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="agencyName">Agency name</Label>
            <Input
              id="agencyName"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Your Agency"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agencyEmail">Agency email</Label>
            <Input
              id="agencyEmail"
              type="email"
              value={agencyEmail}
              onChange={(e) => setAgencyEmail(e.target.value)}
              placeholder="hello@agency.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agencyWebsite">Website</Label>
            <Input
              id="agencyWebsite"
              type="url"
              value={agencyWebsite}
              onChange={(e) => setAgencyWebsite(e.target.value)}
              placeholder="https://agency.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vatNumber">VAT / Tax number</Label>
            <Input
              id="vatNumber"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="VAT number"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-2">
              <Label>Agency logo</Label>
              <div className="flex items-center gap-3">
                {agencyLogoUrl ? (
                  <img
                    src={agencyLogoUrl}
                    alt="Agency logo"
                    className="h-16 w-16 rounded-md border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-muted-foreground text-xs">
                    No logo
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  className="cursor-pointer max-w-[200px]"
                  disabled={logoUploading}
                  onChange={onLogoChange}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="street">Street</Label>
              <Input
                id="street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Street"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="postal">Postal code</Label>
              <Input
                id="postal"
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
                placeholder="Postal code"
              />
            </div>
          </div>
          <Button type="button" onClick={saveAgencyProfile}>
            Save Agency Profile
          </Button>
        </CardContent>
      </Card>

      {/* Section 2 — Invoice Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="invoicePrefix">Invoice number prefix</Label>
            <div className="flex items-center gap-2">
              <Input
                id="invoicePrefix"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="INV"
                className="max-w-[120px]"
              />
              <span className="text-muted-foreground text-sm">
                Preview: {invoicePrefix || "INV"}-{String(invoiceNextNumber).padStart(3, "0")}
              </span>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invoiceNextNumber">Next invoice number</Label>
            <Input
              id="invoiceNextNumber"
              type="number"
              min={0}
              value={invoiceNextNumber}
              onChange={(e) => setInvoiceNextNumber(Number(e.target.value) || 0)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Default currency</Label>
            <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Default payment terms</Label>
            <Select
              value={String(defaultPaymentTerms)}
              onValueChange={(v) => setDefaultPaymentTerms(Number(v))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={String(value)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invoiceFooter">Invoice footer / payment instructions</Label>
            <Textarea
              id="invoiceFooter"
              value={invoiceFooter}
              onChange={(e) => setInvoiceFooter(e.target.value)}
              placeholder="Payment terms, bank details..."
              className="min-h-[80px] resize-none"
            />
          </div>
          <Button type="button" onClick={saveInvoiceDefaults}>
            Save Invoice Defaults
          </Button>
        </CardContent>
      </Card>

      {/* Section 3 — Branding */}
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid gap-2">
              <Label htmlFor="invoiceColor">Primary color for invoice PDF</Label>
              <div className="flex items-center gap-2">
                <input
                  id="invoiceColor"
                  type="color"
                  value={invoiceColor}
                  onChange={(e) => setInvoiceColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-input"
                />
                <Input
                  value={invoiceColor}
                  onChange={(e) => setInvoiceColor(e.target.value)}
                  placeholder="#2563eb"
                  className="font-mono max-w-[120px]"
                />
              </div>
            </div>
            <div
              className="h-12 w-24 rounded-md border-2 border-border"
              style={{ backgroundColor: invoiceColor }}
              title="Preview"
            />
          </div>
          <Button type="button" onClick={saveBranding}>
            Save Branding
          </Button>
        </CardContent>
      </Card>

      {/* Section 4 — Account */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Admin email</Label>
            <Input value={adminEmail} readOnly className="bg-muted" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="button" onClick={savePassword}>
            Save password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
