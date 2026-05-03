"use client";

import { Fragment, useCallback, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Building2, Check, ChevronLeft, ChevronRight, FileText, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { OnboardingStatePayload } from "@/actions/onboarding";
import { createInvitations } from "@/actions/invitations";
import {
  completeOnboarding,
  setOnboardingStep,
  updateOnboardingInvoice,
  updateOnboardingProfile,
} from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ONBOARDING_CURRENCIES = ["SAR", "USD"] as const;
type CurrencyCode = (typeof ONBOARDING_CURRENCIES)[number];

const PAYMENT_TERMS = ["0", "15", "30", "60"] as const;

type InviteDraft = { email: string; role: "admin" | "member" };

export function OnboardingWizard({
  initial,
  organizationId,
}: {
  initial: OnboardingStatePayload;
  organizationId: string;
}) {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const tcx = useTranslations("onboarding.currencies");
  const tt = useTranslations("onboarding.terms");
  const tr = useTranslations("onboarding.roleLabel");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(() => Math.min(4, Math.max(1, initial.onboardingStep)));

  const [agencyName, setAgencyName] = useState(initial.agencyName);
  const [agencyEmail, setAgencyEmail] = useState(initial.agencyEmail || initial.userEmail);
  const [agencyWebsite, setAgencyWebsite] = useState(initial.agencyWebsite ?? "");
  const [agencyLogoUrl, setAgencyLogoUrl] = useState(initial.agencyLogoUrl ?? "");
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const c = (initial.defaultCurrency ?? "SAR").toUpperCase();
    return c === "USD" ? "USD" : "SAR";
  });

  const [invoicePrefix, setInvoicePrefix] = useState(initial.invoicePrefix ?? "INV");
  const [vatNumber, setVatNumber] = useState(initial.vatNumber ?? "");
  const [paymentTerms, setPaymentTerms] = useState(() => {
    const n = initial.defaultPaymentTerms ?? 30;
    const s = String(n) as (typeof PAYMENT_TERMS)[number];
    return (PAYMENT_TERMS as readonly string[]).includes(s) ? s : "30";
  });

  const [inviteList, setInviteList] = useState<InviteDraft[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [logoUploading, setLogoUploading] = useState(false);
  const [createdInviteLinks, setCreatedInviteLinks] = useState<{ email: string; url: string }[]>([]);

  /** Bar fill: 25% per step (matches horizontal stepper UX). */
  const progressPct = useMemo(() => (step / 4) * 100, [step]);

  const stepper = [
    { n: 1 as const, Icon: Building2, label: t("step1Title") },
    { n: 2 as const, Icon: FileText, label: t("step2Title") },
    { n: 3 as const, Icon: UserPlus, label: t("step3Title") },
    { n: 4 as const, Icon: Check, label: t("step4Title") },
  ] as const;

  const goStep = useCallback(
    (s: number) => {
      startTransition(async () => {
        const r = await setOnboardingStep(s);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setStep(s);
        router.refresh();
      });
    },
    [router]
  );

  const onLogoFile = async (file: File | null) => {
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("scope", "agency-logo");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? t("logoUploadFailed"));
        return;
      }
      if (json.url) {
        setAgencyLogoUrl(json.url);
        toast.success(t("logoUploaded"));
      }
    } catch {
      toast.error(t("logoUploadFailed"));
    } finally {
      setLogoUploading(false);
    }
  };

  const saveProfileAndNext = () => {
    startTransition(async () => {
      const r = await updateOnboardingProfile({
        agencyName: agencyName.trim(),
        agencyEmail: agencyEmail.trim(),
        agencyWebsite: agencyWebsite.trim(),
        agencyLogoUrl: agencyLogoUrl.trim(),
        country: "SA",
        currency,
      });
      if (!r.ok) {
        if (typeof r.error === "string") toast.error(r.error);
        else {
          const first = Object.values(r.error).flat()[0];
          toast.error(first ?? t("saveFailed"));
        }
        return;
      }
      setStep(2);
      router.refresh();
    });
  };

  const saveInvoiceAndNext = () => {
    startTransition(async () => {
      const r = await updateOnboardingInvoice({
        invoicePrefix: invoicePrefix.trim() || "INV",
        vatNumber: vatNumber.trim(),
        defaultPaymentTerms: paymentTerms as (typeof PAYMENT_TERMS)[number],
      });
      if (!r.ok) {
        if (typeof r.error === "string") toast.error(r.error);
        else {
          const first = Object.values(r.error).flat()[0];
          toast.error(first ?? t("saveFailed"));
        }
        return;
      }
      setStep(3);
      router.refresh();
    });
  };

  const addInvite = () => {
    const e = inviteEmail.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error(t("invalidEmail"));
      return;
    }
    if (inviteList.some((x) => x.email === e)) {
      toast.error(t("duplicateInvite"));
      return;
    }
    setInviteList((prev) => [...prev, { email: e, role: inviteRole }]);
    setInviteEmail("");
  };

  const removeInvite = (email: string) => {
    setInviteList((prev) => prev.filter((x) => x.email !== email));
  };

  const submitInvitesAndNext = () => {
    startTransition(async () => {
      if (inviteList.length > 0) {
        const r = await createInvitations(inviteList);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setCreatedInviteLinks(r.inviteLinks ?? []);
      } else {
        setCreatedInviteLinks([]);
      }
      const nav = await setOnboardingStep(4);
      if (!nav.ok) {
        toast.error(nav.error);
        return;
      }
      setStep(4);
      router.refresh();
    });
  };

  const finish = () => {
    startTransition(async () => {
      const r = await completeOnboarding(organizationId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(t("completedToast"));
      router.push("/dashboard");
      router.refresh();
    });
  };

  const slideEnter = isRTL ? -20 : 20;
  const slideExit = isRTL ? 16 : -16;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex shrink-0 flex-col items-center gap-1 text-center"
      >
        <div className="relative h-8 w-32 shrink-0 sm:h-9 sm:w-36">
          <Image
            src="/Logo1.png"
            alt="AgencyOS"
            fill
            className="object-contain object-center"
            sizes="(max-width: 768px) 160px, 192px"
            priority
          />
        </div>
        <p className="text-xs font-medium text-muted-foreground">{t("badge")}</p>
      </motion.div>

      <div className="w-full shrink-0">
        <div className="mb-1 flex w-full items-center justify-between gap-0.5 sm:gap-1">
          {stepper.map((item, index) => (
            <Fragment key={item.n}>
              <motion.button
                type="button"
                onClick={() => item.n < step && goStep(item.n)}
                disabled={pending || item.n > step}
                aria-current={step === item.n ? "step" : undefined}
                className={cn(
                  "group flex min-w-0 flex-1 flex-col items-center gap-2 transition-opacity",
                  item.n > step && "cursor-not-allowed opacity-45"
                )}
                whileHover={item.n <= step ? { scale: 1.02 } : undefined}
                whileTap={item.n < step ? { scale: 0.97 } : undefined}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300 sm:h-12 sm:w-12",
                    item.n < step && "border-primary bg-primary text-primary-foreground",
                    item.n === step && "border-primary bg-primary text-primary-foreground shadow-md",
                    item.n > step && "border-muted bg-background text-muted-foreground"
                  )}
                >
                  {item.n < step ? (
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  ) : (
                    <item.Icon className="h-5 w-5" strokeWidth={1.75} />
                  )}
                </div>
                <span
                  className={cn(
                    "line-clamp-2 max-w-[4.75rem] text-center text-[10px] font-medium leading-tight sm:max-w-[7rem] sm:text-xs",
                    step === item.n ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </motion.button>
              {index < stepper.length - 1 ? (
                <div className="flex min-w-[6px] max-w-full flex-1 items-center pt-5 sm:pt-6">
                  <div className="relative h-0.5 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={cn(
                        "absolute inset-y-0 h-full rounded-full bg-primary",
                        isRTL ? "end-0" : "start-0"
                      )}
                      initial={false}
                      animate={{ width: step > item.n ? "100%" : "0%" }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>

        <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: slideEnter }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: slideExit }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
      {step === 1 && (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-border/70 !gap-2 !py-3 shadow-xl">
          <CardHeader className="gap-1 px-4 py-0">
            <CardTitle className="text-lg font-bold tracking-tight sm:text-xl">{t("step1Title")}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{t("step1Description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 py-0">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="agencyName">
                  {t("agencyName")}
                </Label>
                <Input
                  id="agencyName"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  autoComplete="organization"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="agencyEmail">
                  {t("agencyEmail")}
                </Label>
                <Input
                  id="agencyEmail"
                  type="email"
                  value={agencyEmail}
                  onChange={(e) => setAgencyEmail(e.target.value)}
                  autoComplete="email"
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid min-h-0 flex-1 gap-2 sm:grid-cols-2">
              <div className="flex min-h-0 flex-col space-y-1">
                <Label className="text-xs">{t("agencyLogo")}</Label>
                <div className="flex min-h-0 flex-1 flex-col gap-2 sm:flex-row sm:items-stretch">
                  {agencyLogoUrl ? (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      <Image src={agencyLogoUrl} alt="" fill className="object-contain p-0.5" unoptimized />
                    </div>
                  ) : null}
                  <Input
                    type="file"
                    accept="image/*"
                    className="h-9 min-h-0 flex-1 cursor-pointer text-xs"
                    disabled={logoUploading || pending}
                    onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                {logoUploading ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("uploading")}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="agencyWebsite">
                  {t("agencyWebsite")}
                </Label>
                <Input
                  id="agencyWebsite"
                  type="url"
                  placeholder="https://"
                  value={agencyWebsite}
                  onChange={(e) => setAgencyWebsite(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("currency")}</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ONBOARDING_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {tcx(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="mt-auto shrink-0 justify-end border-t px-4 pt-3 pb-0">
            <Button
              type="button"
              size="sm"
              className="inline-flex items-center gap-2"
              onClick={saveProfileAndNext}
              disabled={pending || !agencyName.trim()}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("next")}
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-border/70 !gap-2 !py-3 shadow-xl">
          <CardHeader className="gap-1 px-4 py-0">
            <CardTitle className="text-lg font-bold tracking-tight sm:text-xl">{t("step2Title")}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{t("step2Description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 px-4 py-0">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="invoicePrefix">
                {t("invoicePrefix")}
              </Label>
              <Input
                id="invoicePrefix"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                maxLength={32}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="vat">
                {t("vatNumber")}
              </Label>
              <Input id="vat" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("paymentTerms")}</Label>
              <Select
                value={paymentTerms}
                onValueChange={(v) => setPaymentTerms(v as (typeof PAYMENT_TERMS)[number])}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map((term) => (
                    <SelectItem key={term} value={term}>
                      {tt(term)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t px-4 pt-3 pb-0">
            <Button type="button" size="sm" variant="ghost" onClick={() => goStep(1)} disabled={pending}>
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              {t("back")}
            </Button>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => goStep(3)} disabled={pending}>
                {t("skip")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="inline-flex items-center gap-2"
                onClick={saveInvoiceAndNext}
                disabled={pending}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("next")}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-border/70 !gap-2 !py-3 shadow-xl">
          <CardHeader className="gap-1 px-4 py-0">
            <CardTitle className="text-lg font-bold tracking-tight sm:text-xl">{t("step3Title")}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{t("step3Description")}</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 space-y-2 overflow-hidden px-4 py-0">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                placeholder={t("inviteEmailPlaceholder")}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-9 sm:flex-1"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "member")}>
                <SelectTrigger className="h-9 w-full sm:w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{tr("admin")}</SelectItem>
                  <SelectItem value="member">{tr("member")}</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" size="sm" variant="secondary" onClick={addInvite} disabled={pending}>
                <UserPlus className="h-4 w-4" />
                <span className="ms-2">{t("add")}</span>
              </Button>
            </div>
            {inviteList.length > 0 ? (
              <ul className="divide-y rounded-lg border">
                {inviteList.map((row) => (
                  <li
                    key={row.email}
                    className="flex items-center justify-between gap-2 px-2 py-1 text-xs"
                  >
                    <span className="truncate">
                      {row.email}{" "}
                      <span className="text-muted-foreground">({tr(row.role)})</span>
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => removeInvite(row.email)}
                      aria-label={t("remove")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noInvitesYet")}</p>
            )}
          </CardContent>
          <CardFooter className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t px-4 pt-3 pb-0">
            <Button type="button" size="sm" variant="ghost" onClick={() => goStep(2)} disabled={pending}>
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              {t("back")}
            </Button>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => goStep(4)} disabled={pending}>
                {t("skip")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="inline-flex items-center gap-2"
                onClick={submitInvitesAndNext}
                disabled={pending}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("continue")}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {step === 4 && (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-border/70 !gap-2 !py-3 shadow-xl">
          <CardHeader className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <Check className="h-6 w-6" />
            </motion.div>
            <CardTitle className="text-lg font-bold tracking-tight sm:text-xl">{t("step4Title")}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{t("step4Description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 px-4 py-0 text-xs text-muted-foreground sm:text-sm">
            <ul className="mx-auto max-w-md space-y-1 rounded-lg border bg-muted/30 p-3 text-start">
              <li>
                <strong className="text-foreground">{t("summaryAgency")}</strong> {agencyName}
              </li>
              <li>
                <strong className="text-foreground">{t("summaryCurrency")}</strong> {currency}
              </li>
              <li>
                <strong className="text-foreground">{t("summaryInvoice")}</strong> {invoicePrefix} —{" "}
                {tt(paymentTerms)}
              </li>
              <li>
                <strong className="text-foreground">{t("summaryInvites")}</strong>{" "}
                {inviteList.length ? inviteList.map((i) => i.email).join(", ") : t("summaryInvitesNone")}
              </li>
            </ul>
            {createdInviteLinks.length > 0 ? (
              <div className="mx-auto max-w-md space-y-1 rounded-lg border border-dashed bg-muted/20 p-3 text-start">
                <p className="text-sm font-medium text-foreground">{t("inviteLinksTitle")}</p>
                <ul className="space-y-2">
                  {createdInviteLinks.map((row) => (
                    <li key={row.email} className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <span className="truncate text-muted-foreground">{row.email}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="shrink-0"
                        onClick={() => {
                          void navigator.clipboard.writeText(row.url).then(() => {
                            toast.success(t("inviteLinkCopied"));
                          });
                        }}
                      >
                        {t("copyInviteLink")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="mt-auto flex flex-wrap justify-center gap-2 border-t px-4 pt-3 pb-0">
            <Button type="button" size="sm" variant="ghost" onClick={() => goStep(3)} disabled={pending}>
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              {t("back")}
            </Button>
            <Button type="button" className="inline-flex items-center gap-2" onClick={finish} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("goToDashboard")}
            </Button>
          </CardFooter>
        </Card>
      )}
        </motion.div>
      </AnimatePresence>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="shrink-0 text-center text-xs text-muted-foreground"
      >
        {t("stepOfTotal", { current: step, total: 4 })}
      </motion.p>
    </div>
  );
}
