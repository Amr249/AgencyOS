"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  getMaxTeamMembersForPlan,
  isUnlimitedTeam,
  PLAN_AI_MONTHLY_LIMIT,
  PLAN_STORAGE_BYTES_LIMIT,
  type PlanTier,
} from "@/lib/plan-limits";

function formatBytes(bytes: number, locale: string): string {
  if (bytes <= 0) return "0 MB";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toLocaleString(locale, { maximumFractionDigits: 2 })} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toLocaleString(locale, { maximumFractionDigits: 1 })} MB`;
}

type SettingsUsageSectionProps = {
  plan: PlanTier;
  trialEndsAt: string | null;
  aiUsageCount: number;
  storageUsedBytes: number;
  teamMemberCount: number;
};

export function SettingsUsageSection({
  plan,
  trialEndsAt,
  aiUsageCount,
  storageUsedBytes,
  teamMemberCount,
}: SettingsUsageSectionProps) {
  const t = useTranslations("billing.usage");
  const locale = useLocale();

  if (plan === "internal") {
    return (
      <section>
        <h3 className="mb-2 text-lg font-semibold">{t("sectionTitle")}</h3>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              {t("planLabel")}
              <Badge variant="secondary">{t("planInternal")}</Badge>
            </CardTitle>
            <CardDescription>{t("internalUnlimited")}</CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const aiLimit = PLAN_AI_MONTHLY_LIMIT[plan];
  const storageLimit = PLAN_STORAGE_BYTES_LIMIT[plan];
  const teamLimit = getMaxTeamMembersForPlan(plan);
  const aiPct =
    aiLimit > 0 && Number.isFinite(aiLimit)
      ? Math.min(100, Math.round((aiUsageCount / aiLimit) * 100))
      : 0;
  const storagePct =
    storageLimit > 0 && Number.isFinite(storageLimit)
      ? Math.min(100, Math.round((storageUsedBytes / storageLimit) * 100))
      : 0;

  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
  const trialValid = trialEnd && !Number.isNaN(trialEnd.getTime());
  const trialActive = trialValid && trialEnd.getTime() > Date.now();
  const trialExpired = trialValid && trialEnd.getTime() <= Date.now();

  const planLabelKey =
    plan === "starter" ? "planStarter" : plan === "pro" ? "planPro" : "planEnterprise";

  return (
    <section>
      <h3 className="mb-2 text-lg font-semibold">{t("sectionTitle")}</h3>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            {t("planLabel")}
            <Badge variant="outline">{t(planLabelKey)}</Badge>
          </CardTitle>
          {trialActive ? (
            <CardDescription>
              {t("trialActive", {
                date: trialEnd!.toLocaleDateString(locale === "ar" ? "ar" : "en", {
                  dateStyle: "medium",
                }),
              })}
            </CardDescription>
          ) : trialExpired ? (
            <CardDescription className="text-amber-700 dark:text-amber-400">
              {t("trialExpired")}
            </CardDescription>
          ) : (
            <CardDescription>{t("usageSubtitle")}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {!isUnlimitedTeam(plan) ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t("teamMembers")}</span>
                <span className="text-muted-foreground tabular-nums">
                  {t("teamUsage", {
                    used: teamMemberCount.toLocaleString(locale),
                    limit: teamLimit.toLocaleString(locale),
                  })}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t("teamMembers")}</span>
                <span className="text-muted-foreground">{t("teamUnlimited")}</span>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t("aiRequests")}</span>
              <span className="text-muted-foreground tabular-nums">
                {aiUsageCount.toLocaleString(locale)}
                {Number.isFinite(aiLimit) ? ` / ${aiLimit.toLocaleString(locale)}` : ""}
              </span>
            </div>
            {Number.isFinite(aiLimit) ? <Progress value={aiPct} /> : null}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t("storage")}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatBytes(storageUsedBytes, locale)}
                {Number.isFinite(storageLimit) ? ` / ${formatBytes(storageLimit, locale)}` : ""}
              </span>
            </div>
            {Number.isFinite(storageLimit) ? <Progress value={storagePct} /> : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
