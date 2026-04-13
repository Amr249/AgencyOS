"use client";

import * as React from "react";
import type { Icon } from "@tabler/icons-react";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavLeaf = {
  title: string;
  url: string;
  icon?: Icon;
};

type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
};

type NavMainProps = {
  dashboard: NavLeaf;
  settings: NavLeaf;
  groups: NavGroup[];
};

const GROUPS_STORAGE_KEY = "agencyos.sidebar.groups.v1";

function isActivePath(pathname: string, url: string) {
  return pathname === url || (url !== "/dashboard" && pathname.startsWith(url + "/"));
}

export function NavMain({ dashboard, settings, groups }: NavMainProps) {
  const { setOpenMobile, state } = useSidebar();
  const pathname = usePathname();

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, true]))
  );

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      const withDefaults: Record<string, boolean> = {};
      for (const g of groups) withDefaults[g.id] = parsed[g.id] ?? true;
      setOpenGroups(withDefaults);
    } catch {
      // ignore malformed localStorage
    }
  }, [groups]);

  React.useEffect(() => {
    try {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      // ignore storage errors
    }
  }, [openGroups]);

  const toggleGroup = React.useCallback((id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  }, []);

  return (
    <SidebarGroup className="h-full">
      <SidebarGroupContent className="flex h-full flex-col">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={dashboard.title}
              asChild
              isActive={isActivePath(pathname, dashboard.url)}
            >
              <Link href={dashboard.url} onClick={() => setOpenMobile(false)}>
                {dashboard.icon && <dashboard.icon />}
                <span className="text-[15px]">{dashboard.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="mt-3 space-y-1 group-data-[collapsible=icon]:mt-2 group-data-[collapsible=icon]:space-y-1">
          {groups.map((group) => {
            const storedOpen = openGroups[group.id] ?? true;
            const open = state === "collapsed" ? true : storedOpen;
            const anyChildActive = group.children.some((child) => isActivePath(pathname, child.url));
            return (
              <div key={group.id} className="rounded-md">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "text-sidebar-foreground/80 hover:bg-sidebar-accent flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors group-data-[collapsible=icon]:hidden",
                    anyChildActive && "text-sidebar-foreground"
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <group.icon className="h-4 w-4" />
                    {group.label}
                  </span>
                  {storedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                <div
                  className={cn(
                    "grid transition-all duration-200 ease-out",
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    "group-data-[collapsible=icon]:grid-rows-[1fr] group-data-[collapsible=icon]:opacity-100"
                  )}
                >
                  <div className="overflow-hidden">
                    <SidebarMenu className="mt-1 ms-1 border-s border-sidebar-border ps-2 group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:ms-0 group-data-[collapsible=icon]:border-s-0 group-data-[collapsible=icon]:ps-0">
                      {group.children.map((item) => (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton
                            tooltip={item.title}
                            asChild
                            isActive={isActivePath(pathname, item.url)}
                            className={
                              item.url === "/dashboard/clients"
                                ? "data-[active=true]:bg-[rgba(164,254,25,1)]"
                                : undefined
                            }
                          >
                            <Link href={item.url} onClick={() => setOpenMobile(false)}>
                              {item.icon && <item.icon />}
                              <span className={cn("text-[15px]", item.url === "/dashboard/proposals" && "font-black")}>
                                {item.title}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={settings.title}
                asChild
                isActive={isActivePath(pathname, settings.url)}
              >
                <Link href={settings.url} onClick={() => setOpenMobile(false)}>
                  {settings.icon && <settings.icon />}
                  <span className="text-[15px]">{settings.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
