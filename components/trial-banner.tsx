"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanTier } from "@/lib/plan-limits";
import { getTrialStatus } from "@/lib/trial-status";

const SESSION_DISMISS_KEY = "agencyos.trial-banner.dismissed";

type TrialBannerProps = {
  plan: PlanTier;
  trialEndsAt: string | null;
};

export function TrialBanner({ plan, trialEndsAt }: TrialBannerProps) {
  const t = useTranslations("billing.trialBanner");
  const tErr = useTranslations("errors");
  const locale = useLocale();
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      // ignore
    }
  }, []);

  if (plan === "internal") return null;
  if (!trialEndsAt) return null;

  const end = new Date(trialEndsAt);
  if (Number.isNaN(end.getTime())) return null;

  const now = new Date();
  const status = getTrialStatus({ plan, trialEndsAt: end }, now);
  const expired = status.isExpired;
  const daysLeft = status.daysRemaining ?? 0;

  if (!expired && dismissed) return null;

  const dismiss = () => {
    if (expired) return;
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div
      className={
        expired
          ? "sticky top-0 z-50 border-b border-destructive/50 bg-destructive/10 text-destructive-foreground dark:bg-destructive/20 dark:text-destructive-foreground"
          : "border-b border-primary/20 bg-primary/5"
      }
    >
      <div className="flex w-full items-center gap-2 px-4 py-2.5 lg:px-6">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug">
          {expired ? tErr("trial_expired") : t("daysLeft", { count: daysLeft })}
        </p>
        <Button asChild size="sm" variant={expired ? "default" : "secondary"} className="shrink-0">
          <Link href="/dashboard/upgrade">{t("upgrade")}</Link>
        </Button>
        {!expired ? (
          <button
            type="button"
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md"
            aria-label={locale === "ar" ? "إغلاق" : "Dismiss"}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
