"use client";

import * as React from "react";
import Image from "next/image";
import {
  IconBuilding,
  IconChartBar,
  IconDashboard,
  IconFileText,
  IconFolder,
  IconListCheck,
  IconListDetails,
  IconReceipt,
  IconReport,
  IconLayoutKanban,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { UserNav } from "@/components/dashboard/user-nav";
import { NavMain } from "@/components/nav-main";
import { ThemeToggle } from "@/components/theme-toggle";
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

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { setOpenMobile } = useSidebar();
  const t = useTranslations("nav");

  const navMain = [
    { title: t("dashboard"), url: "/dashboard", icon: IconDashboard },
    { title: t("tasks"), url: "/dashboard/my-tasks", icon: IconListCheck },
    { title: t("clients"), url: "/dashboard/clients", icon: IconBuilding },
    { title: t("proposals"), url: "/dashboard/proposals", icon: IconFileText },
    { title: t("projects"), url: "/dashboard/projects", icon: IconFolder },
    { title: t("services"), url: "/dashboard/services", icon: IconListDetails },
    { title: t("team"), url: "/dashboard/team", icon: IconUsers },
    { title: t("allTasks"), url: "/dashboard/tasks", icon: IconListDetails },
    { title: t("workspace"), url: "/dashboard/workspace", icon: IconLayoutKanban },
    { title: t("invoices"), url: "/dashboard/invoices", icon: IconReceipt },
    { title: t("expenses"), url: "/dashboard/expenses", icon: IconWallet },
    { title: t("reports"), url: "/dashboard/reports", icon: IconReport },
    { title: t("settings"), url: "/dashboard/settings", icon: IconChartBar },
  ];

  return (
    <Sidebar collapsible="icon" side={props.side ?? "right"} {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <a href="/dashboard" className="flex items-center gap-2" onClick={() => setOpenMobile(false)}>
                <Image
                  src="/Logo1.png"
                  alt="AgencyOS"
                  width={32}
                  height={32}
                  className="rounded-md"
                />
                <span className="text-[15px] font-medium">AgencyOS</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-end gap-1 px-2 py-1">
          <ThemeToggle />
        </div>
        <UserNav />
      </SidebarFooter>
    </Sidebar>
  );
}
