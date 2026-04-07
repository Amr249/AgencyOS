"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  updateAgencyProfile,
  updateInvoiceDefaults,
  updateBranding,
  changePassword,
} from "@/actions/settings";
import { migrateLegacyPaidInvoicePayments } from "@/actions/invoices";
import {
  agencyProfileSchema,
  invoiceDefaultsSchema,
  brandingSchema,
  changePasswordSchema,
  type SettingsRow,
} from "@/lib/settings-schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { ThemeSelector } from "@/components/theme-selector";

type AgencyProfileValues = z.infer<typeof agencyProfileSchema>;
type InvoiceDefaultsValues = z.infer<typeof invoiceDefaultsSchema>;
type BrandingValues = z.infer<typeof brandingSchema>;
type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

const CURRENCIES = ["USD", "EUR", "GBP", "SAR", "AED", "EGP"] as const;
const PAYMENT_TERMS = [
  { value: "0", label: "Due on receipt" },
  { value: "15", label: "Net 15" },
  { value: "30", label: "Net 30" },
  { value: "60", label: "Net 60" },
] as const;

type SettingsContentProps = {
  initial: SettingsRow | null;
  adminEmail: string;
  isAdmin?: boolean;
};

export function SettingsContent({ initial, adminEmail, isAdmin = false }: SettingsContentProps) {
  const s = initial;

  // Section 1 — Agency Profile
  const agencyForm = useForm<AgencyProfileValues>({
    resolver: zodResolver(agencyProfileSchema),
    defaultValues: {
      agencyName: s?.agencyName ?? "",
      agencyEmail: s?.agencyEmail ?? "",
      agencyWebsite: s?.agencyWebsite ?? "",
      vatNumber: s?.vatNumber ?? "",
      agencyLogoUrl: s?.agencyLogoUrl ?? "",
      agencyAddress: {
        street: s?.agencyAddress?.street ?? "",
        city: s?.agencyAddress?.city ?? "",
        country: s?.agencyAddress?.country ?? "",
        postal: s?.agencyAddress?.postal ?? "",
      },
    },
  });
  const [logoUploading, setLogoUploading] = React.useState(false);
  const [migratingPayments, setMigratingPayments] = React.useState(false);

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
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
      if (data.url) agencyForm.setValue("agencyLogoUrl", data.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  async function onAgencySubmit(values: AgencyProfileValues) {
    const result = await updateAgencyProfile(values);
    if (result.ok) {
      toast.success("تم حفظ ملف الوكالة");
    } else {
      const err = result.error as { _form?: string[] } | Record<string, string[]>;
      const msg = err?._form?.[0] ?? (typeof err === "object" ? Object.values(err ?? {}).flat().join(", ") : String(err));
      toast.error(msg);
    }
  }

  // Section 2 — Invoice Defaults
  const invoiceForm = useForm<InvoiceDefaultsValues>({
    resolver: zodResolver(invoiceDefaultsSchema),
    defaultValues: {
      invoicePrefix: s?.invoicePrefix ?? "INV",
      invoiceNextNumber: s?.invoiceNextNumber ?? 1,
      defaultCurrency: (s?.defaultCurrency ?? "USD") as (typeof CURRENCIES)[number],
      defaultPaymentTerms: String(s?.defaultPaymentTerms ?? 30) as "0" | "15" | "30" | "60",
      invoiceFooter: s?.invoiceFooter ?? "",
    },
  });
  const prefix = invoiceForm.watch("invoicePrefix") || "INV";
  const nextNum = invoiceForm.watch("invoiceNextNumber") ?? 1;
  const invoicePreview = `${prefix}-${String(nextNum).padStart(3, "0")}`;

  async function onInvoiceSubmit(values: InvoiceDefaultsValues) {
    const result = await updateInvoiceDefaults(values);
    if (result.ok) {
      toast.success("Invoice settings saved");
    } else {
      const err = result.error as { _form?: string[] } | Record<string, string[]>;
      const msg = err?._form?.[0] ?? Object.values(err ?? {}).flat().join(", ");
      toast.error(msg);
    }
  }

  // Section 3 — Branding
  const brandingForm = useForm<BrandingValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      invoiceColor: s?.invoiceColor ?? "#000000",
    },
  });
  const primaryColor = brandingForm.watch("invoiceColor") || "#000000";

  async function onBrandingSubmit(values: BrandingValues) {
    const result = await updateBranding(values);
    if (result.ok) {
      toast.success("Branding saved");
    } else {
      const err = result.error as { _form?: string[] } | Record<string, string[]>;
      const msg = err?._form?.[0] ?? Object.values(err ?? {}).flat().join(", ");
      toast.error(msg);
    }
  }

  // Section 4 — Account
  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  async function onPasswordSubmit(values: ChangePasswordValues) {
    const result = await changePassword(values);
    if (result.ok) {
      toast.success("Password updated successfully");
      passwordForm.reset({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } else {
      const msg = result.error.confirmNewPassword?.[0] ?? result.error.newPassword?.[0] ?? result.error.currentPassword?.[0] ?? "Failed to update password";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-8">
      {/* Section 0 — Appearance (Theme) */}
      <section>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-right">المظهر</h3>
            <p className="text-sm text-muted-foreground text-right">اختر مظهر التطبيق المناسب لك</p>
          </div>
          <ThemeSelector />
        </div>
      </section>

      {/* Section 1 — Agency Profile */}
      <section>
        <h3 className="text-lg font-semibold mb-2">معلومات الوكالة</h3>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تفاصيل الملف</CardTitle>
            <CardDescription>اسم الوكالة، جهة الاتصال والعنوان.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...agencyForm}>
              <form onSubmit={agencyForm.handleSubmit(onAgencySubmit)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={agencyForm.control}
                    name="agencyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم الوكالة</FormLabel>
                        <FormControl>
                          <Input placeholder="اسم الوكالة" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={agencyForm.control}
                    name="agencyEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>البريد الإلكتروني</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="hello@acme.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={agencyForm.control}
                  name="agencyWebsite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الموقع</FormLabel>
                      <FormControl>
                        <Input placeholder="https://acme.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={agencyForm.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الرقم الضريبي</FormLabel>
                      <FormControl>
                        <Input placeholder="VAT123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={agencyForm.control}
                  name="agencyLogoUrl"
                  render={() => (
                    <FormItem>
                      <FormLabel>شعار الوكالة</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-3">
                          {agencyForm.watch("agencyLogoUrl") && (
                            <img
                              src={agencyForm.watch("agencyLogoUrl")!}
                              alt="Agency logo"
                              className="h-14 w-14 rounded border object-cover"
                            />
                          )}
                          <Input
                            type="file"
                            accept="image/*"
                            className="cursor-pointer max-w-[200px]"
                            disabled={logoUploading}
                            onChange={onLogoChange}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={agencyForm.control}
                    name="agencyAddress.street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={agencyForm.control}
                    name="agencyAddress.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="New York" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={agencyForm.control}
                    name="agencyAddress.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="USA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={agencyForm.control}
                    name="agencyAddress.postal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal code</FormLabel>
                        <FormControl>
                          <Input placeholder="10001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" disabled={agencyForm.formState.isSubmitting}>
                  {agencyForm.formState.isSubmitting ? "جاري الحفظ…" : "حفظ"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>

      {/* Section 2 — Invoice Defaults */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Invoice settings</h3>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Defaults for new invoices</CardTitle>
            <CardDescription>Prefix, next number, currency, and payment terms.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...invoiceForm}>
              <form onSubmit={invoiceForm.handleSubmit(onInvoiceSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={invoiceForm.control}
                    name="invoicePrefix"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice number prefix</FormLabel>
                        <FormControl>
                          <Input placeholder="INV" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={invoiceForm.control}
                    name="invoiceNextNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Next invoice number</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            ref={field.ref}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || 1)}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-sm text-muted-foreground">Preview: {invoicePreview}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={invoiceForm.control}
                    name="defaultCurrency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CURRENCIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={invoiceForm.control}
                    name="defaultPaymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default payment terms</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select terms" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PAYMENT_TERMS.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={invoiceForm.control}
                  name="invoiceFooter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice footer / payment instructions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Bank details, payment instructions..."
                          className="resize-none min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={invoiceForm.formState.isSubmitting}>
                  {invoiceForm.formState.isSubmitting ? "Saving…" : "Save"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>

      {/* Section 3 — Branding */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Branding</h3>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice PDF styling</CardTitle>
            <CardDescription>Primary color used on invoice PDFs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...brandingForm}>
              <form onSubmit={brandingForm.handleSubmit(onBrandingSubmit)} className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <FormField
                    control={brandingForm.control}
                    name="invoiceColor"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormLabel className="mb-0">Primary color</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              className="h-10 w-14 cursor-pointer rounded border p-0"
                              value={primaryColor}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                            <Input
                              className="w-24 font-mono"
                              value={primaryColor}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div
                    className="h-10 w-20 rounded border shrink-0"
                    style={{ backgroundColor: primaryColor }}
                    title="Preview"
                  />
                </div>
                <Button type="submit" disabled={brandingForm.formState.isSubmitting}>
                  {brandingForm.formState.isSubmitting ? "جاري الحفظ…" : "حفظ"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>

      {/* Admin — legacy payments backfill */}
      {isAdmin ? (
        <section>
          <h3 className="text-lg font-semibold mb-2">Admin tools</h3>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legacy paid invoices → payments</CardTitle>
              <CardDescription>
                Creates one payment row per invoice that is <strong>paid</strong> but has no rows in{" "}
                <code className="rounded bg-muted px-1 text-xs">payments</code> (e.g. marked paid before
                payments existed). Uses <code className="rounded bg-muted px-1 text-xs">paid_at</code> for
                the payment date when set, otherwise issue date. Safe to run more than once.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                CLI equivalent:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run db:migrate-paid-invoices</code>
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={migratingPayments}
                onClick={async () => {
                  setMigratingPayments(true);
                  try {
                    const res = await migrateLegacyPaidInvoicePayments();
                    if (res.ok) {
                      toast.success(
                        `Inserted ${res.migratedCount} payment(s); ${res.candidateCount} candidate invoice(s) had no payments.`
                      );
                    } else {
                      toast.error(typeof res.error === "string" ? res.error : "Migration failed");
                    }
                  } catch {
                    toast.error("Migration failed");
                  } finally {
                    setMigratingPayments(false);
                  }
                }}
              >
                {migratingPayments ? "Running…" : "Backfill payment rows"}
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Section 4 — Account */}
      <section>
        <h3 className="text-lg font-semibold mb-2">الحساب</h3>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">حساب المدير</CardTitle>
            <CardDescription>Email and password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Admin email</Label>
              <Input readOnly value={adminEmail} className="bg-muted" />
            </div>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>كلمة المرور الحالية</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>كلمة المرور الجديدة</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmNewPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تأكيد كلمة المرور الجديدة</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                  {passwordForm.formState.isSubmitting ? "Saving…" : "Change password"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
