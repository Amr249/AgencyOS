"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportsFinancialTab } from "@/app/dashboard/reports/reports-financial-tab";
import { ProductivityReportsTab } from "@/components/reports/productivity-reports-tab";
import type { DateRangeKey } from "@/actions/reports";
import { cn } from "@/lib/utils";

type FinancialProps = ComponentProps<typeof ReportsFinancialTab>;
type ProductivityProps = ComponentProps<typeof ProductivityReportsTab>;

type ReportsDashboardShellProps = {
  dateRange: DateRangeKey;
  financial: FinancialProps;
  productivity: ProductivityProps;
};

const DATE_RANGE_KEYS: DateRangeKey[] = ["this_month", "last_month", "this_quarter", "this_year", "all"];

export function ReportsDashboardShell({
  dateRange,
  financial,
  productivity,
}: ReportsDashboardShellProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const t = useTranslations("reports");

  return (
    <div className="space-y-6 text-start" dir={isAr ? "rtl" : "ltr"} lang={locale}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
      </div>

      <Tabs defaultValue="financial" className="w-full">
        <TabsList
          className="flex w-full max-w-full flex-nowrap gap-1 overflow-x-auto whitespace-nowrap p-1 md:grid md:max-w-md md:grid-cols-2"
          dir={isAr ? "rtl" : "ltr"}
        >
          <TabsTrigger value="financial">{t("tabs.financial")}</TabsTrigger>
          <TabsTrigger value="projects">{t("tabs.projects")}</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-wrap gap-2">
          {DATE_RANGE_KEYS.map((key) => (
            <Link
              key={key}
              href={`/dashboard/reports?dateRange=${key}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                dateRange === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-transparent bg-muted/50 hover:bg-muted"
              )}
            >
              {t(`dateRange.${key}`)}
            </Link>
          ))}
        </div>

        <TabsContent value="financial" className="mt-4 space-y-4">
          <ReportsFinancialTab {...financial} />
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <ProductivityReportsTab {...productivity} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
