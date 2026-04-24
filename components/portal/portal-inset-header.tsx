"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function PortalInsetHeader() {
  const pathname = usePathname();
  const t = useTranslations("clientPortal");

  let title = t("headerHome");
  if (pathname.startsWith("/portal/projects/") && pathname !== "/portal/projects") {
    title = t("headerProjectDetail");
  } else if (pathname.startsWith("/portal/projects")) {
    title = t("navProjects");
  } else if (pathname.startsWith("/portal/invoices")) {
    title = t("navInvoices");
  } else if (pathname.startsWith("/portal/progress")) {
    title = t("navProgress");
  } else if (pathname.startsWith("/portal/files")) {
    title = t("navFiles");
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ms-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-base font-medium">{title}</h1>
        </div>
      </div>
    </header>
  );
}
