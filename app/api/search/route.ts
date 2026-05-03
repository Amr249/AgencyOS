import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, projects, invoices, tasks } from "@/lib/db/schema";
import { ilike, or, eq, and, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { sessionUserRole } from "@/lib/auth-helpers";

const empty = {
  clients: [],
  projects: [],
  invoices: [],
  tasks: [],
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.user.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (sessionUserRole(session) !== "admin") {
    return NextResponse.json(empty);
  }

  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) return NextResponse.json(empty);

  const search = `%${q}%`;

  const [clientResults, projectResults, invoiceResults, taskResults] = await Promise.all([
    db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        status: clients.status,
      })
      .from(clients)
      .where(
        and(
          eq(clients.organizationId, orgId),
          isNull(clients.deletedAt),
          or(ilike(clients.companyName, search), ilike(clients.contactName, search))
        )
      )
      .limit(5),

    db
      .select({
        id: projects.id,
        name: projects.name,
        clientName: clients.companyName,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(
        and(
          eq(projects.organizationId, orgId),
          isNull(projects.deletedAt),
          ilike(projects.name, search)
        )
      )
      .limit(5),

    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        clientName: clients.companyName,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(eq(invoices.organizationId, orgId), ilike(invoices.invoiceNumber, search)))
      .limit(5),

    db
      .select({
        id: tasks.id,
        title: tasks.title,
        projectName: projects.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(eq(tasks.organizationId, orgId), isNull(tasks.deletedAt), ilike(tasks.title, search))
      )
      .limit(5),
  ]);

  return NextResponse.json({
    clients: clientResults,
    projects: projectResults,
    invoices: invoiceResults,
    tasks: taskResults,
  });
}
