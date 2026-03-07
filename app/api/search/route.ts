import { db } from "@/lib/db";
import { clients, projects, invoices, tasks } from "@/lib/db/schema";
import { ilike, or, eq, and, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 2)
    return NextResponse.json({
      clients: [],
      projects: [],
      invoices: [],
      tasks: [],
    });

  const search = `%${q}%`;

  const [clientResults, projectResults, invoiceResults, taskResults] =
    await Promise.all([
      db
        .select({
          id: clients.id,
          companyName: clients.companyName,
          status: clients.status,
        })
        .from(clients)
        .where(
          and(
            isNull(clients.deletedAt),
            or(
              ilike(clients.companyName, search),
              ilike(clients.contactName, search)
            )
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
          and(isNull(projects.deletedAt), ilike(projects.name, search))
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
        .where(ilike(invoices.invoiceNumber, search))
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
          and(isNull(tasks.deletedAt), ilike(tasks.title, search))
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
