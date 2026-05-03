import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getLocale, setRequestLocale } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getCachedOrganization } from "@/lib/org-snapshot";
import { AppSidebar } from "@/components/app-sidebar";
import { OrgPlanProvider, type OrgPlanSnapshot } from "@/components/org-plan-provider";
import { SiteHeader } from "@/components/site-header";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MemberDashboardLocaleShell } from "@/components/member-dashboard/member-dashboard-locale-shell";
import { WelcomeToast } from "@/components/welcome-toast";
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

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const isOnboardingRoute =
    pathname === "/dashboard/onboarding" || pathname.startsWith("/dashboard/onboarding/");

  let orgSnapshot: OrgPlanSnapshot | null = null;
  let orgForOnboarding: Awaited<ReturnType<typeof getCachedOrganization>> = null;
  if (!isMember && session.user.organizationId) {
    orgForOnboarding = await getCachedOrganization(session.user.organizationId);
    if (orgForOnboarding) {
      orgSnapshot = {
        plan: orgForOnboarding.plan,
        features: orgForOnboarding.features,
        trialEndsAt: orgForOnboarding.trialEndsAt ? orgForOnboarding.trialEndsAt.toISOString() : null,
        aiUsageCount: orgForOnboarding.aiUsageCount,
        storageUsedBytes: orgForOnboarding.storageUsedBytes,
      };
    }
  }

  const orgRole = session.user.orgRole;
  const isLeader = orgRole === "owner" || orgRole === "admin";

  if (!isMember && isLeader && orgForOnboarding) {
    if (orgForOnboarding.onboardingCompleted && isOnboardingRoute) {
      redirect("/dashboard");
    }
    if (!orgForOnboarding.onboardingCompleted && !isOnboardingRoute) {
      redirect("/dashboard/onboarding");
    }
  }

  if (isOnboardingRoute) {
    return <>{children}</>;
  }

  const mainContentClassName =
    "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:gap-6 px-4 py-4 md:px-6 md:py-6";

  const inner = (
    <>
      <SiteHeader
        hideGlobalSearch={isMember}
        hideLanguageToggle={isMember}
        orgPlanBanner={
          orgSnapshot
            ? { plan: orgSnapshot.plan, trialEndsAt: orgSnapshot.trialEndsAt }
            : null
        }
      />
      <div className="flex min-h-0 flex-1 flex-col pb-20 md:pb-0">
        <div className="@container/main flex min-h-0 flex-1 flex-col gap-2">
          <div className={mainContentClassName}>{children}</div>
        </div>
      </div>
      <MobileBottomNav userRole={userRole} />
      <WelcomeToast />
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
      <OrgPlanProvider value={orgSnapshot}>
        <AppSidebar variant="inset" side={sidebarSide} userRole={userRole} />
        <SidebarInset
          className={
            isMember
              ? "min-h-0 h-svh max-h-svh overflow-hidden"
              : "min-h-0 h-svh max-h-svh overflow-hidden"
          }
        >
          {isMember ? (
            <div
              dir="rtl"
              lang="ar"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <MemberDashboardLocaleShell>{inner}</MemberDashboardLocaleShell>
            </div>
          ) : locale === "ar" ? (
            <div dir="rtl" lang="ar" className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {inner}
            </div>
          ) : (
            inner
          )}
        </SidebarInset>
      </OrgPlanProvider>
    </SidebarProvider>
  );
}
