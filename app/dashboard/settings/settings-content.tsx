"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { changePassword } from "@/actions/settings";
import { migrateLegacyPaidInvoicePayments } from "@/actions/invoices";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/settings-schema";
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
import { ThemeSelector } from "@/components/theme-selector";
import { ClientTagLibrarySettings } from "@/components/modules/clients/client-tag-library-settings";
import type { clientTags } from "@/lib/db/schema";

type SettingsContentProps = {
  adminEmail: string;
  isAdmin?: boolean;
  currentUserId?: string;
  initialClientTags?: (typeof clientTags.$inferSelect)[];
};

export function SettingsContent({
  adminEmail,
  isAdmin = false,
  currentUserId = "",
  initialClientTags = [],
}: SettingsContentProps) {
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPasswordField, setShowNewPasswordField] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [migratingPayments, setMigratingPayments] = React.useState(false);

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  async function onPasswordSubmit(values: ChangePasswordInput) {
    const result = await changePassword(values);
    if (result.ok) {
      toast.success("Password updated successfully");
      passwordForm.reset({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } else {
      const msg =
        result.error.confirmNewPassword?.[0] ??
        result.error.newPassword?.[0] ??
        result.error.currentPassword?.[0] ??
        "Failed to update password";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-8">
      <ClientTagLibrarySettings initialTags={initialClientTags} />

      <section>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Appearance</h3>
            <p className="text-muted-foreground text-sm">Choose light, dark, or system theme.</p>
          </div>
          <ThemeSelector />
        </div>
      </section>

      {isAdmin && currentUserId ? (
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team logins</CardTitle>
              <CardDescription>
                Add, edit, or remove team logins and roles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary">
                <Link href="/dashboard/settings/users">Manage users</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

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

      <section>
        <h3 className="text-lg font-semibold mb-2">Account</h3>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin account</CardTitle>
            <CardDescription>Email and password for this dashboard.</CardDescription>
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
                      <FormLabel>Current password</FormLabel>
                      <FormControl>
                        <div className="relative" dir="ltr">
                          <Input
                            type={showCurrentPassword ? "text" : "password"}
                            autoComplete="current-password"
                            className="pe-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword((v) => !v)}
                            className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2"
                            aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                          >
                            {showCurrentPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
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
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <div className="relative" dir="ltr">
                          <Input
                            type={showNewPasswordField ? "text" : "password"}
                            autoComplete="new-password"
                            className="pe-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPasswordField((v) => !v)}
                            className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2"
                            aria-label={showNewPasswordField ? "Hide password" : "Show password"}
                          >
                            {showNewPasswordField ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
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
                      <FormLabel>Confirm new password</FormLabel>
                      <FormControl>
                        <div className="relative" dir="ltr">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            autoComplete="new-password"
                            className="pe-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2"
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
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
