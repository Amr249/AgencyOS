"use server";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  clients,
  expenses,
  expenseServices,
  files,
  projectMembers,
  projectUserMembers,
  projects,
  services,
  teamMembers,
} from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { getTeamMemberIdsForSessionUser } from "@/lib/member-context";

export type MemberProjectMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type MemberProjectRow = {
  id: string;
  name: string;
  status: string;
  clientName: string;
  coverImageUrl: string | null;
  clientLogoUrl: string | null;
  members: MemberProjectMember[];
};

export type MemberSalaryExpenseRow = {
  id: string;
  title: string;
  amount: string;
  date: string;
  receiptUrl: string | null;
  projectId: string | null;
  projectName: string | null;
  projectCoverImageUrl: string | null;
  projectClientLogoUrl: string | null;
  serviceNames: string[];
};

export async function getMemberDashboardData(): Promise<
  | {
      ok: true;
      data: {
        projects: MemberProjectRow[];
        salaryExpenses: MemberSalaryExpenseRow[];
      };
    }
  | { ok: false; error: string }
> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { ok: false, error: "unauthorized" };
    if (sessionUserRole(session) !== "member") return { ok: false, error: "forbidden" };

    const userId = session.user.id;
    const memberIds = await getTeamMemberIdsForSessionUser(userId);

    const projectIdSet = new Set<string>();

    if (memberIds.length > 0) {
      const fromTeam = await db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(inArray(projectMembers.teamMemberId, memberIds));
      for (const r of fromTeam) projectIdSet.add(r.projectId);
    }

    const fromUser = await db
      .select({ projectId: projectUserMembers.projectId })
      .from(projectUserMembers)
      .where(eq(projectUserMembers.userId, userId));
    for (const r of fromUser) projectIdSet.add(r.projectId);

    const projectIds = [...projectIdSet];

    let projectRows: MemberProjectRow[] = [];
    if (projectIds.length > 0) {
      const rows = await db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          clientName: clients.companyName,
          coverImageUrl: projects.coverImageUrl,
          clientLogoUrl: clients.logoUrl,
        })
        .from(projects)
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(inArray(projects.id, projectIds))
        .orderBy(asc(projects.name));
      const memberRows = await db
        .select({
          projectId: projectMembers.projectId,
          id: teamMembers.id,
          name: teamMembers.name,
          avatarUrl: teamMembers.avatarUrl,
        })
        .from(projectMembers)
        .innerJoin(teamMembers, eq(projectMembers.teamMemberId, teamMembers.id))
        .where(inArray(projectMembers.projectId, projectIds));

      const membersMap = new Map<string, MemberProjectMember[]>();
      for (const m of memberRows) {
        if (!m.projectId) continue;
        if (!membersMap.has(m.projectId)) membersMap.set(m.projectId, []);
        membersMap.get(m.projectId)!.push({ id: m.id, name: m.name, avatarUrl: m.avatarUrl });
      }

      projectRows = rows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        clientName: r.clientName,
        coverImageUrl: r.coverImageUrl,
        clientLogoUrl: r.clientLogoUrl,
        members: membersMap.get(r.id) ?? [],
      }));
    }

    let salaryExpenses: MemberSalaryExpenseRow[] = [];
    if (memberIds.length > 0) {
      const expRows = await db
        .select({
          id: expenses.id,
          title: expenses.title,
          amount: expenses.amount,
          date: expenses.date,
          receiptUrl: expenses.receiptUrl,
          projectId: expenses.projectId,
          projectName: projects.name,
          projectCoverImageUrl: projects.coverImageUrl,
          clientLogoUrl: clients.logoUrl,
        })
        .from(expenses)
        .leftJoin(projects, eq(expenses.projectId, projects.id))
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(
          and(eq(expenses.category, "salaries"), inArray(expenses.teamMemberId, memberIds))
        )
        .orderBy(desc(expenses.date), desc(expenses.createdAt));

      const expIds = expRows.map((r) => r.id);
      const svcMap = new Map<string, string[]>();
      if (expIds.length > 0) {
        const svcRows = await db
          .select({
            expenseId: expenseServices.expenseId,
            serviceName: services.name,
          })
          .from(expenseServices)
          .innerJoin(services, eq(expenseServices.serviceId, services.id))
          .where(inArray(expenseServices.expenseId, expIds));
        for (const s of svcRows) {
          const arr = svcMap.get(s.expenseId) ?? [];
          arr.push(s.serviceName);
          svcMap.set(s.expenseId, arr);
        }
      }

      salaryExpenses = expRows.map((r) => ({
        id: r.id,
        title: r.title,
        amount: String(r.amount),
        date: typeof r.date === "string" ? r.date : String(r.date),
        receiptUrl: r.receiptUrl ?? null,
        projectId: r.projectId ?? null,
        projectName: r.projectName ?? null,
        projectCoverImageUrl: r.projectCoverImageUrl ?? null,
        projectClientLogoUrl: r.clientLogoUrl ?? null,
        serviceNames: svcMap.get(r.id) ?? [],
      }));
    }

    return {
      ok: true,
      data: {
        projects: projectRows,
        salaryExpenses,
      },
    };
  } catch (e) {
    console.error("getMemberDashboardData", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

const updateMemberExpenseSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projectId: z.string().uuid().optional().nullable(),
});

export async function updateMemberExpense(input: z.infer<typeof updateMemberExpenseSchema>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || sessionUserRole(session) !== "member") {
    return { ok: false as const, error: "forbidden" };
  }
  const parsed = updateMemberExpenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const memberIds = await getTeamMemberIdsForSessionUser(session.user.id);
  if (memberIds.length === 0) return { ok: false as const, error: "forbidden" };

  try {
    const existing = await db.query.expenses.findFirst({
      where: and(eq(expenses.id, parsed.data.id), inArray(expenses.teamMemberId, memberIds)),
    });
    if (!existing) return { ok: false as const, error: "not_found" };

    const [row] = await db
      .update(expenses)
      .set({
        amount: String(parsed.data.amount),
        date: parsed.data.date,
        ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId } : {}),
      })
      .where(eq(expenses.id, parsed.data.id))
      .returning();

    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/me");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateMemberExpense", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "unknown" };
  }
}

export async function deleteMemberExpense(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || sessionUserRole(session) !== "member") {
    return { ok: false as const, error: "forbidden" };
  }
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "invalid_id" };

  const memberIds = await getTeamMemberIdsForSessionUser(session.user.id);
  if (memberIds.length === 0) return { ok: false as const, error: "forbidden" };

  try {
    const existing = await db.query.expenses.findFirst({
      where: and(eq(expenses.id, parsed.data), inArray(expenses.teamMemberId, memberIds)),
    });
    if (!existing) return { ok: false as const, error: "not_found" };

    await db.delete(expenses).where(eq(expenses.id, parsed.data));
    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/me");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteMemberExpense", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "unknown" };
  }
}

export type MemberExpenseFileRow = {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

export async function getMemberExpenseFiles(expenseId: string): Promise<
  { ok: true; data: MemberExpenseFileRow[] } | { ok: false; error: string }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || sessionUserRole(session) !== "member") {
    return { ok: false, error: "forbidden" };
  }
  const parsed = z.string().uuid().safeParse(expenseId);
  if (!parsed.success) return { ok: false, error: "invalid_id" };

  try {
    const rows = await db
      .select({
        id: files.id,
        name: files.name,
        url: files.imagekitUrl,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
      })
      .from(files)
      .where(and(eq(files.expenseId, parsed.data), isNull(files.deletedAt)))
      .orderBy(desc(files.createdAt));

    return { ok: true, data: rows };
  } catch (e) {
    console.error("getMemberExpenseFiles", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}
