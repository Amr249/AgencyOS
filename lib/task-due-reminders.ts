import { and, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { listAdminUserIds, insertDedupedNotification } from "@/actions/notifications";
import { projects, taskAssignments, tasks, teamMembers } from "@/lib/db/schema";
import { resolveUserIdForTeamMember } from "@/lib/member-context";

const WORKSPACE_URL = "/dashboard/workspace";

function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addUtcDays(ymd: string, days: number): string {
  const [y, m, day] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + days));
  return dt.toISOString().slice(0, 10);
}

async function loadAssigneeTeamMemberIdsForTasks(taskIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, Set<string>>();
  for (const id of taskIds) map.set(id, new Set());

  if (taskIds.length === 0) return new Map();

  const primaries = await db
    .select({ taskId: tasks.id, assigneeId: tasks.assigneeId })
    .from(tasks)
    .where(and(inArray(tasks.id, taskIds), isNotNull(tasks.assigneeId)));

  for (const p of primaries) {
    map.get(p.taskId)!.add(p.assigneeId as string);
  }

  const junction = await db
    .select({
      taskId: taskAssignments.taskId,
      memberId: taskAssignments.teamMemberId,
    })
    .from(taskAssignments)
    .where(inArray(taskAssignments.taskId, taskIds));

  for (const j of junction) {
    map.get(j.taskId)!.add(j.memberId);
  }

  return new Map([...map].map(([k, v]) => [k, [...v]]));
}

async function namesForTeamMemberIds(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const rows = await db
    .select({ id: teamMembers.id, name: teamMembers.name })
    .from(teamMembers)
    .where(inArray(teamMembers.id, ids));
  for (const r of rows) out.set(r.id, r.name?.trim() || r.id);
  return out;
}

export type TaskDueReminderJobResult = {
  todayUtc: string;
  tomorrowUtc: string;
  tasksScanned: number;
  memberDueSoon: number;
  memberDueToday: number;
  adminDueSoon: number;
  adminDueToday: number;
};

/**
 * Sends in-app notifications for tasks due tomorrow (heads-up) and due today.
 * - Assignees (linked login): one notification each per task per phase (deduped).
 * - Admins: one notification each per task for every matching task (org-wide).
 *
 * Intended to run once daily via cron (UTC calendar dates).
 */
export async function runTaskDueReminderJob(): Promise<
  { ok: true; data: TaskDueReminderJobResult } | { ok: false; error: string }
> {
  try {
    const todayUtc = utcYmd(new Date());
    const tomorrowUtc = addUtcDays(todayUtc, 1);

    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        projectId: tasks.projectId,
        projectName: projects.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          isNull(tasks.deletedAt),
          isNotNull(tasks.dueDate),
          ne(tasks.status, "done"),
          or(eq(tasks.dueDate, todayUtc), eq(tasks.dueDate, tomorrowUtc))!
        )
      );

    const taskIds = rows.map((r) => r.id);
    const assigneesByTask = await loadAssigneeTeamMemberIdsForTasks(taskIds);
    const adminIds = await listAdminUserIds();

    let memberDueSoon = 0;
    let memberDueToday = 0;
    let adminDueSoon = 0;
    let adminDueToday = 0;

    const allMemberIds = new Set<string>();
    for (const ids of assigneesByTask.values()) ids.forEach((id) => allMemberIds.add(id));
    const nameByMemberId = await namesForTeamMemberIds([...allMemberIds]);

    for (const task of rows) {
      const rawDue: unknown = task.dueDate;
      const dueStr =
        typeof rawDue === "string"
          ? rawDue.slice(0, 10)
          : rawDue instanceof Date
            ? rawDue.toISOString().slice(0, 10)
            : String(rawDue).slice(0, 10);
      const titleSafe = task.title?.trim() || "مهمة";
      const projectSafe = task.projectName?.trim() || "مشروع";

      const assigneeMemberIds = assigneesByTask.get(task.id) ?? [];
      const assigneeNames = assigneeMemberIds
        .map((id) => nameByMemberId.get(id))
        .filter(Boolean)
        .join("، ");

      const isDueTomorrow = dueStr === tomorrowUtc;
      const isDueToday = dueStr === todayUtc;

      // ── Assignees (members with logins only) ─────────────────────────────
      if (isDueTomorrow) {
        for (const tmId of assigneeMemberIds) {
          const userId = await resolveUserIdForTeamMember(tmId);
          if (!userId) continue;
          const dedupeKey = `tr:due_soon:${userId}:${task.id}:${dueStr}`;
          const ok = await insertDedupedNotification({
            userId,
            dedupeKey,
            type: "task.due_soon",
            title: "تذكير: مهمة مستحقة غداً",
            body: `«${titleSafe}» — مشروع «${projectSafe}».`,
            linkUrl: WORKSPACE_URL,
            actorId: null,
          });
          if (ok) memberDueSoon += 1;
        }
      }

      if (isDueToday) {
        for (const tmId of assigneeMemberIds) {
          const userId = await resolveUserIdForTeamMember(tmId);
          if (!userId) continue;
          const dedupeKey = `tr:due_today:${userId}:${task.id}:${dueStr}`;
          const ok = await insertDedupedNotification({
            userId,
            dedupeKey,
            type: "task.due_today",
            title: "المهمة مستحقة اليوم",
            body: `«${titleSafe}» — مشروع «${projectSafe}».`,
            linkUrl: WORKSPACE_URL,
            actorId: null,
          });
          if (ok) memberDueToday += 1;
        }
      }

      // ── Admins: all tasks (including unassigned) ─────────────────────────
      const adminBodyBase = assigneeNames
        ? `«${titleSafe}» — «${projectSafe}» — المكلفون: ${assigneeNames}.`
        : `«${titleSafe}» — «${projectSafe}» — لا يوجد مكلف محدد.`;

      if (isDueTomorrow) {
        for (const adminId of adminIds) {
          const dedupeKey = `tr:adm_due_soon:${adminId}:${task.id}:${dueStr}`;
          const ok = await insertDedupedNotification({
            userId: adminId,
            dedupeKey,
            type: "task.admin.due_soon",
            title: "[إدارة] مهمة مستحقة غداً",
            body: adminBodyBase,
            linkUrl: WORKSPACE_URL,
            actorId: null,
          });
          if (ok) adminDueSoon += 1;
        }
      }

      if (isDueToday) {
        for (const adminId of adminIds) {
          const dedupeKey = `tr:adm_due_today:${adminId}:${task.id}:${dueStr}`;
          const ok = await insertDedupedNotification({
            userId: adminId,
            dedupeKey,
            type: "task.admin.due_today",
            title: "[إدارة] مهمة مستحقة اليوم",
            body: adminBodyBase,
            linkUrl: WORKSPACE_URL,
            actorId: null,
          });
          if (ok) adminDueToday += 1;
        }
      }
    }

    return {
      ok: true,
      data: {
        todayUtc,
        tomorrowUtc,
        tasksScanned: rows.length,
        memberDueSoon,
        memberDueToday,
        adminDueSoon,
        adminDueToday,
      },
    };
  } catch (e) {
    console.error("runTaskDueReminderJob", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
