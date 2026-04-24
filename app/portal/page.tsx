import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getPortalActivityFeed,
  getPortalDashboardSummary,
} from "@/actions/portal-dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const INVOICE_STATUSES = new Set([
  "paid",
  "draft",
  "sent",
  "partial",
  "overdue",
  "cancelled",
  "void",
]);

export default async function PortalHomePage() {
  const t = await getTranslations("clientPortal");

  const summaryRes = await getPortalDashboardSummary();
  if (!summaryRes.ok) {
    if (summaryRes.error === "unauthorized") {
      redirect(`/login?callbackUrl=${encodeURIComponent("/portal")}`);
    }
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-destructive text-sm">{t("loadError")}</p>
      </div>
    );
  }

  const summary = summaryRes.data;
  const activityRes = await getPortalActivityFeed(12);
  const activity = activityRes.ok ? activityRes.data ?? [] : [];

  const orgName = summary.clientName?.trim() || t("brandName");

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-[#c8f542] p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-800">{t("kpiTotalTitle")}</p>
          <p className="text-4xl font-bold text-black">{summary.totalProjectCount}</p>
          <p className="mt-1 text-xs text-neutral-600">{t("kpiTotalHint")}</p>
        </div>
        <div className="rounded-2xl border border-neutral-900 bg-white p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-400">{t("kpiActiveTitle")}</p>
          <p className="text-4xl font-bold text-black">{summary.activeProjectCount}</p>
          <p className="mt-1 text-xs text-neutral-400">{t("kpiActiveHint")}</p>
        </div>
        <div className="rounded-2xl bg-neutral-900 p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-300">{t("kpiCompletedTitle")}</p>
          <p className="text-4xl font-bold text-white">{summary.completedProjectCount}</p>
          <p className="mt-1 text-xs text-neutral-400">{t("kpiCompletedHint")}</p>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-400">{t("kpiReviewTitle")}</p>
          <p className="text-4xl font-bold text-black">{summary.reviewProjectCount}</p>
          <p className="mt-1 text-xs text-neutral-400">{t("kpiReviewHint")}</p>
        </div>
      </div>

      <div>
        <p className="text-xl font-medium leading-snug">
          {t("welcome")}،{" "}
          <span className="text-primary" dir="auto">
            {orgName}
          </span>
        </p>
        <p className="text-muted-foreground mt-1 text-sm">{t("welcomeOrg", { name: orgName })}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-100 bg-white p-5 text-start shadow-sm">
          <p className="mb-1 text-xs font-medium text-neutral-400">{t("statOpenTitle")}</p>
          <p className="text-3xl font-bold tabular-nums">
            {summary.currency}{" "}
            {summary.openAmountDue.toLocaleString("ar", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-2 text-xs text-neutral-500">{t("statOpenHint")}</p>
          <Link href="/portal/invoices" className="text-primary mt-3 inline-block text-sm hover:underline">
            {t("viewInvoicesLink")}
          </Link>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-white p-5 text-start shadow-sm">
          <p className="mb-1 text-xs font-medium text-neutral-400">{t("statDeliveryTitle")}</p>
          <p className="text-3xl font-bold tabular-nums">{summary.overallTaskPercent}%</p>
          <p className="mt-2 text-xs text-neutral-500">{t("statDeliveryHint")}</p>
          <p className="text-muted-foreground mt-2 text-xs tabular-nums">
            {summary.tasksDone} / {summary.tasksTotal}
          </p>
          <div className="mt-3 flex flex-col gap-1 text-sm">
            <Link href="/portal/progress" className="text-primary hover:underline">
              {t("shortcutProgress")}
            </Link>
            <Link href="/portal/files" className="text-primary hover:underline">
              {t("shortcutFiles")}
            </Link>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("activityTitle")}</CardTitle>
          <CardDescription>{t("activityDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("activityEmpty")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {activity.map((item) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{item.label}</span>
                    {item.sublabel ? (
                      <span className="text-muted-foreground mr-2 text-sm">· {item.sublabel}</span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {item.kind === "invoice"
                        ? INVOICE_STATUSES.has(item.meta)
                          ? t(`invoiceStatuses.${item.meta}` as "invoiceStatuses.paid")
                          : item.meta
                        : item.meta.split("/")[0]}
                    </Badge>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {item.at.toLocaleDateString("ar", {
                        dateStyle: "medium",
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
