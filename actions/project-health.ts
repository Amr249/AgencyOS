"use server";

import { format } from "date-fns";
import { getServerSession } from "next-auth";
import { and, gt, inArray, isNotNull, isNull, lt, ne, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { expenses, milestones, projects, tasks, timeLogs } from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";

export type ProjectHealthStatus = "on_track" | "at_risk" | "over_budget";

export type ProjectHealth = {
  status: ProjectHealthStatus;
  /** Short label for badges */
  label: string;
  /** Lines shown in tooltip */
  explanation: string[];
  budget: number | null;
  totalBurn: number;
  /** null when no budget set */
  budgetUsedPercent: number | null;
  overdueTaskCount: number;
  overdueMilestoneCount: number;
};

function num(v: string | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function deriveProjectHealth(input: {
  budget: number | null;
  totalBurn: number;
  overdueTaskCount: number;
  overdueMilestoneCount: number;
}): ProjectHealth {
  const { budget, totalBurn, overdueTaskCount, overdueMilestoneCount } = input;

  const hasBudget = budget != null && budget > 0;
  const ratio = hasBudget ? totalBurn / budget! : null;
  const budgetUsedPercent = ratio != null ? Math.round(ratio * 1000) / 10 : null;

  const overBudget = hasBudget && ratio! > 1;
  const budgetTight = hasBudget && ratio! >= 0.8 && ratio! <= 1;
  const hasScheduleRisk = overdueTaskCount > 0 || overdueMilestoneCount > 0;

  let status: ProjectHealthStatus;
  if (overBudget) {
    status = "over_budget";
  } else if (budgetTight || hasScheduleRisk) {
    status = "at_risk";
  } else {
    status = "on_track";
  }

  const label =
    status === "on_track" ? "On track" : status === "at_risk" ? "At risk" : "Over budget";

  const explanation: string[] = [];
  if (hasBudget) {
    explanation.push(
      `Budget used: ${budgetUsedPercent}% (${totalBurn.toFixed(2)} of ${budget!.toFixed(2)}).`
    );
  } else {
    explanation.push("No project budget set — budget usage not evaluated.");
    if (totalBurn > 0) {
      explanation.push(`Recorded burn (expenses + billable time at logged rates): ${totalBurn.toFixed(2)}.`);
    }
  }
  if (overBudget) {
    explanation.push("Spend exceeds 100% of budget.");
  } else if (budgetTight && hasBudget) {
    explanation.push("Budget is between 80% and 100%.");
  }
  if (overdueTaskCount > 0) {
    explanation.push(`${overdueTaskCount} overdue task(s) (not done, past due date).`);
  }
  if (overdueMilestoneCount > 0) {
    explanation.push(`${overdueMilestoneCount} overdue milestone(s) (not completed).`);
  }
  if (status === "on_track") {
    explanation.push("Under 80% budget (or no budget), no overdue tasks or milestones.");
  }

  return {
    status,
    label,
    explanation,
    budget: hasBudget ? budget! : null,
    totalBurn,
    budgetUsedPercent,
    overdueTaskCount,
    overdueMilestoneCount,
  };
}

/**
 * Roll-up health for a project: expenses + time entries (hours × hourly rate when set),
 * overdue open tasks, overdue incomplete milestones.
 */
export async function getProjectsHealthMap(
  projectIds: string[]
): Promise<{ ok: true; data: Record<string, ProjectHealth> } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  if (sessionUserRole(session) !== "admin") {
    return { ok: true as const, data: {} };
  }

  const unique = [...new Set(projectIds)].filter(Boolean);
  if (unique.length === 0) {
    return { ok: true as const, data: {} };
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");

  try {
    const [budgetRows, expenseRows, timeRows, overdueTasksRows, overdueMsRows] = await Promise.all([
      db
        .select({ id: projects.id, budget: projects.budget })
        .from(projects)
        .where(inArray(projects.id, unique)),
      db
        .select({
          projectId: expenses.projectId,
          total: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .where(inArray(expenses.projectId, unique))
        .groupBy(expenses.projectId),
      db
        .select({
          projectId: timeLogs.projectId,
          total: sql<string>`coalesce(sum(cast(${timeLogs.hours} as numeric) * coalesce(cast(${timeLogs.hourlyRate} as numeric), 0)), 0)`,
        })
        .from(timeLogs)
        .where(and(inArray(timeLogs.projectId, unique), gt(timeLogs.hours, "0")))
        .groupBy(timeLogs.projectId),
      db
        .select({
          projectId: tasks.projectId,
          n: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .where(
          and(
            inArray(tasks.projectId, unique),
            isNull(tasks.deletedAt),
            isNotNull(tasks.dueDate),
            lt(tasks.dueDate, todayStr),
            ne(tasks.status, "done")
          )
        )
        .groupBy(tasks.projectId),
      db
        .select({
          projectId: milestones.projectId,
          n: sql<number>`count(*)::int`,
        })
        .from(milestones)
        .where(
          and(
            inArray(milestones.projectId, unique),
            lt(milestones.dueDate, todayStr),
            notInArray(milestones.status, ["completed", "cancelled"])
          )
        )
        .groupBy(milestones.projectId),
    ]);

    const expenseMap = Object.fromEntries(
      expenseRows.filter((r) => r.projectId).map((r) => [r.projectId!, num(r.total)])
    );
    const timeMap = Object.fromEntries(
      timeRows.filter((r) => r.projectId).map((r) => [r.projectId!, num(r.total)])
    );
    const taskMap = Object.fromEntries(
      overdueTasksRows.map((r) => [r.projectId, Number(r.n)])
    );
    const msMap = Object.fromEntries(overdueMsRows.map((r) => [r.projectId, Number(r.n)]));

    const data: Record<string, ProjectHealth> = {};
    for (const row of budgetRows) {
      const b = row.budget != null ? num(row.budget) : null;
      const exp = expenseMap[row.id] ?? 0;
      const tc = timeMap[row.id] ?? 0;
      const totalBurn = exp + tc;
      data[row.id] = deriveProjectHealth({
        budget: b,
        totalBurn,
        overdueTaskCount: taskMap[row.id] ?? 0,
        overdueMilestoneCount: msMap[row.id] ?? 0,
      });
    }

    return { ok: true as const, data };
  } catch (e) {
    if (isDbConnectionError(e)) {
      console.warn("getProjectsHealthMap: database unreachable (timeout or network)");
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    console.error("getProjectsHealthMap", e);
    return { ok: false as const, error: "Failed to compute project health" };
  }
}

export async function getProjectHealth(
  projectId: string
): Promise<{ ok: true; data: ProjectHealth } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false as const, error: "Invalid project id" };
  const mapRes = await getProjectsHealthMap([parsed.data]);
  if (!mapRes.ok) return mapRes;
  const h = mapRes.data[parsed.data];
  if (!h) return { ok: false as const, error: "Project not found" };
  return { ok: true as const, data: h };
}
