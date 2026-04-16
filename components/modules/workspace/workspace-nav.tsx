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
import { ProjectSelectOptionRow, type ProjectPickerOption } from "@/components/entity-select-option";

type ProjectOption = ProjectPickerOption;

const tabs = [
  { href: "/dashboard/workspace", label: "My Tasks", arLabel: "مهامي" },
  { href: "/dashboard/workspace/board", label: "Board", arLabel: "لوحة" },
  { href: "/dashboard/workspace/calendar", label: "Calendar", arLabel: "التقويم" },
  { href: "/dashboard/workspace/timeline", label: "Timeline", arLabel: "الجدول الزمني" },
  { href: "/dashboard/workspace/timesheet", label: "Timesheet", arLabel: "سجل الوقت" },
  { href: "/dashboard/workspace/workload", label: "Workload", arLabel: "عبء العمل" },
  { href: "/dashboard/workspace/availability", label: "Availability", arLabel: "التوفر" },
];

export function WorkspaceNav({ projects = [], isArabic = false }: { projects?: ProjectOption[]; isArabic?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedProject = searchParams.get("project") ?? "";
  const shouldShowProject = pathname.includes("/workspace/board") || pathname.includes("/workspace/timeline");
  const showAllProjectsOption = pathname.includes("/workspace/board");

  function onProjectChange(projectId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", projectId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
              {isArabic ? tab.arLabel : tab.label}
            </Link>
          );
        })}
      </div>

      {shouldShowProject && (
        <Select value={selectedProject || projects[0]?.id} onValueChange={onProjectChange}>
          <SelectTrigger className="w-full md:w-[260px]">
            <SelectValue placeholder={isArabic ? "اختر مشروع" : "Select project"} />
          </SelectTrigger>
          <SelectContent>
            {showAllProjectsOption ? (
              <SelectItem value="all" textValue={isArabic ? "كل المشاريع" : "All projects"}>
                {isArabic ? "كل المشاريع" : "All projects"}
              </SelectItem>
            ) : null}
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id} textValue={project.name}>
                <ProjectSelectOptionRow
                  coverImageUrl={project.coverImageUrl}
                  clientLogoUrl={project.clientLogoUrl}
                  name={project.name}
                />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
