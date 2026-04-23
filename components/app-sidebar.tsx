"use client";

import * as React from "react";
import Image from "next/image";
import {
  IconBuilding,
  IconChartBar,
  IconDashboard,
  IconFileText,
  IconFolder,
  IconListDetails,
  IconReceipt,
  IconReport,
  IconLayoutKanban,
  IconSparkles,
  IconUserCircle,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { Building2, FolderKanban, UserCog, Wallet } from "lucide-react";
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
  userRole = "admin",
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  userRole?: "admin" | "member" | null;
}) {
  const { setOpenMobile } = useSidebar();
  const t = useTranslations("nav");

  const isMember = userRole === "member";
  const homeHref = isMember ? "/dashboard/me" : "/dashboard";

  const dashboard = isMember
    ? { title: t("myDashboard"), url: "/dashboard/me", icon: IconDashboard }
    : { title: t("dashboard"), url: "/dashboard", icon: IconDashboard };
  const settings = { title: t("settings"), url: "/dashboard/settings", icon: IconChartBar };

  const groups = isMember
    ? [
        {
          id: "member-work",
          label: t("memberWork"),
          icon: FolderKanban,
                   children: [
            { title: t("projects"), url: "/dashboard/projects", icon: IconFolder },
            { title: t("workspace"), url: "/dashboard/workspace", icon: IconListDetails },
            { title: t("payments"), url: "/dashboard/payments", icon: IconReceipt },
            { title: t("account"), url: "/dashboard/account", icon: IconUserCircle },
          ],
        },
      ]
    : [
    {
      id: "crm",
      label: "CRM",
      icon: Building2,
      children: [
        { title: t("clients"), url: "/dashboard/clients", icon: IconBuilding },
        { title: t("pipeline"), url: "/dashboard/crm/pipeline", icon: IconLayoutKanban },
        { title: t("proposals"), url: "/dashboard/proposals", icon: IconFileText },
      ],
    },
    {
      id: "project-management",
      label: "Project Management",
      icon: FolderKanban,
      children: [
        { title: t("projects"), url: "/dashboard/projects", icon: IconFolder },
        { title: t("workspace"), url: "/dashboard/workspace", icon: IconListDetails },
      ],
    },
    {
      id: "finance",
      label: "Finance",
      icon: Wallet,
      children: [
        { title: t("invoices"), url: "/dashboard/invoices", icon: IconReceipt },
        { title: t("expenses"), url: "/dashboard/expenses", icon: IconWallet },
        { title: t("reports"), url: "/dashboard/reports", icon: IconReport },
      ],
    },
    {
      id: "hr",
      label: "HR",
      icon: UserCog,
      children: [
        { title: t("team"), url: "/dashboard/team", icon: IconUsers },
        { title: t("services"), url: "/dashboard/services", icon: IconListDetails },
      ],
    },
  ];

  return (
    <Sidebar collapsible="icon" side={props.side ?? "right"} {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="AgencyOS"
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a
                href={homeHref}
                className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                onClick={() => setOpenMobile(false)}
              >
                <Image
                  src="/Logo1.png"
                  alt="AgencyOS"
                  width={32}
                  height={32}
                  className="size-8 shrink-0 rounded-md"
                />
                <span className="text-[15px] font-medium group-data-[collapsible=icon]:hidden">
                  AgencyOS
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          dashboard={dashboard}
          settings={settings}
          groups={groups}
          footerBeforeSettings={
            !isMember
              ? [{ title: t("aiChat"), url: "/dashboard/ai-chat", icon: IconSparkles }]
              : undefined
          }
          showSettings={!isMember}
          collapsibleGroups={!isMember}
        />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-end gap-1 px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <ThemeToggle />
        </div>
        <UserNav />
      </SidebarFooter>
    </Sidebar>
  );
}
