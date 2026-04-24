import * as React from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { getPortalSession } from "@/lib/portal-session";
import { MemberDashboardLocaleShell } from "@/components/member-dashboard/member-dashboard-locale-shell";
import { PortalAppShell } from "@/components/portal/portal-app-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getPortalSession();
  let clientCompanyName: string | null = null;
  let clientLogoUrl: string | null = null;
  if (ctx) {
    const [row] = await db
      .select({
        companyName: clients.companyName,
        logoUrl: clients.logoUrl,
      })
      .from(clients)
      .where(eq(clients.id, ctx.clientId))
      .limit(1);
    clientCompanyName = row?.companyName ?? null;
    clientLogoUrl = row?.logoUrl ?? null;
  }

  return (
    <MemberDashboardLocaleShell>
      <div dir="rtl" lang="ar" className="min-h-svh">
        <PortalAppShell clientCompanyName={clientCompanyName} clientLogoUrl={clientLogoUrl}>
          {children}
        </PortalAppShell>
      </div>
    </MemberDashboardLocaleShell>
  );
}
