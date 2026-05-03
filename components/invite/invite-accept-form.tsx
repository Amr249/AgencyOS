"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { acceptInvitation } from "@/actions/invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageToggle } from "@/components/language-toggle";

type InviteAcceptFormProps = {
  token: string;
  email: string;
  organizationName: string;
  inviterName: string;
  role: "admin" | "member";
};

export function InviteAcceptForm({
  token,
  email,
  organizationName,
  inviterName,
  role,
}: InviteAcceptFormProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("invitations");
  const tAuth = useTranslations("auth");
  const tOnboarding = useTranslations("onboarding.roleLabel");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [accountExists, setAccountExists] = useState(false);
  const [loading, setLoading] = useState(false);

  const isAr = locale === "ar";
  const formDir = isAr ? "rtl" : "ltr";

  function err(key: string): string | undefined {
    const v = fieldErrors[key];
    return Array.isArray(v) && v.length > 0 ? v[0] : undefined;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});
    setAccountExists(false);
    const res = await acceptInvitation({ token, name, password, confirmPassword });
    if (!res.ok) {
      setLoading(false);
      if ("code" in res && res.code === "account_exists") {
        setAccountExists(true);
        return;
      }
      if ("error" in res) {
        if (typeof res.error === "string") {
          setFieldErrors({ _form: [res.error] });
          return;
        }
        setFieldErrors(res.error);
      }
      return;
    }
    const signInRes = await signIn("credentials", {
      email: res.email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (signInRes?.error) {
      setFieldErrors({ _form: [tAuth("invalidCredentials")] });
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50" dir={formDir} lang={locale}>
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <span className="text-sm font-medium text-neutral-800">{t("inviteHeader")}</span>
        <LanguageToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{t("title")}</h1>
            <p className="text-sm text-neutral-600">
              {t("subtitle", {
                org: organizationName,
                role: tOnboarding(role),
              })}
            </p>
            <p className="text-sm text-neutral-500">
              {t("invitedBy", { name: inviterName })}
            </p>
          </div>

          {accountExists ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="mb-3">{t("accountExists")}</p>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/login">{tAuth("loginButton")}</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit} noValidate spellCheck={false}>
              <div className="space-y-2">
                <Label htmlFor="invite-email">{tAuth("email")}</Label>
                <Input id="invite-email" type="email" value={email} readOnly className="bg-muted" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name">{tAuth("fullName")}</Label>
                <Input
                  id="invite-name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={err("name") ? "border-red-500" : ""}
                />
                {err("name") ? <p className="text-sm text-red-600">{err("name")}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-password">{tAuth("password")}</Label>
                <div className="relative" dir="ltr">
                  <Input
                    id="invite-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`pe-10 ${err("password") ? "border-red-500" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                    aria-label={showPassword ? tAuth("hidePassword") : tAuth("showPassword")}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {err("password") ? <p className="text-sm text-red-600">{err("password")}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-confirm">{tAuth("confirmPassword")}</Label>
                <div className="relative" dir="ltr">
                  <Input
                    id="invite-confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`pe-10 ${err("confirmPassword") ? "border-red-500" : ""}`}
                  />
                </div>
                {err("confirmPassword") ? (
                  <p className="text-sm text-red-600">{err("confirmPassword")}</p>
                ) : null}
              </div>
              {err("_form") ? (
                <p className="text-sm text-red-600" role="alert">
                  {err("_form")}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t("accepting")}
                  </>
                ) : (
                  t("acceptButton")
                )}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
