import React from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getLocale, setRequestLocale } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MemberDashboardLocaleShell } from "@/components/member-dashboard/member-dashboard-locale-shell";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  if ((session.user as { role?: string }).role === "client_portal") {
    redirect("/portal");
  }

  const userRole = sessionUserRole(session);
  const isMember = userRole === "member";

  if (isMember) {
    setRequestLocale("ar");
  }

  const locale = isMember ? "ar" : await getLocale();
  const sidebarSide = locale === "ar" ? "right" : "left";

  const inner = (
    <>
      <SiteHeader hideGlobalSearch={isMember} hideLanguageToggle={isMember} />
      <div className="flex flex-1 flex-col pb-20 md:pb-0">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 md:gap-6 px-4 py-4 md:px-6 md:py-6">
            {children}
          </div>
        </div>
      </div>
      <MobileBottomNav userRole={userRole} />
    </>
  );

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" side={sidebarSide} userRole={userRole} />
      <SidebarInset>
        {isMember ? (
          <div dir="rtl" lang="ar">
            <MemberDashboardLocaleShell>{inner}</MemberDashboardLocaleShell>
          </div>
        ) : (
          inner
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
