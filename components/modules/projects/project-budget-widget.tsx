"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SarMoney } from "@/components/ui/sar-money";
import { cn } from "@/lib/utils";
import type { BudgetBurnProjectionTone, ProjectBudgetSummaryData } from "@/actions/projects";

type Props = {
  summary: ProjectBudgetSummaryData;
};

function healthClasses(percentUsed: number) {
  if (percentUsed > 100) {
    return {
      bar: "bg-red-500 dark:bg-red-600",
      label: "text-red-600 dark:text-red-400",
    };
  }
  if (percentUsed >= 80) {
    return {
      bar: "bg-amber-500 dark:bg-amber-500",
      label: "text-amber-700 dark:text-amber-400",
    };
  }
  return {
    bar: "bg-emerald-500 dark:bg-emerald-500",
    label: "text-emerald-700 dark:text-emerald-400",
  };
}

function burnProjectionPanelClass(tone: BudgetBurnProjectionTone | null) {
  switch (tone) {
    case "positive":
      return "border-emerald-500/35 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-950/25";
    case "caution":
      return "border-amber-500/35 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-950/25";
    case "critical":
      return "border-red-500/35 bg-red-50/60 dark:border-red-500/25 dark:bg-red-950/25";
    default:
      return "border-border bg-muted/40";
  }
}

export function ProjectBudgetWidget({ summary }: Props) {
  const { budget, expensesTotal, timeCost, totalSpent, remaining, percentUsed, burnRate } = summary;
  const barWidthPct = Math.min(100, Math.max(0, percentUsed));
  const health = healthClasses(percentUsed);

  return (
    <Card className="text-left">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Budget vs actual</CardTitle>
        <p className="text-muted-foreground text-xs font-normal">
          Spent includes project expenses and logged time (hours × rate per entry).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className={cn("font-medium tabular-nums", health.label)}>
              {percentUsed.toFixed(1)}% of budget
            </span>
          </div>
          <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
            <div
              className={cn("h-full rounded-full transition-[width]", health.bar)}
              style={{ width: `${barWidthPct}%` }}
              role="progressbar"
              aria-valuenow={Math.round(percentUsed)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Budget used"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs">Budget</p>
            <p className="text-sm font-semibold tabular-nums">
              <SarMoney value={budget} iconClassName="h-3.5 w-3.5" />
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Spent</p>
            <p className="text-sm font-semibold tabular-nums">
              <SarMoney value={totalSpent} iconClassName="h-3.5 w-3.5" />
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px] tabular-nums">
              Expenses <SarMoney value={expensesTotal} iconClassName="h-3 w-3" />
              {" · "}
              Time <SarMoney value={timeCost} iconClassName="h-3 w-3" />
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Remaining</p>
            <p
              className={cn(
                "text-sm font-semibold tabular-nums",
                remaining < 0 && "text-destructive"
              )}
            >
              <SarMoney value={remaining} iconClassName="h-3.5 w-3.5" />
            </p>
          </div>
        </div>

        {burnRate ? (
          <div
            className={cn(
              "space-y-2 rounded-lg border p-3 text-sm",
              burnProjectionPanelClass(burnRate.projectionTone)
            )}
          >
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Burn rate
            </p>
            <p className="font-semibold tabular-nums">
              <span className="text-muted-foreground font-normal">Burn rate: </span>
              <SarMoney value={burnRate.dailyBurnSar} iconClassName="h-3.5 w-3.5" />
              <span className="text-muted-foreground font-normal"> / day</span>
              <span className="text-muted-foreground ms-1 text-xs font-normal">
                (over {burnRate.daysElapsed} day{burnRate.daysElapsed === 1 ? "" : "s"} since start)
              </span>
            </p>
            {burnRate.projectedTotalSar != null && burnRate.projectDurationDays != null ? (
              <p className="text-muted-foreground text-xs">
                Projected spend by end date:{" "}
                <span className="text-foreground font-medium tabular-nums">
                  <SarMoney value={burnRate.projectedTotalSar} iconClassName="h-3 w-3" />
                </span>
                <span className="ms-1">({burnRate.projectDurationDays} day span)</span>
              </p>
            ) : null}
            <p className="text-xs leading-relaxed">
              {remaining <= 0 ? (
                <span className="text-destructive font-medium">Budget already exceeded at this burn rate.</span>
              ) : burnRate.daysUntilBudgetRunsOut == null ? (
                <span className="text-muted-foreground">
                  At this rate, recorded spend is not increasing — runway cannot be estimated from daily burn.
                </span>
              ) : (
                <>
                  <span className="font-medium text-foreground">At this rate, budget runs out in </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {burnRate.daysUntilBudgetRunsOut}
                  </span>
                  <span className="font-medium text-foreground"> day{burnRate.daysUntilBudgetRunsOut === 1 ? "" : "s"}</span>
                  <span className="text-muted-foreground"> (based on remaining ÷ daily burn).</span>
                </>
              )}
            </p>
            {burnRate.projectedOverspendSar != null && burnRate.projectedOverspendSar > 0 ? (
              <p className="text-destructive text-xs font-semibold tabular-nums">
                Projected overspend:{" "}
                <SarMoney value={burnRate.projectedOverspendSar} iconClassName="h-3 w-3" />
              </p>
            ) : null}
            {burnRate.projectionTone === "positive" && burnRate.projectedTotalSar != null ? (
              <p className="text-emerald-800 text-xs dark:text-emerald-200/90">
                Projected spend is under 90% of budget — on track to finish under budget.
              </p>
            ) : null}
            {burnRate.projectionTone === "caution" && burnRate.projectedTotalSar != null ? (
              <p className="text-amber-900 text-xs dark:text-amber-200/90">
                Projected spend is between 90% and 110% of budget — monitor closely.
              </p>
            ) : null}
            {burnRate.projectionTone === "critical" && burnRate.projectedTotalSar != null ? (
              <p className="text-red-800 text-xs dark:text-red-200/90">
                Projected spend exceeds 110% of budget at current velocity.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Add a project start date (today or earlier) to see burn rate, runway, and end-date projection.
            Set an end date to include projected spend vs budget.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
