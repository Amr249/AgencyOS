"use client";

import * as React from "react";
import Image from "next/image";
import {
  IconBuilding,
  IconChartBar,
  IconDashboard,
  IconFolder,
  IconListDetails,
  IconReceipt,
  IconReport,
  IconWallet,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navMain = [
  { title: "لوحة التحكم", url: "/dashboard", icon: IconDashboard },
  { title: "العملاء", url: "/dashboard/clients", icon: IconBuilding },
  { title: "المشاريع", url: "/dashboard/projects", icon: IconFolder },
  { title: "المهام", url: "/dashboard/tasks", icon: IconListDetails },
  { title: "الفواتير", url: "/dashboard/invoices", icon: IconReceipt },
  { title: "المصروفات", url: "/dashboard/expenses", icon: IconWallet },
  { title: "التقارير", url: "/dashboard/reports", icon: IconReport },
  { title: "الإعدادات", url: "/dashboard/settings", icon: IconChartBar },
];

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: SessionUser | null;
}) {
  const displayUser = user
    ? {
        name: user.name ?? "Admin",
        email: user.email ?? "",
        avatar: user.image ?? "",
      }
    : { name: "Admin", email: "", avatar: "" };

  return (
    <Sidebar collapsible="icon" side={props.side ?? "right"} {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <a href="/dashboard" className="flex items-center gap-2">
                <Image
                  src="/Logo3.png"
                  alt="AgencyOS"
                  width={32}
                  height={32}
                  className="rounded-md"
                />
                <span className="text-base font-medium">AgencyOS</span>
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
        <NavUser user={displayUser} />
      </SidebarFooter>
    </Sidebar>
  );
}
