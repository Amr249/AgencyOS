"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { PortalInsetHeader } from "@/components/portal/portal-inset-header";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function PortalAppShell({
  children,
  clientCompanyName,
  clientLogoUrl,
}: {
  children: React.ReactNode;
  clientCompanyName: string | null;
  clientLogoUrl: string | null;
}) {
  const pathname = usePathname();
  if (pathname === "/portal/login") {
    return <>{children}</>;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <PortalSidebar
        clientCompanyName={clientCompanyName}
        clientLogoUrl={clientLogoUrl}
        variant="inset"
      />
      <SidebarInset>
        <PortalInsetHeader />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col pb-20 md:pb-0">
          <div className="@container/main flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            <div className="flex w-full min-w-0 flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
