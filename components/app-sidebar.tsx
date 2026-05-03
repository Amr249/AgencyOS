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
import { NavMain, type NavLeaf } from "@/components/nav-main";
import { ThemeToggle } from "@/components/theme-toggle";
import { useFeature } from "@/components/org-plan-provider";
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

function filterNavLeaves(items: NavLeaf[], hasProposals: boolean): NavLeaf[] {
  return items.filter((item) => {
    if (!item.feature) return true;
    if (item.feature === "proposals") return hasProposals;
    return true;
  });
}

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

  const hasProposals = useFeature("proposals");

  const dashboard = isMember
    ? { title: t("myDashboard"), url: "/dashboard/me", icon: IconDashboard }
    : { title: t("dashboard"), url: "/dashboard", icon: IconDashboard };
  const settings = { title: t("settings"), url: "/dashboard/settings", icon: IconChartBar };

  const groups = React.useMemo(() => {
    if (isMember) {
      return [
        {
          id: "member-work",
          label: t("memberWork"),
          icon: FolderKanban,
          children: [
            { title: t("projects"), url: "/dashboard/projects", icon: IconFolder },
            { title: t("workspace"), url: "/dashboard/workspace", icon: IconListDetails },
            { title: t("drive"), url: "/dashboard/member-drive", icon: IconFolder },
            { title: t("payments"), url: "/dashboard/payments", icon: IconReceipt },
            { title: t("account"), url: "/dashboard/account", icon: IconUserCircle },
          ],
        },
      ];
    }

    const crmChildren: NavLeaf[] = filterNavLeaves(
      [
        { title: t("clients"), url: "/dashboard/clients", icon: IconBuilding },
        { title: t("pipeline"), url: "/dashboard/crm/pipeline", icon: IconLayoutKanban },
        { title: t("proposals"), url: "/dashboard/proposals", icon: IconFileText, feature: "proposals" },
      ],
      hasProposals
    );

    const pmChildren: NavLeaf[] = [
      { title: t("projects"), url: "/dashboard/projects", icon: IconFolder },
      { title: t("workspace"), url: "/dashboard/workspace", icon: IconListDetails },
    ];

    const financeChildren: NavLeaf[] = [
      { title: t("invoices"), url: "/dashboard/invoices", icon: IconReceipt },
      { title: t("expenses"), url: "/dashboard/expenses", icon: IconWallet },
      { title: t("reports"), url: "/dashboard/reports", icon: IconReport },
    ];

    const hrChildren: NavLeaf[] = filterNavLeaves(
      [
        { title: t("team"), url: "/dashboard/team", icon: IconUsers },
        { title: t("services"), url: "/dashboard/services", icon: IconListDetails },
      ],
      hasProposals
    );

    return [
      { id: "crm", label: t("groupCrm"), icon: Building2, children: crmChildren },
      { id: "project-management", label: t("groupProjectManagement"), icon: FolderKanban, children: pmChildren },
      { id: "finance", label: t("groupFinance"), icon: Wallet, children: financeChildren },
      { id: "hr", label: t("groupHr"), icon: UserCog, children: hrChildren },
    ];
  }, [isMember, t, hasProposals]);

  return (
    <Sidebar collapsible="icon" side={props.side ?? "right"} {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={`${t("appBrand")} ${t("betaBadge")}`}
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
                  alt={`${t("appBrand")} ${t("betaBadge")}`}
                  width={32}
                  height={32}
                  className="size-8 shrink-0 rounded-md"
                />
                <span className="group-data-[collapsible=icon]:hidden flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-[15px] font-medium">{t("appBrand")}</span>
                  <span
                    className="shrink-0 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-none text-black dark:border-neutral-700 dark:bg-white dark:text-black"
                    title={t("betaBadge")}
                  >
                    {t("betaBadge")}
                  </span>
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
              ? [
                  { title: t("aiChat"), url: "/dashboard/ai-chat", icon: IconSparkles },
                  { title: t("drive"), url: "/dashboard/drive", icon: IconFolder },
                ]
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
