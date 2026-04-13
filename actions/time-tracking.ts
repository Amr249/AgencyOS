"use server";

import { db } from "@/lib/db";
import { timeLogs, tasks, teamMembers, projects, clients } from "@/lib/db/schema";
import { and, desc, eq, gte, isNotNull, isNull, lte, lt, sql, gt } from "drizzle-orm";
import { z } from "zod";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { revalidateTimeTrackingCaches } from "@/lib/revalidate-time-tracking-caches";

// ============ Schemas ============

function isQuarterHour(h: number): boolean {
  return Number.isFinite(h) && Math.abs(h * 4 - Math.round(h * 4)) < 1e-6;
}

const logTimeSchema = z.object({
  taskId: z.string().uuid(),
  hours: z
    .number()
    .min(0.25, "Minimum 0.25 hours")
    .max(24, "Maximum 24 hours")
    .refine(isQuarterHour, { message: "Hours must be in 0.25 increments" }),
  description: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  teamMemberId: z.string().uuid().optional(),
  isBillable: z.boolean().optional().default(true),
  hourlyRate: z.number().optional(),
});

const startTimerSchema = z.object({
  taskId: z.string().uuid(),
  teamMemberId: z.string().uuid().optional(),
  description: z.string().optional(),
});

const stopTimerSchema = z.object({
  timeLogId: z.string().uuid(),
});

const getTimeLogsFiltersSchema = z.object({
  taskId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  teamMemberId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  isBillable: z.boolean().optional(),
});

function startOfDayUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function endOfDayUtc(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

// ============ Actions ============

export async function logTime(input: z.infer<typeof logTimeSchema>) {
  try {
    const parsed = logTimeSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.flatten().fieldErrors };
    }

    const { taskId, hours, description, date, teamMemberId, isBillable, hourlyRate } = parsed.data;

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      columns: { projectId: true },
    });

    if (!task) {
      return { ok: false as const, error: "Task not found" as const };
    }

    const [entry] = await db
      .insert(timeLogs)
      .values({
        taskId,
        projectId: task.projectId,
        teamMemberId: teamMemberId ?? null,
        description: description ?? null,
        hours: hours.toFixed(2),
        loggedAt: new Date(`${date}T12:00:00.000Z`),
        isBillable,
        hourlyRate: hourlyRate != null ? hourlyRate.toFixed(2) : null,
      })
      .returning();

    await updateTaskActualHours(taskId);

    revalidateTimeTrackingCaches(task.projectId);

    return { ok: true as const, data: entry };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function startTimer(input: z.infer<typeof startTimerSchema>) {
  try {
    const parsed = startTimerSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.flatten().fieldErrors };
    }

    const { taskId, teamMemberId, description } = parsed.data;

    if (teamMemberId) {
      const running = await db.query.timeLogs.findFirst({
        where: and(
          eq(timeLogs.teamMemberId, teamMemberId),
          isNotNull(timeLogs.startedAt),
          isNull(timeLogs.endedAt)
        ),
      });
      if (running) {
        return {
          ok: false as const,
          error: "You already have a running timer. Stop it first." as const,
        };
      }
    }

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      columns: { projectId: true },
    });

    if (!task) {
      return { ok: false as const, error: "Task not found" as const };
    }

    const [entry] = await db
      .insert(timeLogs)
      .values({
        taskId,
        projectId: task.projectId,
        teamMemberId: teamMemberId ?? null,
        description: description ?? null,
        startedAt: new Date(),
        hours: "0",
        isBillable: true,
      })
      .returning();

    revalidateTimeTrackingCaches(task.projectId);

    return { ok: true as const, data: entry };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function stopTimer(input: z.infer<typeof stopTimerSchema>) {
  try {
    const parsed = stopTimerSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.flatten().fieldErrors };
    }

    const { timeLogId } = parsed.data;

    const entry = await db.query.timeLogs.findFirst({
      where: eq(timeLogs.id, timeLogId),
    });

    if (!entry) {
      return { ok: false as const, error: "Time entry not found" as const };
    }

    if (!entry.startedAt || entry.endedAt) {
      return { ok: false as const, error: "Timer is not running" as const };
    }

    const endedAt = new Date();
    const startedAt = new Date(entry.startedAt);
    const hours = (endedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60);

    const [updated] = await db
      .update(timeLogs)
      .set({
        endedAt,
        hours: hours.toFixed(2),
        loggedAt: endedAt,
      })
      .where(eq(timeLogs.id, timeLogId))
      .returning();

    await updateTaskActualHours(entry.taskId);

    const projectId =
      entry.projectId ??
      (
        await db.query.tasks.findFirst({
          where: eq(tasks.id, entry.taskId),
          columns: { projectId: true },
        })
      )?.projectId;

    revalidateTimeTrackingCaches(projectId);

    return { ok: true as const, data: updated };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function getRunningTimer(teamMemberId?: string) {
  try {
    const conditions = [isNotNull(timeLogs.startedAt), isNull(timeLogs.endedAt)];

    if (teamMemberId) {
      conditions.push(eq(timeLogs.teamMemberId, teamMemberId));
    }

    const entry = await db.query.timeLogs.findFirst({
      where: and(...conditions),
      orderBy: [desc(timeLogs.startedAt)],
      with: {
        task: {
          columns: { id: true, title: true, projectId: true },
          with: {
            project: { columns: { id: true, name: true } },
          },
        },
      },
    });

    return { ok: true as const, data: entry ?? null };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function getTimeLogs(filters?: z.infer<typeof getTimeLogsFiltersSchema>) {
  try {
    const parsed = filters
      ? getTimeLogsFiltersSchema.safeParse(filters)
      : ({ success: true as const, data: {} } satisfies { success: true; data: z.infer<typeof getTimeLogsFiltersSchema> });

    if (!parsed.success) {
      return { ok: false as const, error: "Invalid filters" as const };
    }

    const { taskId, projectId, teamMemberId, dateFrom, dateTo, isBillable } = parsed.data;

    const conditions = [gt(timeLogs.hours, "0")];

    if (taskId) conditions.push(eq(timeLogs.taskId, taskId));
    if (projectId) conditions.push(eq(timeLogs.projectId, projectId));
    if (teamMemberId) conditions.push(eq(timeLogs.teamMemberId, teamMemberId));
    if (dateFrom) conditions.push(gte(timeLogs.loggedAt, startOfDayUtc(dateFrom)));
    if (dateTo) conditions.push(lte(timeLogs.loggedAt, endOfDayUtc(dateTo)));
    if (isBillable !== undefined) conditions.push(eq(timeLogs.isBillable, isBillable));

    const entries = await db.query.timeLogs.findMany({
      where: and(...conditions),
      orderBy: [desc(timeLogs.loggedAt)],
      with: {
        task: {
          columns: { id: true, title: true },
          with: {
            project: { columns: { id: true, name: true } },
          },
        },
        teamMember: { columns: { id: true, name: true, avatarUrl: true } },
      },
    });

    return { ok: true as const, data: entries };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function getTimeLogsByTaskId(taskId: string) {
  return getTimeLogs({ taskId });
}

export async function getProjectTimeSummary(projectId: string) {
  try {
    const result = await db
      .select({
        totalHours: sql<string>`COALESCE(SUM(${timeLogs.hours}), 0)`,
        billableHours: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.isBillable} THEN ${timeLogs.hours} ELSE 0 END), 0)`,
        entryCount: sql<number>`COUNT(*)::int`,
      })
      .from(timeLogs)
      .where(and(eq(timeLogs.projectId, projectId), gt(timeLogs.hours, "0")));

    const byMember = await db
      .select({
        teamMemberId: timeLogs.teamMemberId,
        teamMemberName: teamMembers.name,
        totalHours: sql<string>`SUM(${timeLogs.hours})`,
      })
      .from(timeLogs)
      .leftJoin(teamMembers, eq(timeLogs.teamMemberId, teamMembers.id))
      .where(and(eq(timeLogs.projectId, projectId), gt(timeLogs.hours, "0")))
      .groupBy(timeLogs.teamMemberId, teamMembers.name);

    return {
      ok: true as const,
      data: {
        totalHours: parseFloat(result[0]?.totalHours ?? "0"),
        billableHours: parseFloat(result[0]?.billableHours ?? "0"),
        entryCount: result[0]?.entryCount ?? 0,
        byMember: byMember.map((m) => ({
          teamMemberId: m.teamMemberId,
          teamMemberName: m.teamMemberName ?? "Unassigned",
          totalHours: parseFloat(m.totalHours ?? "0"),
        })),
      },
    };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function getTimesheet(params: { teamMemberId?: string; weekStart: string }) {
  try {
    const { teamMemberId, weekStart } = params;
    const startDate = new Date(`${weekStart}T00:00:00.000Z`);
    const endExclusive = new Date(startDate);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 7);

    const conditions = [
      gte(timeLogs.loggedAt, startDate),
      lt(timeLogs.loggedAt, endExclusive),
      gt(timeLogs.hours, "0"),
    ];

    if (teamMemberId) {
      conditions.push(eq(timeLogs.teamMemberId, teamMemberId));
    }

    const entries = await db.query.timeLogs.findMany({
      where: and(...conditions),
      orderBy: [desc(timeLogs.loggedAt)],
      with: {
        task: {
          columns: { id: true, title: true },
          with: {
            project: { columns: { id: true, name: true } },
          },
        },
      },
    });

    const byDay: Record<string, typeof entries> = {};
    for (const entry of entries) {
      const day = entry.loggedAt.toISOString().split("T")[0]!;
      if (!byDay[day]) byDay[day] = [];
      byDay[day]!.push(entry);
    }

    const dailyTotals: Record<string, number> = {};
    for (const [day, dayEntries] of Object.entries(byDay)) {
      dailyTotals[day] = dayEntries.reduce((s, e) => s + parseFloat(String(e.hours)), 0);
    }

    const weekTotal = Object.values(dailyTotals).reduce((sum, h) => sum + h, 0);

    return {
      ok: true as const,
      data: {
        entries,
        byDay,
        dailyTotals,
        weekTotal,
        weekStart,
      },
    };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function deleteTimeLog(id: string) {
  try {
    const entry = await db.query.timeLogs.findFirst({
      where: eq(timeLogs.id, id),
    });

    if (!entry) {
      return { ok: false as const, error: "Time entry not found" as const };
    }

    await db.delete(timeLogs).where(eq(timeLogs.id, id));

    await updateTaskActualHours(entry.taskId);

    const projectId =
      entry.projectId ??
      (
        await db.query.tasks.findFirst({
          where: eq(tasks.id, entry.taskId),
          columns: { projectId: true },
        })
      )?.projectId;

    revalidateTimeTrackingCaches(projectId);

    return { ok: true as const };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function updateTimeLog(input: {
  id: string;
  hours?: number;
  description?: string | null;
  isBillable?: boolean;
  hourlyRate?: number | null;
}) {
  try {
    const { id, ...updates } = input;

    const entry = await db.query.timeLogs.findFirst({
      where: eq(timeLogs.id, id),
    });

    if (!entry) {
      return { ok: false as const, error: "Time entry not found" as const };
    }

    const patch: Partial<typeof timeLogs.$inferInsert> = {};
    if (updates.hours !== undefined) patch.hours = updates.hours.toFixed(2);
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.isBillable !== undefined) patch.isBillable = updates.isBillable;
    if (updates.hourlyRate !== undefined) {
      patch.hourlyRate = updates.hourlyRate != null ? updates.hourlyRate.toFixed(2) : null;
    }

    const [updated] = await db.update(timeLogs).set(patch).where(eq(timeLogs.id, id)).returning();

    if (updates.hours !== undefined) {
      await updateTaskActualHours(entry.taskId);
    }

    const projectId =
      entry.projectId ??
      (
        await db.query.tasks.findFirst({
          where: eq(tasks.id, entry.taskId),
          columns: { projectId: true },
        })
      )?.projectId;

    revalidateTimeTrackingCaches(projectId);

    return { ok: true as const, data: updated };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

async function updateTaskActualHours(taskId: string) {
  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${timeLogs.hours}), 0)`,
    })
    .from(timeLogs)
    .where(and(eq(timeLogs.taskId, taskId), gt(timeLogs.hours, "0")));

  await db
    .update(tasks)
    .set({ actualHours: row?.total ?? "0" })
    .where(eq(tasks.id, taskId));
}

export async function getTimeReports(params: {
  dateFrom: string;
  dateTo: string;
  groupBy: "project" | "client" | "team_member";
}) {
  try {
    const { dateFrom, dateTo, groupBy } = params;
    const from = startOfDayUtc(dateFrom);
    const to = endOfDayUtc(dateTo);

    const dateFilter = and(
      gte(timeLogs.loggedAt, from),
      lte(timeLogs.loggedAt, to),
      gt(timeLogs.hours, "0")
    );

    type Row = {
      groupId: string | null;
      groupName: string | null;
      totalHours: string | null;
      billableHours: string | null;
      entryCount: number;
    };

    let results: Row[];

    if (groupBy === "project") {
      results = await db
        .select({
          groupId: projects.id,
          groupName: projects.name,
          totalHours: sql<string>`SUM(${timeLogs.hours})`,
          billableHours: sql<string>`SUM(CASE WHEN ${timeLogs.isBillable} THEN ${timeLogs.hours} ELSE 0 END)`,
          entryCount: sql<number>`COUNT(*)::int`,
        })
        .from(timeLogs)
        .innerJoin(projects, eq(timeLogs.projectId, projects.id))
        .where(dateFilter)
        .groupBy(projects.id, projects.name)
        .orderBy(sql`SUM(${timeLogs.hours}) DESC`);
    } else if (groupBy === "team_member") {
      results = await db
        .select({
          groupId: teamMembers.id,
          groupName: teamMembers.name,
          totalHours: sql<string>`SUM(${timeLogs.hours})`,
          billableHours: sql<string>`SUM(CASE WHEN ${timeLogs.isBillable} THEN ${timeLogs.hours} ELSE 0 END)`,
          entryCount: sql<number>`COUNT(*)::int`,
        })
        .from(timeLogs)
        .leftJoin(teamMembers, eq(timeLogs.teamMemberId, teamMembers.id))
        .where(dateFilter)
        .groupBy(teamMembers.id, teamMembers.name)
        .orderBy(sql`SUM(${timeLogs.hours}) DESC`);
    } else {
      results = await db
        .select({
          groupId: clients.id,
          groupName: clients.companyName,
          totalHours: sql<string>`SUM(${timeLogs.hours})`,
          billableHours: sql<string>`SUM(CASE WHEN ${timeLogs.isBillable} THEN ${timeLogs.hours} ELSE 0 END)`,
          entryCount: sql<number>`COUNT(*)::int`,
        })
        .from(timeLogs)
        .innerJoin(projects, eq(timeLogs.projectId, projects.id))
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(dateFilter)
        .groupBy(clients.id, clients.companyName)
        .orderBy(sql`SUM(${timeLogs.hours}) DESC`);
    }

    const totals = results.reduce(
      (acc, r) => ({
        totalHours: acc.totalHours + parseFloat(r.totalHours ?? "0"),
        billableHours: acc.billableHours + parseFloat(r.billableHours ?? "0"),
        entryCount: acc.entryCount + (r.entryCount || 0),
      }),
      { totalHours: 0, billableHours: 0, entryCount: 0 }
    );

    return {
      ok: true as const,
      data: {
        rows: results.map((r) => ({
          ...r,
          totalHours: parseFloat(r.totalHours ?? "0"),
          billableHours: parseFloat(r.billableHours ?? "0"),
        })),
        totals,
      },
    };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}
