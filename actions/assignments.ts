'use server';

import { db } from '@/lib/db';
import { taskAssignments, users, tasks, projects } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { isDbConnectionError } from '@/lib/db-errors';

// ── Get all team members (for assignee picker) ──────────────────────────────
export async function getTeamMembers() {
  try {
    const members = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role,
      })
      .from(users)
      .orderBy(users.name);
    return { data: members, error: null };
  } catch (error) {
    if (isDbConnectionError(error)) {
      return { data: null, error: 'تعذّر الاتصال بقاعدة البيانات. حاول مجدداً.' };
    }
    return { data: null, error: 'حدث خطأ أثناء تحميل أعضاء الفريق.' };
  }
}

// ── Assign a task to a user ──────────────────────────────────────────────────
export async function assignTask(taskId: string, userId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'غير مصرح. يرجى تسجيل الدخول.' };
    }

    // Prevent duplicate assignments
    const existing = await db
      .select()
      .from(taskAssignments)
      .where(
        and(
          eq(taskAssignments.taskId, taskId),
          eq(taskAssignments.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'هذا المستخدم مُعيَّن بالفعل لهذه المهمة.' };
    }

    await db.insert(taskAssignments).values({
      taskId,
      userId,
      assignedBy: session.user.id,
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/my-tasks');
    return { success: true, error: null };
  } catch (error) {
    if (isDbConnectionError(error)) {
      return { success: false, error: 'تعذّر الاتصال بقاعدة البيانات. حاول مجدداً.' };
    }
    return { success: false, error: 'حدث خطأ أثناء تعيين المهمة.' };
  }
}

// ── Remove an assignment ─────────────────────────────────────────────────────
export async function unassignTask(taskId: string, userId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'غير مصرح. يرجى تسجيل الدخول.' };
    }

    await db
      .delete(taskAssignments)
      .where(
        and(
          eq(taskAssignments.taskId, taskId),
          eq(taskAssignments.userId, userId)
        )
      );

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/my-tasks');
    return { success: true, error: null };
  } catch (error) {
    if (isDbConnectionError(error)) {
      return { success: false, error: 'تعذّر الاتصال بقاعدة البيانات. حاول مجدداً.' };
    }
    return { success: false, error: 'حدث خطأ أثناء إلغاء تعيين المهمة.' };
  }
}

// ── Get tasks assigned to the current logged-in user ────────────────────────
export async function getMyTasks() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { data: null, error: 'غير مصرح. يرجى تسجيل الدخول.' };
    }

    const myTasks = await db
      .select({
        taskId: tasks.id,
        taskTitle: tasks.title,
        taskStatus: tasks.status,
        taskPriority: tasks.priority,
        taskDueDate: tasks.dueDate,
        assignedAt: taskAssignments.assignedAt,
        projectId: projects.id,
        projectName: projects.name,
      })
      .from(taskAssignments)
      .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(taskAssignments.userId, session.user.id))
      .orderBy(taskAssignments.assignedAt);

    return { data: myTasks, error: null };
  } catch (error) {
    if (isDbConnectionError(error)) {
      return { data: null, error: 'تعذّر الاتصال بقاعدة البيانات. حاول مجدداً.' };
    }
    return { data: null, error: 'حدث خطأ أثناء تحميل مهامك.' };
  }
}

// ── Get all assignees for a specific task ────────────────────────────────────
export async function getTaskAssignees(taskId: string) {
  try {
    const assignees = await db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        assignedAt: taskAssignments.assignedAt,
      })
      .from(taskAssignments)
      .innerJoin(users, eq(taskAssignments.userId, users.id))
      .where(eq(taskAssignments.taskId, taskId))
      .orderBy(taskAssignments.assignedAt);

    return { data: assignees, error: null };
  } catch (error) {
    if (isDbConnectionError(error)) {
      return { data: null, error: 'تعذّر الاتصال بقاعدة البيانات. حاول مجدداً.' };
    }
    return { data: null, error: 'حدث خطأ أثناء تحميل المُعيَّنين.' };
  }
}

// ── Get assignees for multiple tasks (batch, for task cards) ──────────────────
export async function getAssigneesForTaskIds(taskIds: string[]) {
  try {
    if (taskIds.length === 0) return { data: {} as Record<string, { userId: string; name: string; avatarUrl: string | null }[]>, error: null };
    const rows = await db
      .select({
        taskId: taskAssignments.taskId,
        userId: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(taskAssignments)
      .innerJoin(users, eq(taskAssignments.userId, users.id))
      .where(inArray(taskAssignments.taskId, taskIds))
      .orderBy(taskAssignments.assignedAt);

    const byTask: Record<string, { userId: string; name: string; avatarUrl: string | null }[]> = {};
    for (const r of rows) {
      if (!byTask[r.taskId]) byTask[r.taskId] = [];
      byTask[r.taskId].push({ userId: r.userId, name: r.name, avatarUrl: r.avatarUrl });
    }
    return { data: byTask, error: null };
  } catch (error) {
    if (isDbConnectionError(error)) {
      return { data: {} as Record<string, { userId: string; name: string; avatarUrl: string | null }[]>, error: 'تعذّر الاتصال بقاعدة البيانات. حاول مجدداً.' };
    }
    return { data: {} as Record<string, { userId: string; name: string; avatarUrl: string | null }[]>, error: 'حدث خطأ أثناء تحميل المُعيَّنين.' };
  }
}
