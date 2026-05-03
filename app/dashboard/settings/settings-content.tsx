"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { changePassword } from "@/actions/settings";
import { migrateLegacyPaidInvoicePayments } from "@/actions/invoices";
import type { ChangePasswordInput } from "@/lib/settings-schema";
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
import { SettingsUsageSection } from "@/components/settings-usage-section";
import {
  TeamInvitationsSection,
  type OrgInvitationRowProps,
} from "@/components/settings/team-invitations-section";
import type { clientTags } from "@/lib/db/schema";
import type { PlanTier } from "@/lib/plan-limits";

type UsageOrgProps = {
  plan: PlanTier;
  trialEndsAt: string | null;
  aiUsageCount: number;
  storageUsedBytes: number;
};

type SettingsContentProps = {
  adminEmail: string;
  isAdmin?: boolean;
  canManageInvitations?: boolean;
  initialInvitations?: OrgInvitationRowProps[];
  currentUserId?: string;
  initialClientTags?: (typeof clientTags.$inferSelect)[];
  usageOrg?: UsageOrgProps | null;
};

export function SettingsContent({
  adminEmail,
  isAdmin = false,
  canManageInvitations = false,
  initialInvitations = [],
  currentUserId = "",
  initialClientTags = [],
  usageOrg = null,
}: SettingsContentProps) {
  const td = useTranslations("settings.dashboard");
  const locale = useLocale();
  const pageDir = locale === "ar" ? "rtl" : "ltr";
  const fieldAlign = pageDir === "rtl" ? "text-end" : "text-start";

  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPasswordField, setShowNewPasswordField] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [migratingPayments, setMigratingPayments] = React.useState(false);

  const changePasswordSchemaDyn = React.useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, td("validationCurrentRequired")),
          newPassword: z.string().min(8, td("validationNewMin")),
          confirmNewPassword: z.string().min(1, td("validationConfirmRequired")),
        })
        .refine((data) => data.newPassword === data.confirmNewPassword, {
          message: td("validationPasswordsMismatch"),
          path: ["confirmNewPassword"],
        }),
    [td]
  );

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchemaDyn),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  async function onPasswordSubmit(values: ChangePasswordInput) {
    const result = await changePassword(values);
    if (result.ok) {
      toast.success(td("toastPasswordUpdated"));
      passwordForm.reset({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } else {
      const err = result.error;
      const msg =
        "_form" in err
          ? (err._form[0] ?? td("toastPasswordFailed"))
          : (err.confirmNewPassword?.[0] ??
              err.newPassword?.[0] ??
              err.currentPassword?.[0] ??
              td("toastPasswordFailed"));
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-8">
      {usageOrg ? (
        <SettingsUsageSection
          plan={usageOrg.plan}
          trialEndsAt={usageOrg.trialEndsAt}
          aiUsageCount={usageOrg.aiUsageCount}
          storageUsedBytes={usageOrg.storageUsedBytes}
        />
      ) : null}
      <ClientTagLibrarySettings initialTags={initialClientTags} />

      {canManageInvitations ? (
        <TeamInvitationsSection initialInvitations={initialInvitations} />
      ) : null}

      <section dir={pageDir}>
        <div className="space-y-4">
          <div className={fieldAlign}>
            <h3 className="text-lg font-semibold">{td("appearanceTitle")}</h3>
            <p className="text-muted-foreground text-sm">{td("appearanceDesc")}</p>
          </div>
          <ThemeSelector />
        </div>
      </section>

      {isAdmin && currentUserId ? (
        <section dir={pageDir}>
          <Card>
            <CardHeader className={fieldAlign}>
              <CardTitle className="text-base">{td("teamLoginsCardTitle")}</CardTitle>
              <CardDescription>{td("teamLoginsCardDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary">
                <Link href="/dashboard/settings/users">{td("manageUsersLink")}</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {isAdmin ? (
        <section dir={pageDir}>
          <h3 className={`text-lg font-semibold mb-2 ${fieldAlign}`}>{td("adminToolsTitle")}</h3>
          <Card>
            <CardHeader className={fieldAlign}>
              <CardTitle className="text-base">{td("legacyPaidTitle")}</CardTitle>
              <CardDescription className="space-y-2">
                <span className="block">{td("legacyPaidP1")}</span>
                <span className="block">{td("legacyPaidP2")}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className={`text-muted-foreground text-sm ${fieldAlign}`}>
                {td("legacyCliLine")}{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">
                  {td("legacyCliCommand")}
                </code>
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
                        td("toastMigrationOk", {
                          migrated: res.migratedCount,
                          candidates: res.candidateCount,
                        })
                      );
                    } else {
                      toast.error(typeof res.error === "string" ? res.error : td("toastMigrationFail"));
                    }
                  } catch {
                    toast.error(td("toastMigrationFail"));
                  } finally {
                    setMigratingPayments(false);
                  }
                }}
              >
                {migratingPayments ? td("backfillRunning") : td("backfillButton")}
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section dir={pageDir}>
        <h3 className={`text-lg font-semibold mb-2 ${fieldAlign}`}>{td("accountSectionTitle")}</h3>
        <Card>
          <CardHeader className={fieldAlign}>
            <CardTitle className="text-base">{td("adminAccountTitle")}</CardTitle>
            <CardDescription>{td("adminAccountDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className={fieldAlign}>{td("adminEmailLabel")}</Label>
              <Input readOnly value={adminEmail} className={`bg-muted ${fieldAlign}`} dir="ltr" />
            </div>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem className={fieldAlign}>
                      <FormLabel>{td("currentPassword")}</FormLabel>
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
                            aria-label={showCurrentPassword ? td("hidePassword") : td("showPassword")}
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
                    <FormItem className={fieldAlign}>
                      <FormLabel>{td("newPassword")}</FormLabel>
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
                            aria-label={showNewPasswordField ? td("hidePassword") : td("showPassword")}
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
                    <FormItem className={fieldAlign}>
                      <FormLabel>{td("confirmNewPassword")}</FormLabel>
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
                            aria-label={showConfirmPassword ? td("hidePassword") : td("showPassword")}
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
                  {passwordForm.formState.isSubmitting ? td("savingPassword") : td("changePasswordSubmit")}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
