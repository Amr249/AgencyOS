"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChartBar,
  IconDashboard,
  IconFileText,
  IconFolder,
  IconReceipt,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme-toggle";
import { PortalUserNav } from "@/components/portal/portal-user-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function navActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalSidebar({
  clientCompanyName,
  clientLogoUrl,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  clientCompanyName: string | null;
  clientLogoUrl: string | null;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const t = useTranslations("clientPortal");

  const agencyBrand = t("agencyOs");

  const links = [
    { href: "/portal", label: t("navHome"), icon: IconDashboard, exact: true },
    { href: "/portal/projects", label: t("navProjects"), icon: IconFolder, exact: false },
    { href: "/portal/invoices", label: t("navInvoices"), icon: IconReceipt, exact: false },
    { href: "/portal/progress", label: t("navProgress"), icon: IconChartBar, exact: false },
    { href: "/portal/files", label: t("navFiles"), icon: IconFileText, exact: false },
  ];

  return (
    <Sidebar collapsible="icon" side="right" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={agencyBrand}
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link
                href="/portal"
                className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                onClick={() => setOpenMobile(false)}
              >
                <Image
                  src="/Logo1.png"
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 shrink-0 rounded-md"
                />
                <span className="group-data-[collapsible=icon]:hidden text-[15px] font-medium">
                  {agencyBrand}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {links.map(({ href, label, icon: Icon, exact }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                asChild
                isActive={navActive(pathname, href, exact)}
                className={cn(navActive(pathname, href, exact) && "font-medium")}
              >
                <Link href={href} onClick={() => setOpenMobile(false)}>
                  <Icon className="size-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-end gap-1 px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <ThemeToggle />
        </div>
        <PortalUserNav
          clientCompanyName={clientCompanyName}
          clientLogoUrl={clientLogoUrl}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
