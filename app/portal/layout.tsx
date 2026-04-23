import * as React from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { getPortalSession } from "@/lib/portal-session";
import { PortalShell } from "@/components/portal/portal-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getPortalSession();
  let clientName: string | null = null;
  if (ctx) {
    const [row] = await db
      .select({ companyName: clients.companyName })
      .from(clients)
      .where(eq(clients.id, ctx.clientId))
      .limit(1);
    clientName = row?.companyName ?? null;
  }

  return <PortalShell clientName={clientName}>{children}</PortalShell>;
}
