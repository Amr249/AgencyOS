"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProjectOption = { id: string; name: string };

const tabs = [
  { href: "/dashboard/workspace", label: "My Tasks" },
  { href: "/dashboard/workspace/board", label: "Board" },
  { href: "/dashboard/workspace/calendar", label: "Calendar" },
  { href: "/dashboard/workspace/timeline", label: "Timeline" },
  { href: "/dashboard/workspace/workload", label: "Workload" },
];

export function WorkspaceNav({ projects = [] }: { projects?: ProjectOption[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedProject = searchParams.get("project") ?? "";
  const shouldShowProject = pathname.includes("/workspace/board") || pathname.includes("/workspace/timeline");

  function onProjectChange(projectId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", projectId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div dir="ltr" className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="inline-flex w-fit items-center gap-1 rounded-full bg-muted/60 p-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition-colors",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {shouldShowProject && (
        <Select value={selectedProject || projects[0]?.id} onValueChange={onProjectChange}>
          <SelectTrigger className="w-full md:w-[260px]">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
